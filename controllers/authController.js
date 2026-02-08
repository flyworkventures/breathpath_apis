/**
 * Authentication Controller
 * Handles user registration and authentication
 */

const db = require('../config/database');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} = require('../utils/jwt');
const logger = require('../utils/logger');
const { uploadFile, deleteFile } = require('../utils/bunnyCDN');

/**
 * Sign in user (register if new, login if exists)
 * POST /api/auth/signin
 * This endpoint handles both registration and login automatically
 */
const signin = async (req, res, next) => {
  try {
    const { uid, username, email, authProvider } = req.body;

    // Validate required fields
    if (!uid || !authProvider) {
      return res.status(400).json({
        success: false,
        error: 'uid and authProvider are required',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate auth provider
    const validProviders = ['google', 'facebook', 'apple', 'guest'];
    if (!validProviders.includes(authProvider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid auth provider',
        code: 'INVALID_PROVIDER',
      });
    }

    // Check if user already exists (regardless of is_active status)
    const existingUsers = await db.query(
      'SELECT * FROM users WHERE uid = ?',
      [uid]
    );

    let user;
    let isNewUser = false;

    // Safety check: ensure existingUsers is an array
    if (existingUsers && Array.isArray(existingUsers) && existingUsers.length > 0) {
      // User exists - Login flow
      user = existingUsers[0];

      // If user was deactivated (soft deleted), reactivate the account
      if (!user.is_active) {
        await db.query(
          'UPDATE users SET is_active = TRUE, last_active = NOW() WHERE uid = ?',
          [uid]
        );
        user.is_active = true;
        logger.info(`User account reactivated: ${uid} (${authProvider})`);
      } else {
        // Update last active
        await db.query(
          'UPDATE users SET last_active = NOW() WHERE uid = ?',
          [uid]
        );
      }

      // Optionally update username/email if provided and different
      if (username && username !== user.username) {
        await db.query(
          'UPDATE users SET username = ? WHERE uid = ?',
          [username, uid]
        );
        user.username = username;
      }

      if (email && email !== user.email) {
        await db.query(
          'UPDATE users SET email = ? WHERE uid = ?',
          [email, uid]
        );
        user.email = email;
      }

      logger.info(`User logged in: ${uid} (${authProvider})`);
    } else {
      // User doesn't exist - Register flow
      isNewUser = true;

      // Create new user
      const result = await db.query(
        `INSERT INTO users (uid, username, email, auth_provider, favorites_exercises, premium_datas)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uid,
          username || null,
          email || null,
          authProvider,
          JSON.stringify([]), // Empty favorites array
          JSON.stringify([]), // Empty premium data array
        ]
      );

      // Get created user
      const newUsers = await db.query(
        'SELECT * FROM users WHERE id = ?',
        [result.insertId]
      );

      // Safety check: ensure newUsers is an array and has at least one element
      if (!newUsers || !Array.isArray(newUsers) || newUsers.length === 0) {
        throw new Error('Failed to retrieve created user');
      }

      user = newUsers[0];
      logger.info(`New user registered: ${uid} (${authProvider})`);
    }

    // Generate tokens (same for both new and existing users)
    const accessToken = generateAccessToken(user.uid, user.auth_provider);
    const refreshToken = await generateRefreshToken(user.uid);

    // Prepare user data
    const userData = {
      uid: user.uid,
      username: user.username,
      email: user.email,
      authProvider: user.auth_provider,
      profilePhotoUrl: user.profile_photo_url || null,
      favoritesExercises: JSON.parse(user.favorites_exercises || '[]'),
      premiumDatas: JSON.parse(user.premium_datas || '[]'),
      lastActive: user.last_active,
      accountCreatedDate: user.account_created_date,
    };

    // Return response with isNewUser flag
    res.status(isNewUser ? 201 : 200).json({
      success: true,
      data: {
        user: userData,
        tokens: {
          accessToken,
          refreshToken,
        },
        isNewUser,
      },
    });
  } catch (error) {
    logger.error('Sign in error:', error);
    next(error);
  }
};

/**
 * Register a new user (DEPRECATED - Use signin instead)
 * POST /api/auth/register
 * @deprecated Use /api/auth/signin instead
 */
const register = async (req, res, next) => {
  try {
    const { uid, username, email, authProvider } = req.body;

    // Validate required fields
    if (!uid || !authProvider) {
      return res.status(400).json({
        success: false,
        error: 'uid and authProvider are required',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate auth provider
    const validProviders = ['google', 'facebook', 'apple', 'guest'];
    if (!validProviders.includes(authProvider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid auth provider',
        code: 'INVALID_PROVIDER',
      });
    }

    // Check if user already exists
    const existingUsers = await db.query(
      'SELECT id FROM users WHERE uid = ?',
      [uid]
    );

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        code: 'USER_EXISTS',
      });
    }

    // Create user
    const result = await db.query(
      `INSERT INTO users (uid, username, email, auth_provider, favorites_exercises, premium_datas)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uid,
        username || null,
        email || null,
        authProvider,
        JSON.stringify([]), // Empty favorites array
        JSON.stringify([]), // Empty premium data array
      ]
    );

    // Generate tokens
    const accessToken = generateAccessToken(uid, authProvider);
    const refreshToken = await generateRefreshToken(uid);

    // Get created user
    const users = await db.query(
      'SELECT * FROM users WHERE id = ?',
      [result.insertId]
    );

    if (!users || users.length === 0) {
      throw new Error('Failed to retrieve created user');
    }

    const user = users[0];

    logger.info(`User registered: ${uid} (${authProvider})`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          uid: user.uid,
          username: user.username,
          email: user.email,
          authProvider: user.auth_provider,
          profilePhotoUrl: user.profile_photo_url || null,
          favoritesExercises: JSON.parse(user.favorites_exercises || '[]'),
          premiumDatas: JSON.parse(user.premium_datas || '[]'),
          lastActive: user.last_active,
          accountCreatedDate: user.account_created_date,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    next(error);
  }
};

/**
 * Login user (DEPRECATED - Use signin instead)
 * POST /api/auth/login
 * @deprecated Use /api/auth/signin instead
 */
const login = async (req, res, next) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: 'uid is required',
        code: 'VALIDATION_ERROR',
      });
    }

    // Find user
    const users = await db.query(
      'SELECT * FROM users WHERE uid = ? AND is_active = TRUE',
      [uid]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const user = users[0];

    // Update last active
    await db.query(
      'UPDATE users SET last_active = NOW() WHERE uid = ?',
      [uid]
    );

    // Generate tokens
    const accessToken = generateAccessToken(user.uid, user.auth_provider);
    const refreshToken = await generateRefreshToken(user.uid);

    logger.info(`User logged in: ${uid}`);

    res.json({
      success: true,
      data: {
        user: {
          uid: user.uid,
          username: user.username,
          email: user.email,
          authProvider: user.auth_provider,
          profilePhotoUrl: user.profile_photo_url || null,
          favoritesExercises: JSON.parse(user.favorites_exercises || '[]'),
          premiumDatas: JSON.parse(user.premium_datas || '[]'),
          lastActive: user.last_active,
          accountCreatedDate: user.account_created_date,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 * 
 * Sliding Window Approach:
 * - When refresh token is used, a new refresh token is also generated
 * - Old refresh token is revoked for security
 * - Active users' sessions are extended automatically
 * - Inactive users (7 days) need to sign in again
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
        code: 'VALIDATION_ERROR',
      });
    }

    // Verify refresh token
    const decoded = await verifyRefreshToken(refreshToken);

    // Get user
    const users = await db.query(
      'SELECT * FROM users WHERE uid = ? AND is_active = TRUE',
      [decoded.uid]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const user = users[0];

    // Revoke old refresh token for security (token rotation)
    await revokeRefreshToken(refreshToken);

    // Generate new tokens
    const accessToken = generateAccessToken(user.uid, user.auth_provider);
    const newRefreshToken = await generateRefreshToken(user.uid);

    logger.info(`Token refreshed for user: ${user.uid}`);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken, // New refresh token (sliding window)
      },
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    
    if (error.message === 'Refresh token expired' || error.message === 'Refresh token not found or revoked') {
      return res.status(401).json({
        success: false,
        error: error.message,
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Refresh token süresi dolmuş. Lütfen tekrar oturum açın.',
      });
    }

    next(error);
  }
};

