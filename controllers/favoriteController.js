/**
 * Favorite Controller
 * Handles favorite exercise operations
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Add exercise to favorites
 * POST /api/favorites
 * Body: { exerciseId: number }
 */
const addFavorite = async (req, res, next) => {
  try {
    const { exerciseId } = req.body;
    const { uid } = req.user;

    // Validate exerciseId
    if (!exerciseId || isNaN(parseInt(exerciseId))) {
      return res.status(400).json({
        success: false,
        error: 'Valid exercise ID is required',
        code: 'INVALID_EXERCISE_ID',
      });
    }

    const exerciseIdInt = parseInt(exerciseId);

    // Check if exercise exists
    const exercises = await db.query(
      'SELECT id FROM exercises WHERE id = ?',
      [exerciseIdInt]
    );

    if (exercises.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Exercise not found',
        code: 'EXERCISE_NOT_FOUND',
      });
    }

    // Get user's current favorites
    const users = await db.query(
      'SELECT favorites_exercises FROM users WHERE uid = ?',
      [uid]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Parse current favorites or initialize empty array
    let favorites = [];
    if (users[0].favorites_exercises) {
      try {
        favorites = JSON.parse(users[0].favorites_exercises);
      } catch (e) {
        logger.warn('Error parsing favorites_exercises, initializing empty array');
        favorites = [];
      }
    }

    // Check if already in favorites
    if (favorites.includes(exerciseIdInt)) {
      return res.status(400).json({
        success: false,
        error: 'Exercise already in favorites',
        code: 'ALREADY_IN_FAVORITES',
      });
    }

    // Add to favorites
    favorites.push(exerciseIdInt);

    // Update user's favorites
    await db.query(
      'UPDATE users SET favorites_exercises = ? WHERE uid = ?',
      [JSON.stringify(favorites), uid]
    );

    logger.info(`User ${uid} added exercise ${exerciseIdInt} to favorites`);

    res.json({
      success: true,
      message: 'Exercise added to favorites',
      data: {
        exerciseId: exerciseIdInt,
        favorites: favorites,
      },
    });
  } catch (error) {
    logger.error('Add favorite error:', error);
    next(error);
  }
};

/**
 * Remove exercise from favorites
 * DELETE /api/favorites/:exerciseId
 */
const removeFavorite = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;
    const { uid } = req.user;

    // Validate exerciseId
    if (!exerciseId || isNaN(parseInt(exerciseId))) {
      return res.status(400).json({
        success: false,
        error: 'Valid exercise ID is required',
        code: 'INVALID_EXERCISE_ID',
      });
    }

    const exerciseIdInt = parseInt(exerciseId);

    // Get user's current favorites
    const users = await db.query(
      'SELECT favorites_exercises FROM users WHERE uid = ?',
      [uid]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Parse current favorites or initialize empty array
    let favorites = [];
    if (users[0].favorites_exercises) {
      try {
        favorites = JSON.parse(users[0].favorites_exercises);
      } catch (e) {
        logger.warn('Error parsing favorites_exercises, initializing empty array');
        favorites = [];
      }
    }

    // Check if in favorites
    if (!favorites.includes(exerciseIdInt)) {
      return res.status(400).json({
        success: false,
        error: 'Exercise not in favorites',
        code: 'NOT_IN_FAVORITES',
      });
    }

    // Remove from favorites
    favorites = favorites.filter(id => id !== exerciseIdInt);

    // Update user's favorites
    await db.query(
      'UPDATE users SET favorites_exercises = ? WHERE uid = ?',
      [JSON.stringify(favorites), uid]
    );

    logger.info(`User ${uid} removed exercise ${exerciseIdInt} from favorites`);

    res.json({
      success: true,
      message: 'Exercise removed from favorites',
      data: {
        exerciseId: exerciseIdInt,
        favorites: favorites,
      },
    });
  } catch (error) {
    logger.error('Remove favorite error:', error);
    next(error);
  }
};

/**
 * Get user's favorite exercises
 * GET /api/favorites
 * Query params: language (optional, for title translation)
 */
