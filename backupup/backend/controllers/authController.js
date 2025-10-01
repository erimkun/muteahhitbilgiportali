const bcrypt = require('bcryptjs');
const { UserService } = require('../services/dbService');
const { normalizePhone, validateRequiredFields, formatErrorResponse, formatSuccessResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middlewares/errorHandler');
const SMSService = require('../services/smsService');
const OTPService = require('../services/otpService');
const { setSMSCooldown, incrementSMSCounters } = require('../middlewares/smsRateLimit');

/**
 * Authentication Controller
 * Handles user and admin authentication operations
 */

/**
 * Validate user credentials and send OTP
 */
const validateUserAndSendOTP = asyncHandler(async (req, res) => {
  const { phone, password } = req.body || {};
  
  const validation = validateRequiredFields(req.body, ['phone', 'password']);
  if (!validation.isValid) {
    return res.status(400).json(
      formatErrorResponse('Eksik alanlar', { missing: validation.missing })
    );
  }

  const normalizedPhone = normalizePhone(phone);
  
  try {
    const user = await UserService.getUserByPhone(normalizedPhone);
    
    if (!user || user.is_active === 0) {
      return res.status(401).json(formatErrorResponse('Geçersiz kimlik bilgileri'));
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json(formatErrorResponse('Geçersiz kimlik bilgileri'));
    }

    // Generate and send OTP
    try {
      const { code, expiresAt } = await OTPService.generateAndStoreOTP(normalizedPhone);
      const smsSent = await SMSService.sendOTP(normalizedPhone, code);

      if (smsSent) {
        // Set cooldown and increment counters on successful SMS send
        setSMSCooldown(req, normalizedPhone);
        incrementSMSCounters(normalizedPhone);

        res.json(formatSuccessResponse(
          { expiresAt: expiresAt.toISOString() },
          'SMS gönderildi. Lütfen doğrulama kodunu girin.'
        ));
      } else {
        res.status(500).json(formatErrorResponse('SMS gönderilemedi. Lütfen tekrar deneyin.'));
      }
    } catch (smsError) {
      if (smsError.message === 'PHONE_LOCKED') {
        const lockoutTime = OTPService.getLockoutRemainingTime(normalizedPhone);
        return res.status(429).json(formatErrorResponse(
          `Çok fazla başarısız deneme. Hesap ${Math.ceil(lockoutTime / 1000)} saniye kilitlendi.`
        ));
      }
      console.error('SMS sending error:', smsError);
      res.status(500).json(formatErrorResponse('SMS gönderilemedi. Lütfen tekrar deneyin.'));
    }
  } catch (error) {
    console.error('User validation error:', error);
    res.status(500).json(formatErrorResponse('Doğrulama başarısız'));
  }
});

/**
 * Verify OTP and complete user login
 */
const verifyUserOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body || {};
  
  const validation = validateRequiredFields(req.body, ['phone', 'otp']);
  if (!validation.isValid) {
    return res.status(400).json(
      formatErrorResponse('Eksik alanlar', { missing: validation.missing })
    );
  }

  const normalizedPhone = normalizePhone(phone);
  
  try {
    const isValid = await OTPService.verifyOTP(normalizedPhone, otp);
    
    if (!isValid) {
      return res.status(401).json(formatErrorResponse('Geçersiz doğrulama kodu'));
    }

    // Get user details to set session
    const user = await UserService.getUserByPhone(normalizedPhone);
    
    if (!user || user.is_active === 0) {
      return res.status(401).json(formatErrorResponse('Geçersiz kimlik bilgileri'));
    }

    // Regenerate session for security (prevent session fixation)
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json(formatErrorResponse('Oturum oluşturma hatası'));
      }

      // Set user session
      req.session.user = {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role || 'user',
        logo_url: user.logo_url
      };

      res.json(formatSuccessResponse(
        { user: req.session.user },
        'Giriş başarılı'
      ));
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json(formatErrorResponse('Doğrulama başarısız'));
  }
});

/**
 * Validate admin credentials and send OTP
 */