/**
 * Logout user (revoke refresh token)
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    } else if (req.user) {
      // Revoke all tokens for the user
      await revokeAllRefreshTokens(req.user.uid);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const { uid } = req.user;

    const users = await db.query(
      'SELECT * FROM users WHERE uid = ? AND is_active = TRUE',
      [uid]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const user = users[0];

    res.json({
      success: true,
      data: {
        uid: user.uid,
        username: user.username,
        email: user.email,
        authProvider: user.auth_provider,
        profilePhotoUrl: user.profile_photo_url || null,
        favoritesExercises: JSON.parse(user.favorites_exercises || '[]'),
        premiumDatas: JSON.parse(user.premium_datas || '[]'),
        lastActive: user.last_active,
        accountCreatedDate: user.account_created_date,
      },
    });
  } catch (error) {
    logger.error('Get me error:', error);
    next(error);
  }
};

/**
 * Update user profile
 * PATCH /api/auth/me
 * Body: { username?: string, profilePhotoUrl?: string }
 */
const updateProfile = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { username, profilePhotoUrl } = req.body;

    // Validate that at least one field is provided
    if (username === undefined && profilePhotoUrl === undefined) {
      return res.status(400).json({
        success: false,
        error: 'At least one field (username or profilePhotoUrl) must be provided',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate username if provided
    if (username !== undefined) {
      if (typeof username !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Username must be a string',
          code: 'VALIDATION_ERROR',
        });
      }

      if (username.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Username must be 100 characters or less',
          code: 'VALIDATION_ERROR',
        });
      }

      // Trim whitespace
      const trimmedUsername = username.trim();
      if (trimmedUsername.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Username cannot be empty',
          code: 'VALIDATION_ERROR',
        });
      }
    }

    // Validate profilePhotoUrl if provided
    if (profilePhotoUrl !== undefined) {
      if (profilePhotoUrl !== null && typeof profilePhotoUrl !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Profile photo URL must be a string or null',
          code: 'VALIDATION_ERROR',
        });
      }

      if (profilePhotoUrl && profilePhotoUrl.length > 500) {
        return res.status(400).json({
          success: false,
          error: 'Profile photo URL must be 500 characters or less',
          code: 'VALIDATION_ERROR',
        });
      }
    }

    // Check if user exists
    const users = await db.query(
      'SELECT * FROM users WHERE uid = ? AND is_active = TRUE',
      [uid]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (username !== undefined) {
      updateFields.push('username = ?');
      updateValues.push(username.trim());
    }

    if (profilePhotoUrl !== undefined) {
      updateFields.push('profile_photo_url = ?');
      updateValues.push(profilePhotoUrl || null);
    }

    // Add uid for WHERE clause
    updateValues.push(uid);

    // Execute update
    await db.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE uid = ?`,
      updateValues
    );

    // Get updated user
    const updatedUsers = await db.query(
      'SELECT * FROM users WHERE uid = ? AND is_active = TRUE',
      [uid]
    );

    const updatedUser = updatedUsers[0];

    logger.info(`User profile updated: ${uid}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        uid: updatedUser.uid,
        username: updatedUser.username,
        email: updatedUser.email,
        authProvider: updatedUser.auth_provider,
        profilePhotoUrl: updatedUser.profile_photo_url || null,
        favoritesExercises: JSON.parse(updatedUser.favorites_exercises || '[]'),
        premiumDatas: JSON.parse(updatedUser.premium_datas || '[]'),
        lastActive: updatedUser.last_active,
        accountCreatedDate: updatedUser.account_created_date,
      },
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    next(error);
  }
};

