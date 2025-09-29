const rateLimit = require('express-rate-limit');
const config = require('../config/env');

/**
 * Advanced brute-force protection for login endpoints.
 *
 * Notes:
 * - Uses an in-memory Map-based tracking by default. For production, swap to a Redis-backed store
 *   (e.g., rate-limit-redis) and pass the store instance via options.
 * - The keyGenerator uses IP + username/email when available to make brute-force tracking
 *   per-target instead of only per-IP.
 */
const createBruteForceProtection = (windowMs = 15 * 60 * 1000, maxAttempts = 5, store) => {
  const options = {
    windowMs,
    max: maxAttempts,
    // Try to skip counting obviously successful requests (note: this is heuristic)
    skip: (req, res) => res.statusCode < 400,
    keyGenerator: (req /*, res */) => {
      // Use express-rate-limit's ipKeyGenerator when available to ensure IPv6 addresses
      // are normalized correctly and don't bypass limits.
      let ipPart = '';
      if (typeof rateLimit.ipKeyGenerator === 'function') {
        try {
          ipPart = rateLimit.ipKeyGenerator(req);
        } catch (e) {
          ipPart = req.ip || (req.connection && req.connection.remoteAddress) || '';
        }
      } else {
        ipPart = req.ip || (req.connection && req.connection.remoteAddress) || '';
      }

      const username = (req.body && (req.body.username || req.body.email || req.body.phone)) || '';
      return `${ipPart}-${username}`;
    },
    handler: (req, res /*, next */) => {
      res.status(429).json({
        error: 'Too many failed attempts. Please try again later.',
        retryAfter: Math.round(windowMs / 1000)
      });
    },
    standardHeaders: true,
    legacyHeaders: false
  };

  if (store) options.store = store;

  return rateLimit(options);
};

// Convenience preconfigured limiter for login endpoints. Values chosen conservatively.
const loginBruteForce = createBruteForceProtection(
  (config.rateLimit && config.rateLimit.auth && config.rateLimit.auth.windowMs) || 15 * 60 * 1000,
  (config.rateLimit && config.rateLimit.auth && config.rateLimit.auth.max) || 3
);

module.exports = { createBruteForceProtection, loginBruteForce };
