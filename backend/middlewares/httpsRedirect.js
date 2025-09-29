/**
 * HTTPS redirect middleware
 * Redirects HTTP requests to HTTPS in production when FORCE_HTTPS or config indicates
 */
function forceHttps(req, res, next) {
  // If already secure, pass through
  if (req.secure || req.get('X-Forwarded-Proto') === 'https') {
    return next();
  }

  // Only redirect in production environment
  if (process.env.NODE_ENV === 'production') {
    const host = req.get('Host') || req.hostname;
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }

  next();
}

module.exports = { forceHttps };
