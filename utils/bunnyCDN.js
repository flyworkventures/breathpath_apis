/**
 * Bunny CDN Storage Utility
 * Handles file uploads to Bunny CDN Storage
 */

const axios = require('axios');
const path = require('path');
const logger = require('./logger');

function buildCdnPublicUrl(storagePath, remotePath) {
  if (storagePath && storagePath.trim()) {
    const cleanStoragePath = storagePath.trim().replace(/\/$/, '');
    return `https://${cleanStoragePath}/${remotePath}`;
  }
  const pullZone = process.env.BUNNY_PULL_ZONE || process.env.BUNNY_STORAGE_ZONE_NAME;
  const cleanPullZone = String(pullZone).replace(/\.b-cdn\.net.*$/, '').split('/')[0];
  return `https://${cleanPullZone}.b-cdn.net/${remotePath}`;
}

/**
 * Upload file to Bunny CDN Storage
 * @param {Buffer} fileBuffer
 * @param {string} fileName
 * @param {{ folder?: string, namePrefix?: string }} options
 * @returns {Promise<string>} Public CDN URL
 */
async function uploadFileToCdn(fileBuffer, fileName, options = {}) {
  const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
  const storageZonePassword = process.env.BUNNY_STORAGE_ZONE_PASSWORD;
  const storagePath = process.env.BUNNY_STORAGE_PATH || '';
  const folder = (options.folder || 'profiles').replace(/^\/+|\/+$/g, '');
  const namePrefix = (options.namePrefix || 'file').replace(/[^a-zA-Z0-9-_]/g, '_');

  if (!storageZoneName || !storageZonePassword) {
    throw new Error('Bunny CDN credentials not configured');
  }
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('Invalid file buffer');
  }

  const fileExtension = path.extname(fileName || '') || '';
  const sanitizedFileName = `${namePrefix}-${Date.now()}${fileExtension}`;
  const remotePath = `${folder}/${sanitizedFileName}`;
  const uploadUrl = `https://storage.bunnycdn.com/${storageZoneName}/${remotePath}`;
  const contentType = getContentType(fileExtension);

  logger.info(`Uploading to Bunny CDN: ${uploadUrl} (${fileBuffer.length} bytes)`);

  try {
    await axios.put(uploadUrl, fileBuffer, {
      headers: {
        AccessKey: storageZonePassword,
        'Content-Type': contentType,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: (status) => status >= 200 && status < 300,
    });
  } catch (error) {
    if (error.response) {
      const errorData = typeof error.response.data === 'string'
        ? error.response.data
        : JSON.stringify(error.response.data);
      throw new Error(
        `Bunny CDN upload failed: ${error.response.status} ${error.response.statusText} - ${errorData}`
      );
    }
    if (error.request) {
      throw new Error('Bunny CDN upload failed: No response from server');
    }
    throw new Error(`Failed to upload file to Bunny CDN: ${error.message}`);
  }

  const cdnUrl = buildCdnPublicUrl(storagePath, remotePath);
  logger.info(`File uploaded to Bunny CDN: ${cdnUrl}`);
  return cdnUrl;
}

/**
 * Profile photo upload (mobile)
 */
async function uploadFile(fileBuffer, fileName, uid) {
  const sanitizedUid = uid.replace(/[^a-zA-Z0-9-_]/g, '_');
  return uploadFileToCdn(fileBuffer, fileName, {
    folder: 'profiles',
    namePrefix: sanitizedUid,
  });
}

/**
 * Delete file from Bunny CDN Storage
 * @param {string} fileUrl - Full CDN URL of the file to delete
 * @returns {Promise<boolean>} Success status
 */
