/**
 * App Panel authentication — separate from mobile JWT.
 * Header: X-Panel-Api-Key (also accepts X-Panel-Key, Authorization: Bearer)
 */

const logger = require('../utils/logger');

function getProvidedKey(req) {
  const headerKey =
    req.headers['x-panel-api-key'] ||
    req.headers['x-panel-key'];
  if (headerKey) return String(headerKey).trim();

  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

function isIpAllowed(req) {
  const allowed = process.env.PANEL_ALLOWED_IPS;
  if (!allowed || !allowed.trim()) return true;

  const clientIp = (req.ip || '').replace(/^::ffff:/, '');
  const list = allowed.split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(clientIp);
}

function panelAuth(req, res, next) {
  if (process.env.PANEL_API_ENABLED === 'false') {
    return res.status(404).json({
      error: 'PANEL_DISABLED',
      message: 'Panel API is disabled on this server',
    });
  }

  const expectedKey = process.env.PANEL_API_KEY;
  if (!expectedKey) {
    logger.error('PANEL_API_KEY is not configured');
    return res.status(503).json({
      error: 'PANEL_NOT_CONFIGURED',
      message: 'Panel API is not configured',
    });
  }

  if (!isIpAllowed(req)) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'IP address is not allowed for panel access',
    });
  }

  const provided = getProvidedKey(req);
  if (!provided || provided !== expectedKey) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Invalid or missing panel API key',
    });
  }

  next();
}

module.exports = { panelAuth };