const validateAdminAndSendOTP = asyncHandler(async (req, res) => {
  const { phone, password } = req.body || {};
  
  const validation = validateRequiredFields(req.body, ['phone', 'password']);
  if (!validation.isValid) {
    return res.status(400).json(
      formatErrorResponse('Eksik alanlar', { missing: validation.missing })
    );
  }

  const normalizedPhone = normalizePhone(phone);
  
  try {
    const admin = await UserService.getUserByPhone(normalizedPhone);
    
    if (!admin || !['admin', 'superadmin'].includes(admin.role) || admin.is_active === 0) {
      return res.status(401).json(formatErrorResponse('Geçersiz kimlik bilgileri'));
    }

    if (!bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json(formatErrorResponse('Geçersiz kimlik bilgileri'));
    }

    // Generate and send OTP
    try {
      const { code, expiresAt } = await OTPService.generateAndStoreOTP(normalizedPhone);
      const smsSent = await SMSService.sendOTP(normalizedPhone, code);

      if (smsSent) {
        // Set cooldown and increment counters on successful SMS send
        setSMSCooldown(req, normalizedPhone);
        incrementSMSCounters(normalizedPhone);

        res.json(formatSuccessResponse(
          { expiresAt: expiresAt.toISOString() },
          'SMS gönderildi. Lütfen doğrulama kodunu girin.'
        ));
      } else {
        res.status(500).json(formatErrorResponse('SMS gönderilemedi. Lütfen tekrar deneyin.'));
      }
    } catch (smsError) {
      if (smsError.message === 'PHONE_LOCKED') {
        const lockoutTime = OTPService.getLockoutRemainingTime(normalizedPhone);
        return res.status(429).json(formatErrorResponse(
          `Çok fazla başarısız deneme. Hesap ${Math.ceil(lockoutTime / 1000)} saniye kilitlendi.`
        ));
      }
      console.error('SMS sending error:', smsError);
      res.status(500).json(formatErrorResponse('SMS gönderilemedi. Lütfen tekrar deneyin.'));
    }
  } catch (error) {
    console.error('Admin validation error:', error);
    res.status(500).json(formatErrorResponse('Doğrulama başarısız'));
  }
});

/**
 * Verify OTP and complete admin login
 */
const verifyAdminOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body || {};
  
  const validation = validateRequiredFields(req.body, ['phone', 'otp']);
  if (!validation.isValid) {
    return res.status(400).json(
      formatErrorResponse('Eksik alanlar', { missing: validation.missing })
    );
  }

  const normalizedPhone = normalizePhone(phone);
  
  try {
    const isValid = await OTPService.verifyOTP(normalizedPhone, otp);
    
    if (!isValid) {
      return res.status(401).json(formatErrorResponse('Geçersiz doğrulama kodu'));
    }

    // Get admin details to set session
    const admin = await UserService.getUserByPhone(normalizedPhone);
    
    if (!admin || !['admin', 'superadmin'].includes(admin.role) || admin.is_active === 0) {
      return res.status(401).json(formatErrorResponse('Geçersiz kimlik bilgileri'));
    }

    // Regenerate session for security (prevent session fixation)
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json(formatErrorResponse('Oturum oluşturma hatası'));
      }

      // Set admin session (both admin and user for compatibility)
      req.session.admin = {
        id: admin.id,
        phone: admin.phone,
        role: admin.role,
        name: admin.name,
        logo_url: admin.logo_url
      };
      
      req.session.user = {
        id: admin.id,
        phone: admin.phone,
        role: admin.role,
        name: admin.name,
        logo_url: admin.logo_url
      };

      res.json(formatSuccessResponse(
        { admin: req.session.admin, user: req.session.user },
        'Admin girişi başarılı'
      ));
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json(formatErrorResponse('Doğrulama başarısız'));
  }
});

/**
 * User login (legacy - kept for compatibility, but now uses OTP flow)
 */
const userLogin = asyncHandler(async (req, res) => {
  res.status(400).json(formatErrorResponse('Lütfen önce kimlik bilgilerinizi doğrulayın ve OTP girin.'));
});

/**
 * Admin login (POST) (legacy - kept for compatibility, but now uses OTP flow)
 */
const adminLoginLegacy = asyncHandler(async (req, res) => {
  res.status(400).json(formatErrorResponse('Lütfen önce kimlik bilgilerinizi doğrulayın ve OTP girin.'));
});

/**
 * Admin login (POST)
 */
