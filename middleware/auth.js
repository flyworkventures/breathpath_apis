/**
 * Authentication Middleware
 * JWT token verification middleware
 */

const { verifyAccessToken } = require('../utils/jwt');
const logger = require('../utils/logger');

/**
 * Verify JWT token and attach user info to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify token
      const decoded = verifyAccessToken(token);
      
      // Attach user info to request
      req.user = {
        uid: decoded.uid,
        authProvider: decoded.authProvider,
      };

      next();
    } catch (error) {
      if (error.message === 'Token expired') {
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
        });
      } else if (error.message === 'Invalid token') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN',
        });
      }
      
      logger.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_FAILED',
      });
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = verifyAccessToken(token);
        req.user = {
          uid: decoded.uid,
          authProvider: decoded.authProvider,
        };
      } catch (error) {
        // Ignore errors for optional auth
        req.user = null;
      }
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth,
};
