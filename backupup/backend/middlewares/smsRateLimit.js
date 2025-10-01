const rateLimit = require('express-rate-limit');
const { asyncHandler } = require('./errorHandler');

/**
 * SMS Rate Limiting Middleware
 * Provides rate limiting for SMS OTP requests with cooldown and lockout features
 */

// Store for tracking cooldown periods (in-memory, consider Redis for production)
const smsCooldownStore = new Map();
const smsRequestCountStore = new Map();

// Cleanup expired cooldown entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of smsCooldownStore.entries()) {
    if (value.expiresAt <= now) {
      smsCooldownStore.delete(key);
    }
  }
}, 60000);

/**
 * Create SMS rate limiter with configurable settings
 */
const createSMSRateLimiter = () => {
  const windowMs = parseInt(process.env.SMS_RATE_LIMIT_WINDOW) || 900000; // 15 minutes
  const maxRequests = parseInt(process.env.SMS_RATE_LIMIT_MAX) || 3;
  const cooldownMs = parseInt(process.env.SMS_COOLDOWN_MS) || 60000; // 1 minute
  const resendCooldownMs = parseInt(process.env.SMS_RESEND_COOLDOWN_MS) || 120000; // 2 minutes

  return rateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator: (req) => {
      // Use IP + phone number for rate limiting with proper IPv6 support
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

      const phone = req.body.phone || '';
      return `sms_${ipPart}_${phone}`;
    },
    handler: (req, res) => {
      res.status(429).json({
        error: 'Çok fazla SMS isteği. Lütfen daha sonra tekrar deneyin.',
        retryAfter: Math.round(windowMs / 1000)
      });
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

/**
 * Middleware to check cooldown period between SMS requests
 */
const smsCooldownMiddleware = asyncHandler(async (req, res, next) => {
  const phone = req.body.phone;
  if (!phone) {
    return next();
  }

  const cooldownKey = `cooldown_${phone}`;
  const cooldownData = smsCooldownStore.get(cooldownKey);

  if (cooldownData && Date.now() < cooldownData.expiresAt) {
    const remainingMs = cooldownData.expiresAt - Date.now();
    return res.status(429).json({
      error: `Tekrar SMS göndermek için ${Math.ceil(remainingMs / 1000)} saniye bekleyin.`,
      retryAfter: Math.ceil(remainingMs / 1000)
    });
  }

  next();
});

/**
 * Middleware to set cooldown after successful SMS send
 */
const setSMSCooldown = (req, phone, isResend = false) => {
  const cooldownKey = `cooldown_${phone}`;
  const cooldownMs = isResend ? 
    parseInt(process.env.SMS_RESEND_COOLDOWN_MS) || 120000 :
    parseInt(process.env.SMS_COOLDOWN_MS) || 60000;

  smsCooldownStore.set(cooldownKey, {
    expiresAt: Date.now() + cooldownMs,
    setAt: new Date()
  });
};

/**
 * Middleware to check daily/monthly SMS limits (optional additional protection)
 */
const checkSMSLimits = asyncHandler(async (req, res, next) => {
  const phone = req.body.phone;
  const ip = req.ip;
  
  if (!phone) {
    return next();
  }

  // Daily limit check (optional - can be configured via env)
  const dailyLimit = parseInt(process.env.SMS_DAILY_LIMIT) || 10;
  const dailyKey = `daily_${phone}_${new Date().toDateString()}`;
  
  const dailyCount = smsRequestCountStore.get(dailyKey) || 0;
  if (dailyCount >= dailyLimit) {
    return res.status(429).json({
      error: 'Günlük SMS limitine ulaşıldı. Lütfen yarın tekrar deneyin.'
    });
  }

  // Monthly limit check (optional)
  const monthlyLimit = parseInt(process.env.SMS_MONTHLY_LIMIT) || 30;
  const monthlyKey = `monthly_${phone}_${new Date().getMonth()}_${new Date().getFullYear()}`;
  
  const monthlyCount = smsRequestCountStore.get(monthlyKey) || 0;
  if (monthlyCount >= monthlyLimit) {
    return res.status(429).json({
      error: 'Aylık SMS limitine ulaşıldı. Lütfen gelecek ay tekrar deneyin.'
    });
  }

  next();
});

/**
 * Increment SMS request counters
 */
const incrementSMSCounters = (phone) => {
  const dailyKey = `daily_${phone}_${new Date().toDateString()}`;
  const monthlyKey = `monthly_${phone}_${new Date().getMonth()}_${new Date().getFullYear()}`;

  smsRequestCountStore.set(dailyKey, (smsRequestCountStore.get(dailyKey) || 0) + 1);
  smsRequestCountStore.set(monthlyKey, (smsRequestCountStore.get(monthlyKey) || 0) + 1);
};

module.exports = {
  createSMSRateLimiter,
  smsCooldownMiddleware,
  setSMSCooldown,
  checkSMSLimits,
  incrementSMSCounters
};