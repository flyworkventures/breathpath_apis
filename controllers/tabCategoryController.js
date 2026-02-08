/**
 * Tab Category Controller
 * Handles tab category-related operations
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all tab categories
 * GET /api/tab-categories
 * Query params: ?lang=tr (optional, defaults to 'en')
 */
const getTabCategories = async (req, res, next) => {
  try {
    const lang = req.query.lang || 'en';
    const onlyActive = req.query.active !== 'false'; // Default: only active

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

/**
 * Get tab category by ID
 * GET /api/tab-categories/:id
 * Query params: ?lang=tr (optional, defaults to 'en')
 */
const getTabCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lang = req.query.lang || 'en';

    const tabCategories = await db.query(
      `SELECT 
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
      WHERE id = ?`,
      [id]
    );

    if (!tabCategories || tabCategories.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tab category not found',
        code: 'TAB_CATEGORY_NOT_FOUND',
      });
    }

    const tab = tabCategories[0];

    // Format response with multi-language name and description objects
    const formattedTabCategory = {
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
    };

    res.json({
      success: true,
      data: formattedTabCategory,
    });
  } catch (error) {
    logger.error('Get tab category by ID error:', error);
    next(error);
  }
};

/**
 * Get tab category by code
 * GET /api/tab-categories/code/:code
 * Query params: ?lang=tr (optional, defaults to 'en')
 */
const getTabCategoryByCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    const lang = req.query.lang || 'en';

    const tabCategories = await db.query(
      `SELECT 
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
      WHERE tab_category_code = ? AND is_active = TRUE`,
      [code]
    );

    if (!tabCategories || tabCategories.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tab category not found',
        code: 'TAB_CATEGORY_NOT_FOUND',
      });
    }

    const tab = tabCategories[0];

    // Format response with multi-language name and description objects
    const formattedTabCategory = {
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
    };

    res.json({
      success: true,
      data: formattedTabCategory,
    });
  } catch (error) {
    logger.error('Get tab category by code error:', error);
    next(error);
  }
};

module.exports = {
  getTabCategories,
  getTabCategoryById,
  getTabCategoryByCode,
};
