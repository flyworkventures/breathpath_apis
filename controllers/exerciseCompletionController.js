/**
 * Exercise Completion Controller
 * Handles exercise completion and statistics tracking
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Complete an exercise
 * POST /api/exercises/complete
 * Body: { exerciseId: number }
 */
const completeExercise = async (req, res, next) => {
  try {
    const { exerciseId } = req.body;
    const { uid } = req.user;

    // Validate exerciseId
    if (!exerciseId || isNaN(parseInt(exerciseId))) {
      return res.status(400).json({
        success: false,
        error: 'Valid exercise ID is required',
        code: 'INVALID_EXERCISE_ID',
      });
    }

    const exerciseIdInt = parseInt(exerciseId);

    // Check if exercise exists and get duration
    const exercises = await db.query(
      'SELECT id, duration FROM exercises WHERE id = ?',
      [exerciseIdInt]
    );

    if (exercises.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Exercise not found',
        code: 'EXERCISE_NOT_FOUND',
      });
    }

    const exercise = exercises[0];
    const exerciseDuration = exercise.duration || 0;

    // Get user's current statistics
    const users = await db.query(
      `SELECT 
        total_exercise_time,
        completed_exercises_count,
        current_streak,
        last_exercise_date
      FROM users 
      WHERE uid = ?`,
      [uid]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const user = users[0];
    const currentTotalTime = user.total_exercise_time || 0;
    const currentCompletedCount = user.completed_exercises_count || 0;
    const currentStreak = user.current_streak || 0;
    const lastExerciseDate = user.last_exercise_date;

    // Calculate new statistics
    const newTotalTime = currentTotalTime + exerciseDuration;
    const newCompletedCount = currentCompletedCount + 1;

    // Calculate streak
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day
    
    let newStreak = currentStreak;
    let newLastExerciseDate = today;

    if (lastExerciseDate) {
      const lastDate = new Date(lastExerciseDate);
      lastDate.setHours(0, 0, 0, 0);
      
      const daysDifference = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

      if (daysDifference === 0) {
        // Same day - don't increase streak, don't update date
        newLastExerciseDate = lastExerciseDate;
        newStreak = currentStreak; // Keep current streak
      } else if (daysDifference === 1) {
        // Consecutive day - increase streak
        newStreak = currentStreak + 1;
      } else {
        // Streak broken - reset to 1
        newStreak = 1;
      }
    } else {
      // First exercise ever - start streak at 1
      newStreak = 1;
    }

    // Update user statistics
    await db.query(
      `UPDATE users 
      SET 
        total_exercise_time = ?,
        completed_exercises_count = ?,
        current_streak = ?,
        last_exercise_date = ?
      WHERE uid = ?`,
      [newTotalTime, newCompletedCount, newStreak, newLastExerciseDate, uid]
    );

    logger.info(`User ${uid} completed exercise ${exerciseIdInt}. Stats: time=${newTotalTime}s, count=${newCompletedCount}, streak=${newStreak}`);

    res.json({
      success: true,
      message: 'Exercise completed successfully',
      data: {
        exerciseId: exerciseIdInt,
        exerciseDuration: exerciseDuration,
        statistics: {
          totalExerciseTime: newTotalTime,
          completedExercisesCount: newCompletedCount,
          currentStreak: newStreak,
          lastExerciseDate: newLastExerciseDate,
        },
      },
    });
  } catch (error) {
    logger.error('Complete exercise error:', error);
    next(error);
  }
};

/**
 * Get user's exercise statistics
 * GET /api/exercises/stats
 */
const getExerciseStats = async (req, res, next) => {
  try {
    const { uid } = req.user;

    // Get user's statistics
    const users = await db.query(
      `SELECT 
        total_exercise_time,
        completed_exercises_count,
        current_streak,
        last_exercise_date
      FROM users 
      WHERE uid = ?`,
      [uid]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const user = users[0];

    res.json({
      success: true,
      data: {
        totalExerciseTime: user.total_exercise_time || 0,
        completedExercisesCount: user.completed_exercises_count || 0,
        currentStreak: user.current_streak || 0,
        lastExerciseDate: user.last_exercise_date || null,
      },
    });
  } catch (error) {
    logger.error('Get exercise stats error:', error);
    next(error);
  }
};

module.exports = {
  completeExercise,
  getExerciseStats,
};
