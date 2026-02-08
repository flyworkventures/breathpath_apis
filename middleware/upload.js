/**
 * File Upload Middleware
 * Handles multipart/form-data file uploads
 */

const multer = require('multer');
const { validateImageFile } = require('../utils/bunnyCDN');

// Configure multer for memory storage (we'll upload directly to Bunny CDN)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    // Get file extension from originalname
    const path = require('path');
    const fileExtension = path.extname(file.originalname || '').toLowerCase();
    
    // Check both MIME type and file extension (Flutter sometimes sends wrong MIME type)
    const isValidMimeType = allowedMimeTypes.includes(file.mimetype?.toLowerCase());
    const isValidExtension = allowedExtensions.includes(fileExtension);
    
    console.log('File filter check:', {
      mimetype: file.mimetype,
      originalname: file.originalname,
      extension: fileExtension,
      isValidMimeType,
      isValidExtension,
    });
    
    if (isValidMimeType || isValidExtension) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed. Received: ${file.mimetype || 'unknown'}, extension: ${fileExtension || 'none'}`), false);
    }
  },
});

/**
 * Middleware to handle single file upload
 */
const uploadSingle = upload.single('photo');

/**
 * Middleware wrapper with error handling
 */
const handleFileUpload = (req, res, next) => {
  // Log request details for debugging
  console.log('File upload middleware - Content-Type:', req.headers['content-type']);
  console.log('File upload middleware - Body keys:', Object.keys(req.body || {}));
  
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err.code, err.message);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 5MB.',
          code: 'FILE_TOO_LARGE',
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field. Expected field name: "photo"',
          code: 'INVALID_FIELD_NAME',
        });
      }
      if (err.code === 'LIMIT_PART_COUNT') {
        return res.status(400).json({
          success: false,
          error: 'Too many parts in the request',
          code: 'TOO_MANY_PARTS',
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message || 'File upload error',
        code: 'UPLOAD_ERROR',
        details: {
          multerErrorCode: err.code,
        },
      });
    } else if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'File upload error',
        code: 'UPLOAD_ERROR',
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please send a file with field name "photo" using multipart/form-data',
        code: 'NO_FILE',
        hint: 'Make sure to use Content-Type: multipart/form-data and field name "photo"',
      });
    }

    console.log('File received:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Validate uploaded file
    if (!validateImageFile(req.file)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file. Only images (JPEG, PNG, GIF, WebP) up to 5MB are allowed.',
        code: 'INVALID_FILE',
        details: {
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
      });
    }

    next();
  });
};

module.exports = {
  handleFileUpload,
};
