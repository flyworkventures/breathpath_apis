/**
 * App Panel routes — isolated from mobile /api/*
 */

const express = require('express');
const router = express.Router();
const { panelAuth } = require('../middleware/panelAuth');
const {
  handleExerciseVideoUpload,
  handleExerciseImageUpload,
} = require('../middleware/panelUpload');
const panelController = require('../controllers/panelController');
const mediaController = require('../controllers/mediaController');

router.use(panelAuth);

router.get('/health', panelController.health);

// Media upload → returns CDN URL (panel has no direct Bunny access)
router.post(
  '/media/video',
  handleExerciseVideoUpload,
  mediaController.uploadExerciseVideoPanel
);
router.post(
  '/media/image',
  handleExerciseImageUpload,
  mediaController.uploadExerciseImagePanel
);
router.get('/analyse', panelController.analyse);

router.get('/users', panelController.listUsers);
router.get('/users/:id', panelController.getUser);
router.patch('/users/:id', panelController.patchUser);

router.get('/workouts', panelController.listWorkouts);
router.post('/workouts', panelController.createWorkout);
router.get('/workouts/:id', panelController.getWorkout);
router.patch('/workouts/:id', panelController.patchWorkout);
router.delete('/workouts/:id', panelController.deleteWorkout);

router.get('/user-workouts', panelController.listUserWorkouts);
router.get('/users/:userId/workouts', panelController.listUserWorkoutsForUser);
router.get('/user-workouts/:id', panelController.getUserWorkout);

router.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.code || 'INTERNAL_ERROR',
    message: err.message || 'Internal server error',
  });
});

module.exports = router;
