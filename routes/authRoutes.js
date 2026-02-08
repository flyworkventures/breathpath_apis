/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { handleFileUpload } = require('../middleware/upload');

// Public routes
router.post('/signin', authLimiter, authController.signin); // Unified signin (register + login)
router.post('/register', registerLimiter, authController.register); // Deprecated - use signin
router.post('/login', authLimiter, authController.login); // Deprecated - use signin
router.post('/refresh', authController.refresh);

// Protected routes
router.post('/logout', authenticate, authController.logout);
// IMPORTANT: More specific routes must come before parameterized routes
router.post('/me/photo', authenticate, handleFileUpload, authController.uploadProfilePhoto);
router.delete('/me/photo', authenticate, authController.deleteProfilePhoto);
router.delete('/me', authenticate, authController.deleteAccount);
router.get('/me', authenticate, authController.getMe);
router.patch('/me', authenticate, authController.updateProfile);

module.exports = router;
