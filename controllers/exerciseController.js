/**
 * Exercise Controller
 * Handles exercise-related operations
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all exercises with optional filters
 * GET /api/exercises
 * Query params: category, isPremium, tabCategory, level
 */
const getExercises = async (req, res, next) => {
  try {
    const { category, isPremium, tabCategory, level } = req.query;
    const user = req.user; // From auth middleware (optional)

    let query = `
      SELECT 
        id,
        category,
        tab_category,
        level,
        video_image_url,
        video_url,
        sub_category,
        title_tr, title_en, title_de, title_ar, title_fr, 
        title_ko, title_ja, title_es, title_it, title_hi, title_pt, title_ru, title_zh,
        duration,
        benefits_tr, benefits_en, benefits_de, benefits_ar, benefits_fr,
        benefits_ko, benefits_ja, benefits_es, benefits_it, benefits_hi, benefits_pt, benefits_ru, benefits_zh,
        explain_tr, explain_en, explain_de, explain_ar, explain_fr,
        explain_ko, explain_ja, explain_es, explain_it, explain_hi, explain_pt, explain_ru, explain_zh,
        steps,
        is_premium,
        created_at,
        updated_at
      FROM exercises
      WHERE 1=1
    `;
    const params = [];

    // Filter by category
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    // Filter by tab category
    if (tabCategory) {
      query += ' AND tab_category = ?';
      params.push(tabCategory);
    }

    // Filter by level
    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }

    // Filter by premium status
    if (isPremium !== undefined) {
      const isPremiumBool = isPremium === 'true' || isPremium === '1';
      query += ' AND is_premium = ?';
      params.push(isPremiumBool);
    }

    // Note: We don't filter out premium exercises here
    // Premium exercises will be shown but content will be restricted if user is not premium

    query += ' ORDER BY id ASC';

    const exercises = await db.query(query, params);

    // Check if user is premium
    const userIsPremium = user && await isUserPremium(user.uid);

    // Transform database format to API format
    const transformedExercises = exercises.map(exercise => {
      const isPremiumExercise = exercise.is_premium === 1 || exercise.is_premium === true;
      
      // If exercise is premium and user is not premium, restrict content access
      const restrictContent = isPremiumExercise && !userIsPremium;

      return {
        id: exercise.id,
        category: exercise.category,
        tabCategory: exercise.tab_category,
        level: exercise.level,
        videoImageURL: exercise.video_image_url,
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
          ru: exercise.title_ru,
          ch: exercise.title_zh,
          zh: exercise.title_zh,
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
          ru: exercise.benefits_ru ? JSON.parse(exercise.benefits_ru) : [],
          ch: exercise.benefits_zh ? JSON.parse(exercise.benefits_zh) : [],
          zh: exercise.benefits_zh ? JSON.parse(exercise.benefits_zh) : [],
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
          ru: exercise.explain_ru,
          ch: exercise.explain_zh,
          zh: exercise.explain_zh,
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
    logger.error('Get exercises error:', error);
    next(error);
  }
};

/**
 * Get exercise by ID
 * GET /api/exercises/:id
 */
const getExerciseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user; // From auth middleware (optional)

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
        title_ko, title_ja, title_es, title_it, title_hi, title_pt, title_ru, title_zh,
        duration,
        benefits_tr, benefits_en, benefits_de, benefits_ar, benefits_fr,
        benefits_ko, benefits_ja, benefits_es, benefits_it, benefits_hi, benefits_pt, benefits_ru, benefits_zh,
        explain_tr, explain_en, explain_de, explain_ar, explain_fr,
        explain_ko, explain_ja, explain_es, explain_it, explain_hi, explain_pt, explain_ru, explain_zh,
        steps,
        is_premium,
        created_at,
        updated_at
      FROM exercises
      WHERE id = ?`,
      [id]
    );

    if (exercises.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Exercise not found',
        code: 'EXERCISE_NOT_FOUND',
      });
    }

    const exercise = exercises[0];

    // Check if user is premium
    const userIsPremium = user && await isUserPremium(user.uid);
    const isPremiumExercise = exercise.is_premium === 1 || exercise.is_premium === true;
    
    // If exercise is premium and user is not premium, restrict content access
    const restrictContent = isPremiumExercise && !userIsPremium;

    // Transform to API format
    const transformedExercise = {
      id: exercise.id,
      category: exercise.category,
      tabCategory: exercise.tab_category,
      level: exercise.level,
      videoImageURL: exercise.video_image_url,
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
        ru: exercise.title_ru,
        ch: exercise.title_zh,
        zh: exercise.title_zh,
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
        ru: exercise.benefits_ru ? JSON.parse(exercise.benefits_ru) : [],
        ch: exercise.benefits_zh ? JSON.parse(exercise.benefits_zh) : [],
        zh: exercise.benefits_zh ? JSON.parse(exercise.benefits_zh) : [],
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
        ru: exercise.explain_ru,
        ch: exercise.explain_zh,
        zh: exercise.explain_zh,
      },
      steps: restrictContent ? [] : (exercise.steps ? JSON.parse(exercise.steps) : []),
      isPremium: isPremiumExercise,
      createdAt: exercise.created_at,
      updatedAt: exercise.updated_at,
    };

    res.json({
      success: true,
      data: transformedExercise,
    });
  } catch (error) {
    logger.error('Get exercise by ID error:', error);
    next(error);
  }
};

/**
 * Get exercises by category
 * GET /api/exercises/category/:category
 */
const getExercisesByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { isPremium } = req.query;
    const user = req.user;

    let query = `
      SELECT * FROM exercises
      WHERE category = ?
    `;
    const params = [category];

    if (isPremium !== undefined) {
      const isPremiumBool = isPremium === 'true' || isPremium === '1';
      query += ' AND is_premium = ?';
      params.push(isPremiumBool);
    }

    // Note: We don't filter out premium exercises here
    // Premium exercises will be shown but content will be restricted if user is not premium

    query += ' ORDER BY id ASC';

    const exercises = await db.query(query, params);
    
    // Check if user is premium
    const userIsPremium = user && await isUserPremium(user.uid);
    const transformedExercises = transformExercises(exercises, userIsPremium);

    res.json({
      success: true,
      data: {
        exercises: transformedExercises,
        count: transformedExercises.length,
        category,
      },
    });
  } catch (error) {
    logger.error('Get exercises by category error:', error);
    next(error);
  }
};

/**
 * Get only premium exercises
 * GET /api/exercises/premium
 */
const getPremiumExercises = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!(await isUserPremium(user.uid))) {
      return res.status(403).json({
        success: false,
        error: 'Premium subscription required',
        code: 'PREMIUM_REQUIRED',
      });
    }

    const exercises = await db.query(
      'SELECT * FROM exercises WHERE is_premium = TRUE ORDER BY id ASC'
    );

    const transformedExercises = transformExercises(exercises, true); // User is premium (already checked)

    res.json({
      success: true,
      data: {
        exercises: transformedExercises,
        count: transformedExercises.length,
      },
    });
  } catch (error) {
    logger.error('Get premium exercises error:', error);
    next(error);
  }
};

/**
 * Get only free exercises
 * GET /api/exercises/free
 */
const getFreeExercises = async (req, res, next) => {
  try {
    const exercises = await db.query(
      'SELECT * FROM exercises WHERE is_premium = FALSE ORDER BY id ASC'
    );

    const transformedExercises = transformExercises(exercises, false); // Free exercises, no premium needed

    res.json({
      success: true,
      data: {
        exercises: transformedExercises,
        count: transformedExercises.length,
      },
    });
  } catch (error) {
    logger.error('Get free exercises error:', error);
    next(error);
  }
};

/**
 * Get available categories
 * GET /api/exercises/categories
 */
const getCategories = async (req, res, next) => {
  try {
    const categories = await db.query(
      'SELECT DISTINCT category FROM exercises ORDER BY category ASC'
    );

    res.json({
      success: true,
      data: {
        categories: categories.map(c => c.category),
      },
    });
  } catch (error) {
    logger.error('Get categories error:', error);
    next(error);
  }
};

/**
 * Get available tab categories
 * GET /api/exercises/tab-categories
 */
const getTabCategories = async (req, res, next) => {
  try {
    const tabCategories = await db.query(
      'SELECT DISTINCT tab_category FROM exercises ORDER BY tab_category ASC'
    );

    res.json({
      success: true,
      data: {
        tabCategories: tabCategories.map(tc => tc.tab_category),
      },
    });
  } catch (error) {
    logger.error('Get tab categories error:', error);
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

    // Check if user has active premium subscription
    // You can customize this logic based on your premium data structure
    return Array.isArray(premiumDatas) && premiumDatas.length > 0;
  } catch (error) {
    logger.error('Error checking premium status:', error);
    return false;
  }
}

/**
 * Transform database exercise format to API format
 * @param {Array} exercises - Raw database exercises
 * @param {boolean} userIsPremium - Whether the user has premium access
 * @returns {Array} Transformed exercises
 */
function transformExercises(exercises, userIsPremium = false) {
  return exercises.map(exercise => {
    const isPremiumExercise = exercise.is_premium === 1 || exercise.is_premium === true;
    
    // If exercise is premium and user is not premium, restrict content access
    const restrictContent = isPremiumExercise && !userIsPremium;

    return {
      id: exercise.id,
      category: exercise.category,
      tabCategory: exercise.tab_category,
      level: exercise.level,
      videoImageURL: exercise.video_image_url,
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
        ru: exercise.title_ru,
        ch: exercise.title_zh,
        zh: exercise.title_zh,
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
        ru: exercise.benefits_ru ? JSON.parse(exercise.benefits_ru) : [],
        ch: exercise.benefits_zh ? JSON.parse(exercise.benefits_zh) : [],
        zh: exercise.benefits_zh ? JSON.parse(exercise.benefits_zh) : [],
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
        ru: exercise.explain_ru,
        ch: exercise.explain_zh,
        zh: exercise.explain_zh,
      },
      steps: restrictContent ? [] : (exercise.steps ? JSON.parse(exercise.steps) : []),
      isPremium: isPremiumExercise,
      createdAt: exercise.created_at,
      updatedAt: exercise.updated_at,
    };
  });
}

/**
 * Search exercises by query
 * GET /api/exercises/search
 * Query params: q (search query), language (language code, default: 'en')
 */
const searchExercises = async (req, res, next) => {
  try {
    const { q, language } = req.query;
    const user = req.user; // From auth middleware (optional)

    // Validate search query
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        code: 'QUERY_REQUIRED',
      });
    }

    // Validate and set language (default: 'en')
    const languageCode = language || 'en';
    const validLanguages = ['tr', 'en', 'de', 'ar', 'fr', 'ko', 'ja', 'es', 'it', 'hi', 'pt', 'ru', 'ch'];
    const searchLanguage = validLanguages.includes(languageCode) ? languageCode : 'en';

    // Map language code to database column
    const titleColumnMap = {
      'tr': 'title_tr',
      'en': 'title_en',
      'de': 'title_de',
      'ar': 'title_ar',
      'fr': 'title_fr',
      'ko': 'title_ko',
      'ja': 'title_ja',
      'es': 'title_es',
      'it': 'title_it',
      'hi': 'title_hi',
      'pt': 'title_pt',
      'ru': 'title_ru',
      'ch': 'title_zh',
      'zh': 'title_zh',
    };

    const titleColumn = titleColumnMap[searchLanguage] || 'title_en';
    const searchQuery = `%${q.trim()}%`;

    // Build search query
    const searchTerm = q.trim();
    const exactMatch = searchTerm;
    const startsWith = `${searchTerm}%`;
    
    let query = `
      SELECT 
        id,
        category,
        tab_category,
        level,
        video_image_url,
        video_url,
        sub_category,
        title_tr, title_en, title_de, title_ar, title_fr, 
        title_ko, title_ja, title_es, title_it, title_hi, title_pt, title_ru, title_zh,
        duration,
        benefits_tr, benefits_en, benefits_de, benefits_ar, benefits_fr,
        benefits_ko, benefits_ja, benefits_es, benefits_it, benefits_hi, benefits_pt, benefits_ru, benefits_zh,
        explain_tr, explain_en, explain_de, explain_ar, explain_fr,
        explain_ko, explain_ja, explain_es, explain_it, explain_hi, explain_pt, explain_ru, explain_zh,
        steps,
        is_premium,
        created_at,
        updated_at
      FROM exercises
      WHERE ${titleColumn} LIKE ?
      ORDER BY 
        CASE 
          WHEN ${titleColumn} = ? THEN 1
          WHEN ${titleColumn} LIKE ? THEN 2
          ELSE 3
        END,
        id ASC
    `;
    
    const params = [searchQuery, exactMatch, startsWith];

    const exercises = await db.query(query, params);

    // Check if user is premium
    const userIsPremium = user && await isUserPremium(user.uid);

    // Transform database format to API format
    const transformedExercises = exercises.map(exercise => {
      const isPremiumExercise = exercise.is_premium === 1 || exercise.is_premium === true;
      const restrictContent = isPremiumExercise && !userIsPremium;

      return {
        id: exercise.id,
        category: exercise.category,
        tabCategory: exercise.tab_category,
        level: exercise.level,
        videoImageURL: exercise.video_image_url,
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
          ru: exercise.title_ru,
          ch: exercise.title_zh,
          zh: exercise.title_zh,
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
          ru: exercise.benefits_ru ? JSON.parse(exercise.benefits_ru) : [],
          ch: exercise.benefits_zh ? JSON.parse(exercise.benefits_zh) : [],
          zh: exercise.benefits_zh ? JSON.parse(exercise.benefits_zh) : [],
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
          ru: exercise.explain_ru,
          ch: exercise.explain_zh,
          zh: exercise.explain_zh,
        },
        steps: restrictContent ? [] : (exercise.steps ? JSON.parse(exercise.steps) : []),
        isPremium: isPremiumExercise,
        createdAt: exercise.created_at,
        updatedAt: exercise.updated_at,
      };
    });

    logger.info(`Search performed: query="${q}", language=${searchLanguage}, results=${transformedExercises.length}`);

    res.json({
      success: true,
      data: {
        exercises: transformedExercises,
        count: transformedExercises.length,
        query: q,
        language: searchLanguage,
      },
    });
  } catch (error) {
    logger.error('Search exercises error:', error);
    next(error);
  }
};

module.exports = {
  getExercises,
  getExerciseById,
  getExercisesByCategory,
  getPremiumExercises,
  getFreeExercises,
  getCategories,
  getTabCategories,
  searchExercises,
};