async function deleteFile(fileUrl) {
  try {
    const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
    const storageZonePassword = process.env.BUNNY_STORAGE_ZONE_PASSWORD;

    if (!storageZoneName || !storageZonePassword) {
      throw new Error('Bunny CDN credentials not configured');
    }

    // Extract file path from CDN URL
    // URL format: https://{storage-path}/profiles/{filename}
    // Example: https://breathpath.b-cdn.net/profiles/filename.png
    try {
      const urlObj = new URL(fileUrl);
      // Get the path after domain
      // Path will be: /profiles/filename.png
      const urlPath = urlObj.pathname;
      
      // Remove leading / to get: profiles/filename.png
      const remotePath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
      
      logger.info(`Deleting file from Bunny CDN: ${remotePath}`);
      
      const deleteUrl = `https://storage.bunnycdn.com/${storageZoneName}/${remotePath}`;

      const response = await axios.delete(deleteUrl, {
        headers: {
          'AccessKey': storageZonePassword,
        },
      });

      if (response.status === 200 || response.status === 204) {
        logger.info(`File deleted from Bunny CDN: ${fileUrl}`);
        return true;
      }

      return false;
    } catch (urlError) {
      logger.error('Error parsing CDN URL:', urlError);
      // Don't throw error, just log it (file might not exist or URL format changed)
      return false;
    }
  } catch (error) {
    logger.error('Bunny CDN delete error:', error);
    // Don't throw error, just log it (file might not exist)
    return false;
  }
}

/**
 * Get content type based on file extension
 * @param {string} extension - File extension
 * @returns {string} MIME type
 */
function getContentType(extension) {
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.m4v': 'video/x-m4v',
  };

  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
}

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v'];

function isAllowedFile(file, { mimeTypes, extensions }) {
  if (!file) return false;
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = file.mimetype?.toLowerCase();
  return mimeTypes.includes(mime) || extensions.includes(ext);
}

function validateExerciseImageFile(file) {
  const maxSize =
    (parseInt(process.env.PANEL_IMAGE_MAX_MB, 10) || 10) * 1024 * 1024;
  if (!file || file.size > maxSize) return false;
  return isAllowedFile(file, {
    mimeTypes: IMAGE_MIME_TYPES,
    extensions: IMAGE_EXTENSIONS,
  });
}

function validateExerciseVideoFile(file) {
  const maxSize =
    (parseInt(process.env.PANEL_VIDEO_MAX_MB, 10) || 150) * 1024 * 1024;
  if (!file || file.size > maxSize) return false;
  return isAllowedFile(file, {
    mimeTypes: VIDEO_MIME_TYPES,
    extensions: VIDEO_EXTENSIONS,
  });
}

async function uploadExerciseVideo(fileBuffer, fileName) {
  return uploadFileToCdn(fileBuffer, fileName, {
    folder: 'exercises/videos',
    namePrefix: 'video',
  });
}

async function uploadExerciseImage(fileBuffer, fileName) {
  return uploadFileToCdn(fileBuffer, fileName, {
    folder: 'exercises/images',
    namePrefix: 'cover',
  });
}

/**
 * Validate image file
 * @param {Object} file - Multer file object
 * @returns {boolean} Is valid image
 */
function validateImageFile(file) {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!file) {
    return false;
  }

  // Check file size
  if (file.size > maxSize) {
    console.log('File size validation failed:', file.size, 'bytes');
    return false;
  }

  // Check MIME type or file extension (Flutter sometimes sends application/octet-stream)
  const path = require('path');
  const fileExtension = path.extname(file.originalname || '').toLowerCase();
  const isValidMimeType = allowedMimeTypes.includes(file.mimetype?.toLowerCase());
  const isValidExtension = allowedExtensions.includes(fileExtension);

  console.log('validateImageFile check:', {
    mimetype: file.mimetype,
    extension: fileExtension,
    isValidMimeType,
    isValidExtension,
    size: file.size,
  });

  // Accept if either MIME type or extension is valid
  if (!isValidMimeType && !isValidExtension) {
    console.log('File validation failed: neither MIME type nor extension is valid');
    return false;
  }

  return true;
}

module.exports = {
  uploadFile,
  uploadFileToCdn,
  uploadExerciseVideo,
  uploadExerciseImage,
  deleteFile,
  validateImageFile,
  validateExerciseImageFile,
  validateExerciseVideoFile,
  getContentType,
};
