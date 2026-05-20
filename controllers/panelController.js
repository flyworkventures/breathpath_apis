/**
 * App Panel API — canonical contract v2 handlers.
 * Prefix: /panel (does not use mobile JWT).
 */

const panelService = require('../services/panelService');
const { CONTRACT_VERSION } = require('../utils/panelMappers');
const logger = require('../utils/logger');

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit };
}

const health = (req, res) => {
  res.json({
    ok: true,
    service: 'breathpath-api',
    contractVersion: CONTRACT_VERSION,
  });
};

const analyse = async (req, res, next) => {
  try {
    const payload = await panelService.getAnalyse();
    res.json({
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      timezone: panelService.getTimezone(),
      summary: payload.summary,
      daily: payload.daily,
      ...(payload.workoutsSummary ? { workoutsSummary: payload.workoutsSummary } : {}),
    });
  } catch (error) {
    logger.error('Panel analyse error:', error);
    next(error);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await panelService.listUsers({
      page,
      limit,
      search: req.query.search?.trim() || '',
    });
    res.json({
      contractVersion: CONTRACT_VERSION,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Panel list users error:', error);
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await panelService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found',
      });
    }
    res.json({ contractVersion: CONTRACT_VERSION, data: user });
  } catch (error) {
    logger.error('Panel get user error:', error);
    next(error);
  }
};

const patchUser = async (req, res, next) => {
  try {
    const user = await panelService.patchUser(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User not found',
      });
    }
    res.json({ contractVersion: CONTRACT_VERSION, data: user });
  } catch (error) {
    logger.error('Panel patch user error:', error);
    next(error);
  }
};

const listWorkouts = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await panelService.listWorkouts({
      page,
      limit,
      search: req.query.search?.trim() || '',
      status: req.query.status,
      category: req.query.category,
      difficulty: req.query.difficulty,
    });
    res.json({
      contractVersion: CONTRACT_VERSION,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    logger.error('Panel list workouts error:', error);
    next(error);
  }
};

const getWorkout = async (req, res, next) => {
  try {
    const workout = await panelService.getWorkoutById(req.params.id);
    if (!workout) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Workout not found',
      });
    }
    res.json({ contractVersion: CONTRACT_VERSION, data: workout });
  } catch (error) {
    logger.error('Panel get workout error:', error);
    next(error);
  }
};

const createWorkout = async (req, res, next) => {
  try {
    const workout = await panelService.createWorkout(req.body);
    res.status(201).json({ contractVersion: CONTRACT_VERSION, data: workout });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    logger.error('Panel create workout error:', error);
    next(error);
  }
};

const patchWorkout = async (req, res, next) => {
  try {
    const workout = await panelService.patchWorkout(req.params.id, req.body);
    if (!workout) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Workout not found',
      });
    }
    res.json({ contractVersion: CONTRACT_VERSION, data: workout });
  } catch (error) {
    logger.error('Panel patch workout error:', error);
    next(error);
  }
};

const deleteWorkout = async (req, res, next) => {
  try {
    const ok = await panelService.deleteWorkout(req.params.id);
    if (!ok) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Workout not found',
      });
    }
    res.json({
      contractVersion: CONTRACT_VERSION,
      ok: true,
      message: 'Workout archived or deleted',
    });
  } catch (error) {
    logger.error('Panel delete workout error:', error);
    next(error);
  }
};

const listUserWorkouts = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await panelService.listUserWorkouts({
      page,
      limit,
      userId: req.query.userId,
      workoutId: req.query.workoutId,
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
    });
    res.json({
      contractVersion: CONTRACT_VERSION,
      data: result.data,
      pagination: result.pagination,
      ...(result.note ? { note: result.note } : {}),
    });
  } catch (error) {
    logger.error('Panel list user-workouts error:', error);
    next(error);
  }
};

const listUserWorkoutsForUser = async (req, res, next) => {
  req.query.userId = req.params.userId;
  return listUserWorkouts(req, res, next);
};

const getUserWorkout = async (req, res, next) => {
  try {
    const row = await panelService.getUserWorkoutById(req.params.id);
    if (!row) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User workout session not found',
      });
    }
    res.json({ contractVersion: CONTRACT_VERSION, data: row });
  } catch (error) {
    logger.error('Panel get user-workout error:', error);
    next(error);
  }
};

module.exports = {
  health,
  analyse,
  listUsers,
  getUser,
  patchUser,
  listWorkouts,
  getWorkout,
  createWorkout,
  patchWorkout,
  deleteWorkout,
  listUserWorkouts,
  listUserWorkoutsForUser,
  getUserWorkout,
};
