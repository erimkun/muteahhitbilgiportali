const rateLimit = require('express-rate-limit');
const config = require('../config/env');

/**
 * Rate limiter for authentication routes to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  standardHeaders: config.rateLimit.auth.standardHeaders,
  legacyHeaders: config.rateLimit.auth.legacyHeaders,
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  // Skip successful requests
  skip: (req, res) => res.statusCode < 400,
});

/**
 * General API rate limiter for regular API endpoints
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many API requests, please try again later.'
  }
});

/**
 * Strict rate limiter for sensitive operations like file uploads
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 uploads per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many upload requests, please try again later.'
  }
});

module.exports = {
  authLimiter,
  apiLimiter,
  uploadLimiter
};