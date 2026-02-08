/**
 * Favorite Routes
 */

const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authenticate } = require('../middleware/auth');

// All favorite routes require authentication
router.use(authenticate);

// Add exercise to favorites
router.post('/', favoriteController.addFavorite);

// Get user's favorite exercises
router.get('/', favoriteController.getFavorites);

// Check if exercise is in favorites
router.get('/check/:exerciseId', favoriteController.checkFavorite);

// Remove exercise from favorites
router.delete('/:exerciseId', favoriteController.removeFavorite);

module.exports = router;
