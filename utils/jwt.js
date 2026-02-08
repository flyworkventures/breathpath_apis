/**
 * JWT Utility Functions
 * Token generation and verification
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d';

if (!JWT_SECRET) {
  logger.error('JWT_SECRET is not set in environment variables');
  process.exit(1);
}

/**
 * Generate access token
 * @param {string} uid - Firebase UID
 * @param {string} authProvider - Auth provider
 * @returns {string} JWT access token
 */
function generateAccessToken(uid, authProvider) {
  const payload = {
    uid,
    authProvider,
    type: 'access',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    jwtid: uuidv4(),
  });
}

/**
 * Generate refresh token and store in database
 * @param {string} uid - Firebase UID
 * @returns {Promise<string>} Refresh token
 */
async function generateRefreshToken(uid) {
  const payload = {
    uid,
    type: 'refresh',
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    jwtid: uuidv4(),
  });

  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  // Store refresh token in database
  try {
    await db.query(
      `INSERT INTO refresh_tokens (uid, token, expires_at) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       token = VALUES(token), 
       expires_at = VALUES(expires_at), 
       is_revoked = FALSE`,
      [uid, token, expiresAt]
    );
  } catch (error) {
    logger.error('Error storing refresh token:', error);
    throw error;
  }

  return token;
}

/**
 * Verify access token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Verify refresh token
 * @param {string} token - Refresh token
 * @returns {Promise<Object>} Decoded token payload
 */
async function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if token is revoked
    const tokens = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND is_revoked = FALSE AND expires_at > NOW()',
      [token]
    );

    if (!tokens || tokens.length === 0) {
      throw new Error('Refresh token not found or revoked');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Revoke refresh token
 * @param {string} token - Refresh token to revoke
 * @returns {Promise<void>}
 */
async function revokeRefreshToken(token) {
  try {
    await db.query(
      'UPDATE refresh_tokens SET is_revoked = TRUE WHERE token = ?',
      [token]
    );
  } catch (error) {
    logger.error('Error revoking refresh token:', error);
    throw error;
  }
}

/**
 * Revoke all refresh tokens for a user
 * @param {string} uid - Firebase UID
 * @returns {Promise<void>}
 */
async function revokeAllRefreshTokens(uid) {
  try {
    await db.query(
      'UPDATE refresh_tokens SET is_revoked = TRUE WHERE uid = ?',
      [uid]
    );
  } catch (error) {
    logger.error('Error revoking all refresh tokens:', error);
    throw error;
  }
}

/**
 * Clean up expired refresh tokens (should be run periodically)
 * @returns {Promise<void>}
 */
async function cleanupExpiredTokens() {
  try {
    const result = await db.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR is_revoked = TRUE'
    );
    logger.info(`Cleaned up ${result.affectedRows} expired refresh tokens`);
  } catch (error) {
    logger.error('Error cleaning up expired tokens:', error);
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  cleanupExpiredTokens,
};