const getFavorites = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const language = req.query.language || 'en';

    // Get user's favorites
    const users = await db.query(
      'SELECT favorites_exercises FROM users WHERE uid = ?',
      [uid]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Parse current favorites or initialize empty array
    let favoriteIds = [];
    if (users[0].favorites_exercises) {
      try {
        favoriteIds = JSON.parse(users[0].favorites_exercises);
      } catch (e) {
        logger.warn('Error parsing favorites_exercises, initializing empty array');
        favoriteIds = [];
      }
    }

    if (favoriteIds.length === 0) {
      return res.json({
        success: true,
        data: {
          exercises: [],
          count: 0,
        },
      });
    }

    // Get favorite exercises from database
    const placeholders = favoriteIds.map(() => '?').join(',');
    const exercises = await db.query(
      `SELECT 
        id,
        category,
        tab_category,
        level,
        video_image_url,
        video_url,
        sub_category,
        title_tr, title_en, title_de, title_ar, title_fr, 
        title_ko, title_ja, title_es, title_it, title_hi, title_pt,
        duration,
        benefits_tr, benefits_en, benefits_de, benefits_ar, benefits_fr,
        benefits_ko, benefits_ja, benefits_es, benefits_it, benefits_hi, benefits_pt,
        explain_tr, explain_en, explain_de, explain_ar, explain_fr,
        explain_ko, explain_ja, explain_es, explain_it, explain_hi, explain_pt,
        steps,
        is_premium,
        created_at,
        updated_at
      FROM exercises
      WHERE id IN (${placeholders})
      ORDER BY FIELD(id, ${placeholders})`,
      [...favoriteIds, ...favoriteIds] // For ORDER BY FIELD
    );

    // Check if user is premium (for content restriction)
    const userIsPremium = await isUserPremium(uid);

    // Transform exercises to API format
    const transformedExercises = exercises.map(exercise => {
      const isPremiumExercise = exercise.is_premium === 1 || exercise.is_premium === true;
      const restrictContent = isPremiumExercise && !userIsPremium;

      return {
        id: exercise.id,
        category: exercise.category,
        tabCategory: exercise.tab_category,
        level: exercise.level,
        videoImageURL: restrictContent ? null : exercise.video_image_url,
        videoUrl: restrictContent ? null : exercise.video_url,
        subCategory: exercise.sub_category,
        title: {
          tr: exercise.title_tr,
          en: exercise.title_en,
          de: exercise.title_de,
          ar: exercise.title_ar,
          fr: exercise.title_fr,
          ko: exercise.title_ko,
          ja: exercise.title_ja,
          es: exercise.title_es,
          it: exercise.title_it,
          hi: exercise.title_hi,
          pt: exercise.title_pt,
        },
        duration: exercise.duration,
        benefits: {
          tr: exercise.benefits_tr ? JSON.parse(exercise.benefits_tr) : [],
          en: exercise.benefits_en ? JSON.parse(exercise.benefits_en) : [],
          de: exercise.benefits_de ? JSON.parse(exercise.benefits_de) : [],
          ar: exercise.benefits_ar ? JSON.parse(exercise.benefits_ar) : [],
          fr: exercise.benefits_fr ? JSON.parse(exercise.benefits_fr) : [],
          ko: exercise.benefits_ko ? JSON.parse(exercise.benefits_ko) : [],
          ja: exercise.benefits_ja ? JSON.parse(exercise.benefits_ja) : [],
          es: exercise.benefits_es ? JSON.parse(exercise.benefits_es) : [],
          it: exercise.benefits_it ? JSON.parse(exercise.benefits_it) : [],
          hi: exercise.benefits_hi ? JSON.parse(exercise.benefits_hi) : [],
          pt: exercise.benefits_pt ? JSON.parse(exercise.benefits_pt) : [],
        },
        explain: {
          tr: exercise.explain_tr,
          en: exercise.explain_en,
          de: exercise.explain_de,
          ar: exercise.explain_ar,
          fr: exercise.explain_fr,
          ko: exercise.explain_ko,
          ja: exercise.explain_ja,
          es: exercise.explain_es,
          it: exercise.explain_it,
          hi: exercise.explain_hi,
          pt: exercise.explain_pt,
        },
        steps: restrictContent ? [] : (exercise.steps ? JSON.parse(exercise.steps) : []),
        isPremium: isPremiumExercise,
        createdAt: exercise.created_at,
        updatedAt: exercise.updated_at,
      };
    });

    res.json({
      success: true,
      data: {
        exercises: transformedExercises,
        count: transformedExercises.length,
      },
    });
  } catch (error) {
    logger.error('Get favorites error:', error);
    next(error);
  }
};

/**
 * Check if exercise is in favorites
 * GET /api/favorites/check/:exerciseId
 */
const checkFavorite = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;
    const { uid } = req.user;

    // Validate exerciseId
    if (!exerciseId || isNaN(parseInt(exerciseId))) {
      return res.status(400).json({
        success: false,
        error: 'Valid exercise ID is required',
        code: 'INVALID_EXERCISE_ID',
      });
    }

    const exerciseIdInt = parseInt(exerciseId);

    // Get user's favorites
    const users = await db.query(
      'SELECT favorites_exercises FROM users WHERE uid = ?',
      [uid]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Parse current favorites or initialize empty array
    let favorites = [];
    if (users[0].favorites_exercises) {
      try {
        favorites = JSON.parse(users[0].favorites_exercises);
      } catch (e) {
        favorites = [];
      }
    }

    const isFavorite = favorites.includes(exerciseIdInt);

    res.json({
      success: true,
      data: {
        exerciseId: exerciseIdInt,
        isFavorite: isFavorite,
      },
    });
  } catch (error) {
    logger.error('Check favorite error:', error);
    next(error);
  }
};

/**
 * Helper function to check if user is premium
 * @param {string} uid - Firebase UID
 * @returns {Promise<boolean>}
 */
async function isUserPremium(uid) {
  try {
    const users = await db.query(
      'SELECT premium_datas FROM users WHERE uid = ?',
      [uid]
    );

    if (!users || users.length === 0) {
      return false;
    }

    const premiumDatas = users[0].premium_datas 
      ? JSON.parse(users[0].premium_datas) 
      : [];

    return Array.isArray(premiumDatas) && premiumDatas.length > 0;
  } catch (error) {
    logger.error('Error checking premium status:', error);
    return false;
  }
}

module.exports = {
  addFavorite,
  removeFavorite,
  getFavorites,
  checkFavorite,
};
