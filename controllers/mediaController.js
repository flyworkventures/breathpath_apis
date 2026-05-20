/**
 * Exercise media upload — Bunny CDN via API (panel has no direct CDN access).
 */

const logger = require('../utils/logger');
const {
  uploadExerciseVideo,
  uploadExerciseImage,
} = require('../utils/bunnyCDN');
const { CONTRACT_VERSION } = require('../utils/panelMappers');

function uploadSuccessPayload(url, kind, file) {
  return {
    url,
    kind,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  };
}

/**
 * POST multipart field: video
 */
const uploadExerciseVideoHandler = async (req, res, next) => {
  try {
    const url = await uploadExerciseVideo(
      req.file.buffer,
      req.file.originalname
    );

    logger.info(`Exercise video uploaded: ${url}`);

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      data: uploadSuccessPayload(url, 'video', req.file),
    });
  } catch (error) {
    logger.error('Exercise video upload error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Video upload failed',
      code: 'UPLOAD_FAILED',
    });
  }
};

/**
 * POST multipart field: image (cover / thumbnail)
 */
const uploadExerciseImageHandler = async (req, res, next) => {
  try {
    const url = await uploadExerciseImage(
      req.file.buffer,
      req.file.originalname
    );

    logger.info(`Exercise image uploaded: ${url}`);

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: uploadSuccessPayload(url, 'image', req.file),
    });
  } catch (error) {
    logger.error('Exercise image upload error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Image upload failed',
      code: 'UPLOAD_FAILED',
    });
  }
};

/** Panel contract shape (same payload, v2 wrapper) */
const uploadExerciseVideoPanel = async (req, res, next) => {
  try {
    const url = await uploadExerciseVideo(
      req.file.buffer,
      req.file.originalname
    );
    res.status(201).json({
      contractVersion: CONTRACT_VERSION,
      data: uploadSuccessPayload(url, 'video', req.file),
    });
  } catch (error) {
    logger.error('Panel exercise video upload error:', error);
    res.status(400).json({
      error: 'UPLOAD_FAILED',
      message: error.message || 'Video upload failed',
    });
  }
};

const uploadExerciseImagePanel = async (req, res, next) => {
  try {
    const url = await uploadExerciseImage(
      req.file.buffer,
      req.file.originalname
    );
    res.status(201).json({
      contractVersion: CONTRACT_VERSION,
      data: uploadSuccessPayload(url, 'image', req.file),
    });
  } catch (error) {
    logger.error('Panel exercise image upload error:', error);
    res.status(400).json({
      error: 'UPLOAD_FAILED',
      message: error.message || 'Image upload failed',
    });
  }
};

module.exports = {
  uploadExerciseVideoHandler,
  uploadExerciseImageHandler,
  uploadExerciseVideoPanel,
  uploadExerciseImagePanel,
};
