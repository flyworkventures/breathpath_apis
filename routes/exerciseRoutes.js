/**
 * Exercise Routes
 */

const express = require('express');
const router = express.Router();
const exerciseController = require('../controllers/exerciseController');
const exerciseCompletionController = require('../controllers/exerciseCompletionController');
const { optionalAuth, authenticate } = require('../middleware/auth');
const { panelAuth } = require('../middleware/panelAuth');
const {
  handleExerciseVideoUpload,
  handleExerciseImageUpload,
} = require('../middleware/panelUpload');
const mediaController = require('../controllers/mediaController');

// Public routes (optional auth for premium filtering)
// IMPORTANT: Specific routes must come before parameterized routes
router.get('/free', exerciseController.getFreeExercises);
router.get('/premium', optionalAuth, exerciseController.getPremiumExercises);
router.get('/categories', exerciseController.getCategories);
router.get('/tab-categories', exerciseController.getTabCategories);
router.get('/search', optionalAuth, exerciseController.searchExercises);
router.get('/category/:category', optionalAuth, exerciseController.getExercisesByCategory);

// Exercise completion routes (require authentication)
router.post('/complete', authenticate, exerciseCompletionController.completeExercise);
router.get('/stats', authenticate, exerciseCompletionController.getExerciseStats);

// Admin media upload → CDN URL (panel key)
router.post(
  '/upload/video',
  panelAuth,
  handleExerciseVideoUpload,
  mediaController.uploadExerciseVideoHandler
);
router.post(
  '/upload/image',
  panelAuth,
  handleExerciseImageUpload,
  mediaController.uploadExerciseImageHandler
);

// Admin: create exercise (panel key — does not use mobile JWT)
router.post('/', panelAuth, exerciseController.createExercise);

// General routes
router.get('/', optionalAuth, exerciseController.getExercises);
router.get('/:id', optionalAuth, exerciseController.getExerciseById);

module.exports = router;
