/**
 * Mood Routes
 */

const express = require('express');
const router = express.Router();
const moodController = require('../controllers/moodController');
const { authenticate } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// All mood routes require authentication
router.use(authenticate);

// Create or update mood entry
router.post('/', apiLimiter, moodController.createMood);

// Get today's mood
router.get('/today', apiLimiter, moodController.getTodayMood);

// Check if mood section should be shown (24 hour check)
router.get('/should-show', apiLimiter, moodController.shouldShowMoodSection);

// Get all moods or moods within date range
router.get('/', apiLimiter, moodController.getMoods);

module.exports = router;
