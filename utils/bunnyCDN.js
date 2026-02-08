/**
 * Bunny CDN Storage Utility
 * Handles file uploads to Bunny CDN Storage
 */

const axios = require('axios');
const path = require('path');
const logger = require('./logger');

/**
 * Upload file to Bunny CDN Storage
 * @param {Buffer|Stream} fileBuffer - File buffer or stream
 * @param {string} fileName - File name (will be prefixed with user ID)
 * @param {string} uid - User ID for unique file naming
 * @returns {Promise<string>} CDN URL of uploaded file
 */
async function uploadFile(fileBuffer, fileName, uid) {
  try {
    const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
    const storageZonePassword = process.env.BUNNY_STORAGE_ZONE_PASSWORD;
    // Storage path format: BUNNY_STORAGE_PATH/profiles/filename
    // Example: breathpath.b-cdn.net/profiles/filename.png
    const storagePath = process.env.BUNNY_STORAGE_PATH || '';

    if (!storageZoneName || !storageZonePassword) {
      throw new Error('Bunny CDN credentials not configured');
    }

    // Validate file buffer
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      throw new Error('Invalid file buffer');
    }

    // Generate unique file name: {uid}-{timestamp}.{ext}
    const timestamp = Date.now();
    const fileExtension = path.extname(fileName);
    // Sanitize file name - remove special characters
    const sanitizedUid = uid.replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizedFileName = `${sanitizedUid}-${timestamp}${fileExtension}`;
    
    // Build remote path: profiles/filename
    // This is the path where file will be stored in Bunny CDN storage
    const remotePath = `profiles/${sanitizedFileName}`;

    // Bunny CDN Storage API endpoint
    // Path should NOT be URL encoded - Bunny CDN expects raw path
    const uploadUrl = `https://storage.bunnycdn.com/${storageZoneName}/${remotePath}`;

    logger.info(`Uploading to Bunny CDN: ${uploadUrl}`);
    logger.info(`File size: ${fileBuffer.length} bytes`);
    logger.info(`Remote path: ${remotePath}`);

    // Get content type based on file extension
    const contentType = getContentType(fileExtension);
    logger.info(`Uploading with Content-Type: ${contentType}`);

    // Upload file using PUT request
    let response;
    try {
      response = await axios.put(uploadUrl, fileBuffer, {
        headers: {
          'AccessKey': storageZonePassword,
          'Content-Type': contentType,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: function (status) {
          // Accept 200, 201, and 204 as success
          return status >= 200 && status < 300;
        },
      });
    } catch (axiosError) {
      logger.error('Axios error during upload:', {
        message: axiosError.message,
        response: axiosError.response ? {
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          data: axiosError.response.data,
        } : null,
      });
      throw axiosError;
    }

    logger.info(`Bunny CDN upload response status: ${response.status}`);

    // Construct CDN URL
    // URL format: https://{storage-path}/profiles/{filename}
    // Example: https://breathpath.b-cdn.net/profiles/filename.png
    let cdnUrl;
    if (storagePath && storagePath.trim()) {
      const cleanStoragePath = storagePath.trim();
      cdnUrl = `https://${cleanStoragePath}/profiles/${sanitizedFileName}`;
    } else {
      // Fallback: use pull zone if storage path not set
      const pullZone = process.env.BUNNY_PULL_ZONE || storageZoneName;
      const cleanPullZone = pullZone.replace(/\.b-cdn\.net.*$/, '').split('/')[0];
      cdnUrl = `https://${cleanPullZone}.b-cdn.net/profiles/${sanitizedFileName}`;
    }

    logger.info(`File uploaded to Bunny CDN: ${cdnUrl}`);
    logger.info(`Storage path: ${storagePath}, Remote path: ${remotePath}, File name: ${sanitizedFileName}`);

    return cdnUrl;
  } catch (error) {
    // Enhanced error logging
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const errorData = typeof error.response.data === 'string' 
        ? error.response.data 
        : JSON.stringify(error.response.data);
      
      logger.error('Bunny CDN upload error response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: errorData,
        url: uploadUrl,
      });
      
      throw new Error(`Bunny CDN upload failed: ${error.response.status} ${error.response.statusText} - ${errorData}`);
    } else if (error.request) {
      // The request was made but no response was received
      logger.error('Bunny CDN upload error - no response:', {
        message: error.message,
        url: uploadUrl,
      });
      throw new Error('Bunny CDN upload failed: No response from server. Check your network connection and Bunny CDN credentials.');
    } else {
      // Something happened in setting up the request that triggered an Error
      logger.error('Bunny CDN upload error:', {
        message: error.message,
        stack: error.stack,
        url: uploadUrl,
      });
      throw new Error(`Failed to upload file to Bunny CDN: ${error.message}`);
    }
  }
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
  };

  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
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
  deleteFile,
  validateImageFile,
  getContentType,
};
