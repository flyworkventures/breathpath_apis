/**
 * Tab Category Routes
 */

const express = require('express');
const router = express.Router();
const tabCategoryController = require('../controllers/tabCategoryController');

// Public routes
// IMPORTANT: Specific routes must come before parameterized routes
router.get('/code/:code', tabCategoryController.getTabCategoryByCode);
router.get('/:id', tabCategoryController.getTabCategoryById);
router.get('/', tabCategoryController.getTabCategories);

module.exports = router;
