/**
 * Multipart upload for panel / admin exercise media (video + cover image).
 */

const multer = require('multer');
const path = require('path');
const {
  validateExerciseImageFile,
  validateExerciseVideoFile,
} = require('../utils/bunnyCDN');

const storage = multer.memoryStorage();

function createUploadHandler({ fieldName, maxMb, validateFn, allowedLabel }) {
  const upload = multer({
    storage,
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const probe = { mimetype: file.mimetype, originalname: file.originalname, size: 1024 };
      if (validateFn(probe) || ext) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed: ${allowedLabel}`), false);
      }
    },
  }).single(fieldName);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: `File too large. Maximum size is ${maxMb}MB.`,
            code: 'FILE_TOO_LARGE',
          });
        }
        return res.status(400).json({
          success: false,
          error: err.message,
          code: 'UPLOAD_ERROR',
        });
      }
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
          code: 'UPLOAD_ERROR',
        });
      }
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: `No file uploaded. Use multipart/form-data field name "${fieldName}"`,
          code: 'NO_FILE',
        });
      }
      if (!validateFn(req.file)) {
        return res.status(400).json({
          success: false,
          error: `Invalid file. Allowed: ${allowedLabel}, max ${maxMb}MB`,
          code: 'INVALID_FILE',
          details: {
            mimetype: req.file.mimetype,
            size: req.file.size,
            originalname: req.file.originalname,
          },
        });
      }
      next();
    });
  };
}

const videoMaxMb = parseInt(process.env.PANEL_VIDEO_MAX_MB, 10) || 150;
const imageMaxMb = parseInt(process.env.PANEL_IMAGE_MAX_MB, 10) || 10;

const handleExerciseVideoUpload = createUploadHandler({
  fieldName: 'video',
  maxMb: videoMaxMb,
  validateFn: validateExerciseVideoFile,
  allowedLabel: 'MP4, MOV, WEBM, M4V',
});

const handleExerciseImageUpload = createUploadHandler({
  fieldName: 'image',
  maxMb: imageMaxMb,
  validateFn: validateExerciseImageFile,
  allowedLabel: 'JPEG, PNG, GIF, WebP',
});

module.exports = {
  handleExerciseVideoUpload,
  handleExerciseImageUpload,
};