const adminLogin = asyncHandler(async (req, res) => {
  const { phone, password } = req.body || {};
  
  const validation = validateRequiredFields(req.body, ['phone', 'password']);
  if (!validation.isValid) {
    return res.status(400).json(
      formatErrorResponse('Missing required fields', { missing: validation.missing })
    );
  }

  const normalizedPhone = normalizePhone(phone);
  
  try {
    console.log('Admin login attempt:', { phone, normalizedPhone });
    
    // Use UserService to get admin from users table where role = 'admin' or 'superadmin'
    const admin = await UserService.getUserByPhone(normalizedPhone);
    
    console.log('Admin found:', admin ? { id: admin.id, phone: admin.phone, role: admin.role } : null);
    
    if (!admin || !['admin', 'superadmin'].includes(admin.role) || admin.is_active === 0) {
      console.log('Admin validation failed:', { 
        adminExists: !!admin, 
        role: admin?.role, 
        isActive: admin?.is_active 
      });
      return res.status(401).json(formatErrorResponse('Invalid credentials'));
    }

    const passwordMatch = bcrypt.compareSync(password, admin.password_hash);
    console.log('Password match:', passwordMatch);

    if (!passwordMatch) {
      return res.status(401).json(formatErrorResponse('Invalid credentials'));
    }

    // Set admin session (both admin and user for compatibility)
    req.session.admin = {
      id: admin.id,
      phone: admin.phone,
      role: admin.role,
      name: admin.name,
      logo_url: admin.logo_url
    };
    
    req.session.user = {
      id: admin.id,
      phone: admin.phone,
      role: admin.role,
      name: admin.name,
      logo_url: admin.logo_url
    };

    res.json(formatSuccessResponse(
      { admin: req.session.admin, user: req.session.user },
      'Admin login successful'
    ));
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json(formatErrorResponse('Login failed'));
  }
});

/**
 * Admin login page (GET)
 */
const adminLoginPage = (req, res) => {
  res.send(`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin Girişi</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
      color: #fff;
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-container {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #e0e0e0;
    }
    input[type="tel"], input[type="password"] {
      width: 100%;
      padding: 15px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
      font-size: 16px;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }
    input[type="tel"]:focus, input[type="password"]:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
    }
    input::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
    .submit-btn {
      width: 100%;
      padding: 15px;
      border: none;
      border-radius: 10px;
      background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .submit-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
    }
    .submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .message {
      margin-top: 15px;
      padding: 10px;
      border-radius: 8px;
      text-align: center;
      font-weight: 500;
    }
    .message.error {
      background: rgba(244, 67, 54, 0.2);
      border: 1px solid rgba(244, 67, 54, 0.5);
      color: #ffcdd2;
    }
    .message.success {
      background: rgba(76, 175, 80, 0.2);
      border: 1px solid rgba(76, 175, 80, 0.5);
      color: #c8e6c9;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="logo">
      <h1>Admin Panel</h1>
    </div>
    <form id="loginForm">
      <div class="form-group">
        <label for="phone">Telefon Numarası</label>
        <input type="tel" id="phone" name="phone" placeholder="05XXXXXXXXX" required>
      </div>
      <div class="form-group">
        <label for="password">Parola</label>
        <input type="password" id="password" name="password" placeholder="Parola" required>
      </div>
      <button type="submit" class="submit-btn" id="loginBtn">Giriş Yap</button>
      <div class="message" id="message"></div>
    </form>
  </div>

  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const phone = document.getElementById('phone').value.trim();
      const password = document.getElementById('password').value.trim();
      const loginBtn = document.getElementById('loginBtn');
      const message = document.getElementById('message');
      
      if (!phone || !password) {
        message.textContent = 'Telefon ve parola gerekli';
        message.className = 'message error';
        return;
      }
      
      loginBtn.disabled = true;
      loginBtn.textContent = 'Giriş yapılıyor...';
      message.textContent = '';
      
      try {
        const res = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ phone, password })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          message.textContent = 'Giriş başarılı! Yönlendiriliyor...';
          message.className = 'message success';
          setTimeout(() => {
            window.location.href = '/projects.html';
          }, 1000);
        } else {
          message.textContent = data.error || 'Giriş başarısız';
          message.className = 'message error';
        }
      } catch (error) {
        message.textContent = 'Bağlantı hatası: ' + error.message;
        message.className = 'message error';
      }
      
      loginBtn.disabled = false;
      loginBtn.textContent = 'Giriş Yap';
    });
  </script>
</body>
</html>`);
};

/**
 * Logout
 */
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json(formatErrorResponse('Çıkış işlemi başarısız'));
    }
    res.json(formatSuccessResponse({}, 'Çıkış başarılı'));
  });
};

/**
 * Get current session info
 */
const getSession = (req, res) => {
  res.json(formatSuccessResponse({
    user: req.session?.user || null,
    admin: req.session?.admin || null
  }));
};

module.exports = {
  userLogin,
  adminLogin,
  adminLoginLegacy,
  adminLoginPage,
  logout,
  getSession,
  validateUserAndSendOTP,
  verifyUserOTP,
  validateAdminAndSendOTP,
  verifyAdminOTP
};