/**
 * Upload profile photo
 * POST /api/auth/me/photo
 * Content-Type: multipart/form-data
 * Body: photo (file)
 */
const uploadProfilePhoto = async (req, res, next) => {
  try {
    const { uid } = req.user;

    // This check should not be needed as middleware handles it, but keeping for safety
    if (!req.file) {
      logger.warn(`Upload profile photo - no file received for user: ${uid}`);
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please send a file with field name "photo"',
        code: 'NO_FILE',
      });
    }

    logger.info(`Upload profile photo request for user: ${uid}, file size: ${req.file.size}, mimetype: ${req.file.mimetype}, originalname: ${req.file.originalname}`);

    // Check if user exists
    const users = await db.query(
      'SELECT profile_photo_url FROM users WHERE uid = ? AND is_active = TRUE',
      [uid]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const user = users[0];
    const oldPhotoUrl = user.profile_photo_url;

    // Upload new photo to Bunny CDN
    const fileName = req.file.originalname || 'profile-photo.jpg';
    
    let cdnUrl;
    try {
      cdnUrl = await uploadFile(req.file.buffer, fileName, uid);
    } catch (uploadError) {
      logger.error('Bunny CDN upload failed:', uploadError);
      return res.status(400).json({
        success: false,
        error: uploadError.message || 'Failed to upload file to Bunny CDN',
        code: 'UPLOAD_FAILED',
      });
    }

    // Update user's profile photo URL
    await db.query(
      'UPDATE users SET profile_photo_url = ? WHERE uid = ?',
      [cdnUrl, uid]
    );

    // Delete old photo from Bunny CDN if exists
    if (oldPhotoUrl) {
      await deleteFile(oldPhotoUrl).catch(err => {
        logger.warn(`Failed to delete old profile photo: ${err.message}`);
      });
    }

    logger.info(`Profile photo uploaded for user: ${uid}`);

    // Get updated user
    const updatedUsers = await db.query(
      'SELECT * FROM users WHERE uid = ? AND is_active = TRUE',
      [uid]
    );

    const updatedUser = updatedUsers[0];

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        profilePhotoUrl: cdnUrl,
        user: {
          uid: updatedUser.uid,
          username: updatedUser.username,
          email: updatedUser.email,
          authProvider: updatedUser.auth_provider,
          profilePhotoUrl: updatedUser.profile_photo_url || null,
          favoritesExercises: JSON.parse(updatedUser.favorites_exercises || '[]'),
          premiumDatas: JSON.parse(updatedUser.premium_datas || '[]'),
          lastActive: updatedUser.last_active,
          accountCreatedDate: updatedUser.account_created_date,
        },
      },
    });
  } catch (error) {
    logger.error('Upload profile photo error:', error);
    next(error);
  }
};

