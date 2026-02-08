/**
 * Category Controller
 * Handles category-related operations
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all categories
 * GET /api/categories
 * Query params: ?lang=tr (optional, defaults to 'en')
 */
const getCategories = async (req, res, next) => {
  try {
    const lang = req.query.lang || 'en';
    const langColumn = `name_${lang}`;

    // Validate language code
    const validLangs = ['tr', 'en', 'de', 'ar', 'fr', 'ko', 'ja', 'es', 'it', 'hi', 'pt'];
    const finalLang = validLangs.includes(lang) ? lang : 'en';
    const finalLangColumn = `name_${finalLang}`;

    const categories = await db.query(
      `SELECT 
        id,
        category_code as categoryCode,
        tab_category as tabCategory,
        category_image_url as categoryImageURL,
        name_tr,
        name_en,
        name_de,
        name_ar,
        name_fr,
        name_ko,
        name_ja,
        name_es,
        name_it,
        name_hi,
        name_pt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM categories
      ORDER BY id ASC`
    );

    // Format response with multi-language name object
    const formattedCategories = categories.map((cat) => ({
      id: cat.id,
      categoryCode: cat.categoryCode,
      tabCategory: cat.tabCategory,
      categoryImageURL: cat.categoryImageURL,
      name: {
        tr: cat.name_tr,
        en: cat.name_en,
        de: cat.name_de,
        ar: cat.name_ar,
        fr: cat.name_fr,
        ko: cat.name_ko,
        ja: cat.name_ja,
        es: cat.name_es,
        it: cat.name_it,
        hi: cat.name_hi,
        pt: cat.name_pt,
      },
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));

    res.json({
      success: true,
      data: formattedCategories,
      count: formattedCategories.length,
    });
  } catch (error) {
    logger.error('Get categories error:', error);
    next(error);
  }
};

/**
 * Get category by ID
 * GET /api/categories/:id
 * Query params: ?lang=tr (optional, defaults to 'en')
 */
const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lang = req.query.lang || 'en';

    const categories = await db.query(
      `SELECT 
        id,
        category_code as categoryCode,
        tab_category as tabCategory,
        category_image_url as categoryImageURL,
        name_tr,
        name_en,
        name_de,
        name_ar,
        name_fr,
        name_ko,
        name_ja,
        name_es,
        name_it,
        name_hi,
        name_pt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM categories
      WHERE id = ?`,
      [id]
    );

    if (!categories || categories.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
        code: 'CATEGORY_NOT_FOUND',
      });
    }

    const cat = categories[0];

    // Format response with multi-language name object
    const formattedCategory = {
      id: cat.id,
      categoryCode: cat.categoryCode,
      tabCategory: cat.tabCategory,
      categoryImageURL: cat.categoryImageURL,
      name: {
        tr: cat.name_tr,
        en: cat.name_en,
        de: cat.name_de,
        ar: cat.name_ar,
        fr: cat.name_fr,
        ko: cat.name_ko,
        ja: cat.name_ja,
        es: cat.name_es,
        it: cat.name_it,
        hi: cat.name_hi,
        pt: cat.name_pt,
      },
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    };

    res.json({
      success: true,
      data: formattedCategory,
    });
  } catch (error) {
    logger.error('Get category by ID error:', error);
    next(error);
  }
};

/**
 * Get category by category code
 * GET /api/categories/code/:code
 * Query params: ?lang=tr (optional, defaults to 'en')
 */
const getCategoryByCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    const lang = req.query.lang || 'en';

    const categories = await db.query(
      `SELECT 
        id,
        category_code as categoryCode,
        tab_category as tabCategory,
        category_image_url as categoryImageURL,
        name_tr,
        name_en,
        name_de,
        name_ar,
        name_fr,
        name_ko,
        name_ja,
        name_es,
        name_it,
        name_hi,
        name_pt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM categories
      WHERE category_code = ?`,
      [code]
    );

    if (!categories || categories.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
        code: 'CATEGORY_NOT_FOUND',
      });
    }

    const cat = categories[0];

    // Format response with multi-language name object
    const formattedCategory = {
      id: cat.id,
      categoryCode: cat.categoryCode,
      tabCategory: cat.tabCategory,
      categoryImageURL: cat.categoryImageURL,
      name: {
        tr: cat.name_tr,
        en: cat.name_en,
        de: cat.name_de,
        ar: cat.name_ar,
        fr: cat.name_fr,
        ko: cat.name_ko,
        ja: cat.name_ja,
        es: cat.name_es,
        it: cat.name_it,
        hi: cat.name_hi,
        pt: cat.name_pt,
      },
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    };

    res.json({
      success: true,
      data: formattedCategory,
    });
  } catch (error) {
    logger.error('Get category by code error:', error);
    next(error);
  }
};

