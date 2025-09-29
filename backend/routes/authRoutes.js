const express = require('express');
const { authLimiter } = require('../middlewares/rateLimiter');
const { loginBruteForce } = require('../middlewares/advancedRateLimit');
const { createSMSRateLimiter, smsCooldownMiddleware, checkSMSLimits, setSMSCooldown, incrementSMSCounters } = require('../middlewares/smsRateLimit');
const authController = require('../controllers/authController');
const { loginValidators } = require('../validators/auth');
const { handleValidationErrors } = require('../middlewares/requestValidation');
const { asyncHandler } = require('../middlewares/errorHandler');

const router = express.Router();

/**
 * Authentication Routes
 */

// SMS rate limiter for OTP requests
const smsRateLimiter = createSMSRateLimiter();

// User authentication flow
// Step 1: Validate credentials and send OTP
router.post('/validate-credentials', loginBruteForce, authLimiter, ...loginValidators(), handleValidationErrors,
  smsCooldownMiddleware, checkSMSLimits, authController.validateUserAndSendOTP);

// Step 2: Verify OTP and complete login
router.post('/verify-otp', authLimiter, authController.verifyUserOTP);

// Admin authentication flow
// Step 1: Validate admin credentials and send OTP
router.post('/admin/validate-credentials', loginBruteForce, authLimiter, ...loginValidators(), handleValidationErrors,
  smsCooldownMiddleware, checkSMSLimits, authController.validateAdminAndSendOTP);

// Step 2: Verify admin OTP and complete login
router.post('/admin/verify-otp', authLimiter, authController.verifyAdminOTP);

// Legacy routes (redirect to new flow)
router.post('/login', (req, res) => {
  res.status(400).json({ error: 'Lütfen önce kimlik bilgilerinizi doğrulayın ve OTP girin.' });
});

router.post('/admin/login', (req, res) => {
  res.status(400).json({ error: 'Lütfen önce kimlik bilgilerinizi doğrulayın ve OTP girin.' });
});

// Admin routes
router.get('/admin/login', authController.adminLoginPage);

// Common auth routes
router.post('/logout', authController.logout);
router.get('/session', authController.getSession);

module.exports = router;