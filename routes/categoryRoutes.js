/**
 * Category Routes
 */

const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Public routes
// IMPORTANT: Specific routes must come before parameterized routes
router.get('/tabs', categoryController.getTabCategories);
router.get('/code/:code', categoryController.getCategoryByCode);
router.get('/tab/:tabCategory', categoryController.getCategoriesByTab);
router.get('/:id', categoryController.getCategoryById);
router.get('/', categoryController.getCategories);

module.exports = router;