/**
 * Get categories by tab category
 * GET /api/categories/tab/:tabCategory
 * Query params: ?lang=tr (optional, defaults to 'en')
 */
const getCategoriesByTab = async (req, res, next) => {
  try {
    const { tabCategory } = req.params;
    const lang = req.query.lang || 'en';

    const categories = await db.query(
      `SELECT 
        id,
        category_code as categoryCode,
        tab_category as tabCategory,
        category_image_url as categoryImageURL,
        name_tr,
        name_en,
        name_de,
        name_ar,
        name_fr,
        name_ko,
        name_ja,
        name_es,
        name_it,
        name_hi,
        name_pt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM categories
      WHERE tab_category = ?
      ORDER BY id ASC`,
      [tabCategory]
    );

    // Format response with multi-language name object
    const formattedCategories = categories.map((cat) => ({
      id: cat.id,
      categoryCode: cat.categoryCode,
      tabCategory: cat.tabCategory,
      categoryImageURL: cat.categoryImageURL,
      name: {
        tr: cat.name_tr,
        en: cat.name_en,
        de: cat.name_de,
        ar: cat.name_ar,
        fr: cat.name_fr,
        ko: cat.name_ko,
        ja: cat.name_ja,
        es: cat.name_es,
        it: cat.name_it,
        hi: cat.name_hi,
        pt: cat.name_pt,
      },
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));

    res.json({
      success: true,
      data: formattedCategories,
      count: formattedCategories.length,
    });
  } catch (error) {
    logger.error('Get categories by tab error:', error);
    next(error);
  }
};

/**
 * Get all tab categories
 * GET /api/categories/tabs
 * Query params: ?lang=tr (optional, defaults to 'en')
 * 
 * Note: This endpoint returns tab categories from the tab_categories table
 * For just tab category codes (string array), use the old behavior by adding ?codesOnly=true
 */
const getTabCategories = async (req, res, next) => {
  try {
    const lang = req.query.lang || 'en';
    const codesOnly = req.query.codesOnly === 'true'; // Backward compatibility
    const onlyActive = req.query.active !== 'false'; // Default: only active

    // If codesOnly is true, return old behavior (just string array)
    if (codesOnly) {
      const tabs = await db.query(
        `SELECT DISTINCT tab_category as tabCategory
        FROM categories
        ORDER BY tab_category ASC`
      );

      const tabCategories = tabs.map((tab) => tab.tabCategory);

      return res.json({
        success: true,
        data: tabCategories,
        count: tabCategories.length,
      });
    }

    // Otherwise, return full tab category objects from tab_categories table
    let query = `
      SELECT 
        id,
        tab_category_code as tabCategoryCode,
        tab_category_image_url as tabCategoryImageURL,
        \`order\`,
        is_active as isActive,
        name_tr,
        name_en,
        name_de,
        name_ar,
        name_fr,
        name_ko,
        name_ja,
        name_es,
        name_it,
        name_hi,
        name_pt,
        description_tr,
        description_en,
        description_de,
        description_ar,
        description_fr,
        description_ko,
        description_ja,
        description_es,
        description_it,
        description_hi,
        description_pt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM tab_categories
      WHERE 1=1
    `;

    if (onlyActive) {
      query += ' AND is_active = TRUE';
    }

    query += ' ORDER BY `order` ASC, id ASC';

    const tabCategories = await db.query(query);

    // Format response with multi-language name and description objects
    const formattedTabCategories = tabCategories.map((tab) => ({
      id: tab.id,
      tabCategoryCode: tab.tabCategoryCode,
      tabCategoryImageURL: tab.tabCategoryImageURL,
      order: tab.order,
      isActive: tab.isActive === 1 || tab.isActive === true,
      name: {
        tr: tab.name_tr,
        en: tab.name_en,
        de: tab.name_de,
        ar: tab.name_ar,
        fr: tab.name_fr,
        ko: tab.name_ko,
        ja: tab.name_ja,
        es: tab.name_es,
        it: tab.name_it,
        hi: tab.name_hi,
        pt: tab.name_pt,
      },
      description: {
        tr: tab.description_tr,
        en: tab.description_en,
        de: tab.description_de,
        ar: tab.description_ar,
        fr: tab.description_fr,
        ko: tab.description_ko,
        ja: tab.description_ja,
        es: tab.description_es,
        it: tab.description_it,
        hi: tab.description_hi,
        pt: tab.description_pt,
      },
      createdAt: tab.createdAt,
      updatedAt: tab.updatedAt,
    }));

    res.json({
      success: true,
      data: formattedTabCategories,
      count: formattedTabCategories.length,
    });
  } catch (error) {
    logger.error('Get tab categories error:', error);
    next(error);
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  getCategoryByCode,
  getCategoriesByTab,
  getTabCategories,
};
