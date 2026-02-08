/**
 * Mood Controller
 * Handles daily mood entries for users
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Create or update mood entry
 * POST /api/moods
 * Date is automatically set to today's date
 */
const createMood = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { mood } = req.body;

    // Validate required fields
    if (mood === undefined || mood === null) {
      return res.status(400).json({
        success: false,
        error: 'mood is required',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate mood value (1-5 scale)
    if (!Number.isInteger(mood) || mood < 1 || mood > 5) {
      return res.status(400).json({
        success: false,
        error: 'mood must be an integer between 1 and 5',
        code: 'VALIDATION_ERROR',
      });
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Check if mood entry already exists for today
    const existingMoods = await db.query(
      'SELECT * FROM moods WHERE uid = ? AND date = ?',
      [uid, today]
    );

    let result;
    if (existingMoods && existingMoods.length > 0) {
      // Update existing mood
      await db.query(
        'UPDATE moods SET mood = ?, updated_at = NOW() WHERE uid = ? AND date = ?',
        [mood, uid, today]
      );
      result = { ...existingMoods[0], mood };
      logger.info(`Mood updated for user ${uid} on ${today}`);
    } else {
      // Create new mood entry
      const insertResult = await db.query(
        'INSERT INTO moods (uid, date, mood) VALUES (?, ?, ?)',
        [uid, today, mood]
      );
      const newMoods = await db.query(
        'SELECT * FROM moods WHERE id = ?',
        [insertResult.insertId]
      );
      result = newMoods[0];
      logger.info(`Mood created for user ${uid} on ${today}`);
    }

    res.status(200).json({
      success: true,
      data: {
        id: result.id,
        uid: result.uid,
        date: result.date,
        mood: result.mood,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      },
    });
  } catch (error) {
    logger.error('Create mood error:', error);
    next(error);
  }
};

/**
 * Get today's mood
 * GET /api/moods/today
 */
const getTodayMood = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const moods = await db.query(
      'SELECT * FROM moods WHERE uid = ? AND date = ?',
      [uid, today]
    );

    if (!moods || moods.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No mood entry for today',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: moods[0].id,
        uid: moods[0].uid,
        date: moods[0].date,
        mood: moods[0].mood,
        createdAt: moods[0].created_at,
        updatedAt: moods[0].updated_at,
      },
    });
  } catch (error) {
    logger.error('Get today mood error:', error);
    next(error);
  }
};

/**
 * Get all moods or moods within date range
 * GET /api/moods?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
const getMoods = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { startDate, endDate } = req.query;

    let query = 'SELECT * FROM moods WHERE uid = ?';
    const params = [uid];

    if (startDate && endDate) {
      // Validate date formats
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate must be in YYYY-MM-DD format',
          code: 'VALIDATION_ERROR',
        });
      }
      query += ' AND date >= ? AND date <= ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate)) {
        return res.status(400).json({
          success: false,
          error: 'startDate must be in YYYY-MM-DD format',
          code: 'VALIDATION_ERROR',
        });
      }
      query += ' AND date >= ?';
      params.push(startDate);
    } else if (endDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(endDate)) {
        return res.status(400).json({
          success: false,
          error: 'endDate must be in YYYY-MM-DD format',
          code: 'VALIDATION_ERROR',
        });
      }
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC';

    const moods = await db.query(query, params);

    res.status(200).json({
      success: true,
      data: moods.map((mood) => ({
        id: mood.id,
        uid: mood.uid,
        date: mood.date,
        mood: mood.mood,
        createdAt: mood.created_at,
        updatedAt: mood.updated_at,
      })),
      count: moods.length,
    });
  } catch (error) {
    logger.error('Get moods error:', error);
    next(error);
  }
};

/**
 * Check if mood section should be shown
 * Returns true if no mood entry exists in the last 24 hours
 * GET /api/moods/should-show
 */
const shouldShowMoodSection = async (req, res, next) => {
  try {
    const { uid } = req.user;

    // Get the most recent mood entry
    const recentMoods = await db.query(
      'SELECT * FROM moods WHERE uid = ? ORDER BY date DESC, created_at DESC LIMIT 1',
      [uid]
    );

    if (!recentMoods || recentMoods.length === 0) {
      // No mood entries at all, show the section
      return res.status(200).json({
        success: true,
        data: {
          shouldShow: true,
          lastEntryDate: null,
          hoursSinceLastEntry: null,
        },
      });
    }

    const lastEntry = recentMoods[0];
    const lastEntryDate = new Date(lastEntry.date);
    const now = new Date();
    
    // Calculate hours since last entry
    const hoursSinceLastEntry = (now - lastEntryDate) / (1000 * 60 * 60);

    // Show if 24 hours or more have passed
    const shouldShow = hoursSinceLastEntry >= 24;

    res.status(200).json({
      success: true,
      data: {
        shouldShow,
        lastEntryDate: lastEntry.date,
        hoursSinceLastEntry: Math.round(hoursSinceLastEntry * 100) / 100,
      },
    });
  } catch (error) {
    logger.error('Should show mood section error:', error);
    next(error);
  }
};

module.exports = {
  createMood,
  getTodayMood,
  getMoods,
  shouldShowMoodSection,
};