/**
 * Delete profile photo
 * DELETE /api/auth/me/photo
 */
const deleteProfilePhoto = async (req, res, next) => {
  try {
    const { uid } = req.user;

    // Check if user exists and has a profile photo
    const users = await db.query(
      'SELECT profile_photo_url FROM users WHERE uid = ? AND is_active = TRUE',
      [uid]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const user = users[0];
    const photoUrl = user.profile_photo_url;

    if (!photoUrl) {
      return res.status(400).json({
        success: false,
        error: 'No profile photo to delete',
        code: 'NO_PHOTO',
      });
    }

    // Delete photo from Bunny CDN
    await deleteFile(photoUrl).catch(err => {
      logger.warn(`Failed to delete profile photo from CDN: ${err.message}`);
    });

    // Update user's profile photo URL to null
    await db.query(
      'UPDATE users SET profile_photo_url = NULL WHERE uid = ?',
      [uid]
    );

    logger.info(`Profile photo deleted for user: ${uid}`);

    // Get updated user
    const updatedUsers = await db.query(
      'SELECT * FROM users WHERE uid = ? AND is_active = TRUE',
      [uid]
    );

    const updatedUser = updatedUsers[0];

    res.json({
      success: true,
      message: 'Profile photo deleted successfully',
      data: {
        user: {
          uid: updatedUser.uid,
          username: updatedUser.username,
          email: updatedUser.email,
          authProvider: updatedUser.auth_provider,
          profilePhotoUrl: null,
          favoritesExercises: JSON.parse(updatedUser.favorites_exercises || '[]'),
          premiumDatas: JSON.parse(updatedUser.premium_datas || '[]'),
          lastActive: updatedUser.last_active,
          accountCreatedDate: updatedUser.account_created_date,
        },
      },
    });
  } catch (error) {
    logger.error('Delete profile photo error:', error);
    next(error);
  }
};

/**
 * Delete user account
 * DELETE /api/auth/me
 * Permanently deletes user account and all associated data
 */
const deleteAccount = async (req, res, next) => {
  try {
    const { uid } = req.user;

    // Check if user exists
    const users = await db.query(
      'SELECT profile_photo_url FROM users WHERE uid = ? AND is_active = TRUE',
      [uid]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const user = users[0];

    // Delete profile photo from Bunny CDN if exists
    if (user.profile_photo_url) {
      try {
        const { deleteFile } = require('../utils/bunnyCDN');
        await deleteFile(user.profile_photo_url);
        logger.info(`Profile photo deleted for user: ${uid}`);
      } catch (photoError) {
        logger.warn(`Failed to delete profile photo: ${photoError.message}`);
        // Continue with account deletion even if photo deletion fails
      }
    }

    // Revoke all refresh tokens for the user
    try {
      await revokeAllRefreshTokens(uid);
      logger.info(`All refresh tokens revoked for user: ${uid}`);
    } catch (tokenError) {
      logger.warn(`Failed to revoke refresh tokens: ${tokenError.message}`);
      // Continue with account deletion even if token revocation fails
    }

    // Soft delete: Set is_active to FALSE
    // This preserves data for potential recovery or analytics
    await db.query(
      'UPDATE users SET is_active = FALSE WHERE uid = ?',
      [uid]
    );

    logger.info(`User account deleted (deactivated): ${uid}`);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    logger.error('Delete account error:', error);
    next(error);
  }
};

module.exports = {
  signin,
  register, // Deprecated but kept for backward compatibility
  login, // Deprecated but kept for backward compatibility
  refresh,
  logout,
  getMe,
  updateProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
  deleteAccount,
};
