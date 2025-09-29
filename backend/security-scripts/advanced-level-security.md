# MuteahhitHub Advanced Level Security Guide

Bu doküman, Express.js güvenlik en iyi uygulamalarını MuteahhitHub sistemine entegre etmek için hazırlanmıştır. Mevcut sistem mimarisini bozmadan, güvenlik seviyesini en üst düzeye çıkaracak öneriler ve uygulamalar içermektedir.

## İçindekiler
- [1. Sistem Güvenlik Durumu](#1-sistem-güvenlik-durumu)
- [2. Express.js Güvenlik En İyi Uygulamaları](#2-expressjs-güvenlik-en-i̇yi-uygulamaları)
- [3. Mevcut Sistemdeki Güvenlik Uygulamaları](#3-mevcut-sistemdeki-güvenlik-uygulamaları)
- [4. Entegrasyon Önerileri](#4-entegrasyon-önerileri)
- [5. Gelişmiş Güvenlik Önlemleri](#5-gelişmiş-güvenlik-önlemleri)
- [6. Güvenlik Kontrol Listesi](#6-güvenlik-kontrol-listesi)

---

## 1. Sistem Güvenlik Durumu

### Mevcut Güvenlik Özellikleri ✅
- **Helmet.js** aktif ve yapılandırılmış
- **Rate Limiting** (express-rate-limit) uygulanmış
- **CORS** kontrollü şekilde yapılandırılmış
- **Session güvenliği** (httpOnly, sameSite) aktif
- **Secure file middleware** dosya erişimini korumakta
- **Authentication middleware** çok katmanlı yetkilendirme
- **Express-validator** girdi doğrulaması için mevcut
- **bcryptjs** şifre hashleme için kullanılmış

### Güvenlik Açıkları ⚠️
- Frontend `public` klasöründeki dosyalar doğrudan erişilebilir
- Session secret production'da güvenli değil
- CSP (Content Security Policy) çok gevşek
- HTTPS/TLS zorlanmamış
- Dependency vulnerability taraması yapılmamış

---

## 2. Express.js Güvenlik En İyi Uygulamaları

### 2.1 Güncel Express.js Sürümü
✅ **Mevcut Durum:** Express 5.1.0 kullanılıyor (güncel)

**Kontrol Komutu:**
```bash
npm outdated express
```

**Öneri:** Express'in güvenlik güncellemelerini takip edin.

### 2.2 TLS/HTTPS Kullanımı
⚠️ **Mevcut Durum:** HTTPS yapılandırması mevcut değil

**Uygulama Önerisi:**
```javascript
// backend/config/env.js içine eklenecek
const config = {
  // ... mevcut ayarlar
  
  // TLS Configuration
  tls: {
    enabled: process.env.HTTPS_ENABLED === 'true',
    keyPath: process.env.TLS_KEY_PATH || './certs/private-key.pem',
    certPath: process.env.TLS_CERT_PATH || './certs/certificate.pem'
  },
  
  // Force HTTPS redirect
  forceHttps: process.env.FORCE_HTTPS === 'true'
};
```

**HTTPS Middleware:**
```javascript
// backend/middlewares/httpsRedirect.js (oluşturuldu)
// Dosya: backend/middlewares/httpsRedirect.js
// Kısaca: production'da gelen HTTP isteklerini HTTPS'e 301 olarak yönlendirir
function forceHttps(req, res, next) {
  // Eğer istek zaten güvenliyse veya X-Forwarded-Proto https ise devam et
  if (req.secure || req.get('X-Forwarded-Proto') === 'https') {
    return next();
  }

  // Sadece production modu için redirect uygula
  if (process.env.NODE_ENV === 'production') {
    const host = req.get('Host') || req.hostname;
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }

  next();
}

module.exports = { forceHttps };
```

### 2.3 Kullanıcı Girdilerine Güvenmeme
✅ **Mevcut Durum:** Express-validator kullanılıyor

**Geliştirilmiş Validasyon:**
```javascript
// backend/utils/validation.js (yeni dosya)
const { body, param, query } = require('express-validator');

// Güvenli URL yönlendirme kontrolü
const validateRedirectUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    const allowedHosts = ['localhost', process.env.ALLOWED_DOMAIN];
    return allowedHosts.includes(parsedUrl.hostname);
  } catch (e) {
    return false;
  }
};

// Open Redirect saldırılarını önleme
const redirectValidation = [
  query('redirect').custom((value) => {
    if (value && !validateRedirectUrl(value)) {
      throw new Error('Invalid redirect URL');
    }
    return true;
  })
];

module.exports = { redirectValidation, validateRedirectUrl };
```

### 2.4 Gelişmiş Helmet Yapılandırması
⚠️ **Mevcut Durum:** Helmet var ama CSP gevşek

**Önerilen Helmet Yapılandırması:**
```javascript
// backend/config/env.js - security bölümünü güncelle
security: {
  helmet: {
    // Content Security Policy - daha sıkı kurallar
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'nonce-{RANDOM_NONCE}'"], // unsafe-inline kaldır
        styleSrc: ["'self'", "'nonce-{RANDOM_NONCE}'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"], // iframe'leri tamamen kapat
        frameAncestors: ["'none'"], // clickjacking koruması
        baseUri: ["'self'"],
        formAction: ["'self'"]
      },
      reportOnly: false // production'da false olmalı
    },
    
    // Cross-Origin Policies
    crossOriginEmbedderPolicy: { policy: "require-corp" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    
    // HSTS (HTTP Strict Transport Security)
    hsts: {
      maxAge: 31536000, // 1 yıl
      includeSubDomains: true,
      preload: true
    },
    
    // Diğer güvenlik başlıkları
    noSniff: true, // X-Content-Type-Options
    originAgentCluster: true,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' }, // X-Frame-Options
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: "no-referrer" }
  }
}
```

### 2.5 Güvenli Cookie Yapılandırması
⚠️ **Mevcut Durum:** Cookie güvenliği kısmen aktif

**Geliştirilmiş Cookie Ayarları:**
```javascript
// backend/config/env.js - session bölümünde uygulanmıştır
// Önemli: secure cookie'lerin doğru çalışması için uygulamanın
// proxy arkasında ise `TRUST_PROXY=true` (ve index.js içinde app.set('trust proxy', 1)) ayarlanmalıdır.
session: {
  name: process.env.SESSION_NAME || 'mthub_session',
  resave: false,
  saveUninitialized: false,
  rolling: true, // her istekte expire time'ı yenile
  cookie: {
    httpOnly: true,
    // production'da secure: true olacak şekilde NODE_ENV kontrolü kullanılıyor
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.SESSION_SAMESITE || 'strict',
    maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 1000 * 60 * 60 * 4, // ms
    domain: process.env.COOKIE_DOMAIN || undefined
  }
}
```

### 2.6 Brute Force Saldırı Koruması
✅ **Mevcut Durum:** Rate limiting var

**Gelişmiş Brute Force Koruması:**
```javascript
// backend/middlewares/advancedRateLimit.js (yeni dosya)
const rateLimit = require('express-rate-limit');

// IP bazlı brute force koruması
const createBruteForceProtection = (windowMs = 15 * 60 * 1000, maxAttempts = 5) => {
  const store = new Map(); // production'da Redis kullan
  
  return rateLimit({
    windowMs,
    max: maxAttempts,
    
    // Başarılı istekleri sayma
    skip: (req, res) => res.statusCode < 400,
    
    // IP + kullanıcı adı kombinasyonu için
    keyGenerator: (req) => {
      const ip = req.ip || req.connection.remoteAddress;
      const username = req.body.username || req.body.email || '';
      return `${ip}-${username}`;
    },
    
    // Özelleştirilmiş hata mesajı
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many failed attempts. Please try again later.',
        retryAfter: Math.round(windowMs / 1000)
      });
    },
    
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Login endpoint için özel koruma
const loginBruteForce = createBruteForceProtection(15 * 60 * 1000, 3); // 15 dk'da 3 deneme

module.exports = { createBruteForceProtection, loginBruteForce };
```

### 2.7 Dependency Güvenliği
❌ **Mevcut Durum:** Otomatik tarama yok

**Güvenlik Tarama Komutları:**
```bash
# NPM audit
npm audit

# Güvenlik açıklarını otomatik düzelt
npm audit fix

# Snyk ile detaylı tarama
npx snyk test

# Package-lock.json'u güncel tut
npm ci
```

**Otomatik Güvenlik Kontrolü:**
```json
// package.json'a eklenecek script'ler
{
  "scripts": {
    "security-audit": "npm audit && snyk test",
    "security-fix": "npm audit fix",
    "prestart": "npm run security-audit"
  }
}
```

---

## 3. Mevcut Sistemdeki Güvenlik Uygulamaları

### 3.1 Helmet.js Kullanımı ✅
```javascript
// Mevcut kullanım: backend/index.js
app.use(helmet(config.security.helmet));
```

### 3.2 Rate Limiting ✅
```javascript
// Mevcut yapılandırma: backend/middlewares/rateLimiter.js
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: (req, res) => res.statusCode < 400,
});
```

### 3.3 Secure File Middleware ✅
```javascript
// Mevcut koruma: backend/middlewares/secureFileMiddleware.js
// Project bazlı dosya erişim kontrolü
```

### 3.4 Authentication Middleware ✅
```javascript
// Çok katmanlı yetkilendirme sistemi mevcut
```

---

## 4. Entegrasyon Önerileri

### 4.1 Acil Uygulanması Gerekenler (Kritik) 🚨

#### A) Session Secret Güvenliği
```bash
# .env dosyasına güçlü secret ekle
openssl rand -hex 32
# Çıktıyı SESSION_SECRET olarak .env'e ekle
```

#### B) Production Cookie Ayarları
```javascript
// backend/config/env.js güncelle
cookie: {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 1000 * 60 * 60 * 4 // 4 saat
}
```

#### C) CSP Sıkılaştırma
```javascript
// Helmet config'te unsafe-inline'ı kaldır
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    // unsafe-inline'ları kaldır
  }
}
```

### 4.2 Kısa Vadede Uygulanacaklar (Önemli) ⚡

#### A) HTTPS Middleware Ekleme
```javascript
// Artık gerçek kod olarak eklendi:
// Dosya: backend/middlewares/httpsRedirect.js
// index.js içinde middleware conditionally kullanılıyor:
// if (process.env.FORCE_HTTPS === 'true' || config.nodeEnv === 'production') app.use(forceHttps)
```

Ek: production için bir örnek env dosyası oluşturuldu: `backend/.env.example.production` — bu dosyada `NODE_ENV=production`, `TRUST_PROXY=true`, `FORCE_HTTPS=true`, `SESSION_SECRET` vb. önerilen değerler bulunur. Bu dosyayı kopyalayıp gerçek `.env`'inize uygun değerlerle doldayın.

#### B) Gelişmiş Rate Limiting
```javascript
// Login endpoint'lerine özel brute force koruması ekle
const { loginBruteForce } = require('./middlewares/advancedRateLimit');
app.use('/api/auth/login', loginBruteForce);
```

#### C) Input Validation Güçlendirme
```javascript
// Tüm endpoint'lerde express-validator kullanımını artır
// XSS ve injection saldırılarına karşı koruma
```

#### Input Validation - Mevcut Durum (Özet)

- Tüm ana endpoint'ler için route-level `express-validator` zincirleri eklendi (auth, user, project, gallery, model).
- Ortak `handleValidationErrors` middleware ile hatalar merkezi olarak işleniyor ve Prometheus metrikleri toplanıyor.
- Dosya yüklemeleri için `sanitizeFilename` ve `validateAndSanitizeFiles` middleware'leri uygulandı (mime/size kontrolü + isim temizleme).
- `VALIDATION_STRICT` çevresel değişkeni ile kademeli sıkılaştırma planlandı (feature flag).

Kalanlar:

- E2E upload testi kararlı hale getirilmeli (test DB seeding ve temp uploads lifecycle).  
- Tüm admin ve model controller endpoint'leri için eksik validatorlar tamamlanmalı.
- İstemci tarafı (frontend) ile uyumluluk testi yapılmalı; bazı CSP/sameSite değişiklikleri çapraz-domain sorunları yaratabilir.

Öncelik önerisi: A) Production session ayarlarının (SESSION_SECRET + TRUST_PROXY + secure cookies) kontrolü ve HTTPS zorlama ile devam edelim.

### 4.3 Uzun Vadede Uygulanacaklar (İyileştirme) 🔧

#### A) Güvenlik Monitoring
```javascript
// Güvenlik olaylarını loglama
const winston = require('winston');

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/security.log' })
  ]
});

// Başarısız login denemelerini logla
function logSecurityEvent(eventType, details) {
  securityLogger.warn({
    type: eventType,
    timestamp: new Date().toISOString(),
    ip: details.ip,
    userAgent: details.userAgent,
    details: details
  });
}
```

#### B) API Güvenlik Headers
```javascript
// API endpoint'leri için ek güvenlik başlıkları
app.use('/api', (req, res, next) => {
  res.setHeader('X-API-Version', '2.0');
  res.setHeader('X-RateLimit-Policy', 'Strict');
  next();
});
```

#### C) File Upload Güvenliği
```javascript
// Dosya yükleme güvenliğini artır
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10
  },
  fileFilter: (req, file, cb) => {
    // MIME type ve extension kontrolü
    const allowedTypes = /jpeg|jpg|png|gif|pdf|dwg|zip|fbx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});
```

---

## 5. Gelişmiş Güvenlik Önlemleri

### 5.1 API Güvenlik Katmanları

#### Request Validation Middleware
```javascript
// backend/middlewares/requestValidation.js (yeni)
const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

module.exports = { handleValidationErrors };
```

#### API Response Sanitization
```javascript
// Hassas bilgileri response'lardan temizle
const sanitizeResponse = (data) => {
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    delete sanitized.password;
    delete sanitized.session_secret;
    delete sanitized.internal_id;
    return sanitized;
  }
  return data;
};
```

### 5.2 Güvenlik Monitoring ve Alerting

#### Security Event Logger
```javascript
// backend/utils/securityLogger.js (yeni)
const fs = require('fs').promises;
const path = require('path');

class SecurityLogger {
  constructor() {
    this.logFile = path.join(__dirname, '../logs/security-events.log');
    this.ensureLogDirectory();
  }
  
  async ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }
  
  async logEvent(eventType, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: eventType,
      ip: details.ip,
      userAgent: details.userAgent,
      userId: details.userId,
      details: details.data
    };
    
    try {
      await fs.appendFile(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to write security log:', error);
    }
  }
}

const securityLogger = new SecurityLogger();
module.exports = securityLogger;
```

### 5.3 Database Security

#### SQL Injection Koruması
```javascript
// Mevcut SQLite kullanımı güvenli (prepared statements)
// Ek kontrol için:
const sanitizeQuery = (queryString) => {
  // Tehlikeli SQL komutlarını tespit et
  const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(--|\/\*|\*\/)/g,
    /(\bOR\b|\bAND\b).*?['"]/gi
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(queryString)) {
      throw new Error('Potentially dangerous query detected');
    }
  }
  return queryString;
};
```

### 5.4 Frontend Güvenlik Entegrasyonu

#### CSP Nonce Implementation
```javascript
// Her request için benzersiz nonce üret
const crypto = require('crypto');

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Helmet'e nonce'u aktar
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
      styleSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`]
    }
  }
}));
```

---

## 6. Güvenlik Kontrol Listesi

### 6.1 Günlük Kontroller ☑️
- [ ] Başarısız login denemelerini kontrol et
- [ ] Anormal API trafiği var mı?
- [ ] Sistem loglarında hata mesajları
- [ ] Session sayıları normal seviyede mi?

### 6.2 Haftalık Kontroller ☑️
- [ ] `npm audit` çalıştır
- [ ] Dependencies güncel mi?
- [ ] SSL sertifikası geçerli mi?
- [ ] Backup'lar düzenli alınıyor mu?

### 6.3 Aylık Kontroller ☑️
- [ ] Penetrasyon testi yap
- [ ] Access log'larını analiz et
- [ ] Güvenlik politikalarını gözden geçir
- [ ] Team güvenlik eğitimi

### 6.4 Acil Durum Prosedürleri ☑️
- [ ] Güvenlik ihlali tespit protokolü
- [ ] System shutdown prosedürü
- [ ] Incident response team iletişimi
- [ ] Backup restore prosedürü

---

## 7. Monitoring ve Alerting

### 7.1 Real-time Security Monitoring
```javascript
// backend/middlewares/securityMonitor.js (yeni)
const securityLogger = require('../utils/securityLogger');

const securityMonitor = (req, res, next) => {
  // Şüpheli aktivite tespiti
  const suspiciousPatterns = [
    /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i,  // Path traversal
    /(<script|javascript:|data:)/i,       // XSS attempts
    /(union|select|insert|delete|drop)/i, // SQL injection
    /(\x00|\x1f|\x7f)/,                  // Null bytes
  ];
  
  const checkSuspiciousActivity = (input) => {
    return suspiciousPatterns.some(pattern => pattern.test(input));
  };
  
  // Request body ve query parametrelerini kontrol et
  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  if (checkSuspiciousActivity(requestData)) {
    securityLogger.logEvent('SUSPICIOUS_REQUEST', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.session?.user?.id,
      data: {
        method: req.method,
        url: req.url,
        body: req.body,
        query: req.query
      }
    });
    
    // Şüpheli istekleri block et
    return res.status(400).json({
      error: 'Request blocked for security reasons'
    });
  }
  
  next();
};

module.exports = securityMonitor;
```

### 7.2 Performance ve Security Metrics
```javascript
// backend/utils/metricsCollector.js (yeni)
class MetricsCollector {
  constructor() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      blockedRequests: 0,
      activeUsers: new Set()
    };
  }
  
  incrementRequestCount() {
    this.metrics.requestCount++;
  }
  
  incrementErrorCount() {
    this.metrics.errorCount++;
  }
  
  incrementBlockedRequests() {
    this.metrics.blockedRequests++;
  }
  
  addActiveUser(userId) {
    this.metrics.activeUsers.add(userId);
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      activeUserCount: this.metrics.activeUsers.size
    };
  }
}

const metricsCollector = new MetricsCollector();
module.exports = metricsCollector;
```

---

## 8. Uygulama Planı

### Faz 1 (Acil - 1 hafta) 🚨
1. Session secret güncelleme
2. Production cookie ayarları
3. HTTPS middleware ekleme
4. CSP sıkılaştırma
5. Brute force koruması güçlendirme

### Faz 2 (Kısa vade - 2-4 hafta) ⚡
1. Input validation genişletme
2. Security logging implementasyonu
3. Dependency security taraması
4. File upload güvenliği
5. API rate limiting iyileştirme

### Faz 3 (Uzun vade - 1-3 ay) 🔧
1. Real-time monitoring sistemi
2. Automated security testing
3. Penetration testing
4. Security awareness training
5. Incident response prosedürleri

---

## 9. Sonuç ve Öneriler

MuteahhitHub sistemi, temel güvenlik önlemlerinin çoğunu zaten uygulayan güçlü bir yapıya sahiptir. Bu guide'da önerilen iyileştirmeler, mevcut sistemi bozmadan güvenlik seviyesini üst düzeylere çıkaracaktır.

**En kritik öncelikler:**
1. **Session security** - Güçlü secret ve secure cookies
2. **HTTPS enforcement** - Production'da zorunlu HTTPS
3. **CSP tightening** - Content Security Policy sıkılaştırma
4. **Brute force protection** - Gelişmiş rate limiting
5. **Dependency security** - Düzenli güvenlik taraması

Bu önlemlerin uygulanması ile MuteahhitHub, modern web uygulamalarından beklenen güvenlik standartlarını sağlayacak ve OWASP Top 10 güvenlik açıklarına karşı korunacaktır.

---
*Bu doküman, Express.js Security Best Practices (https://expressjs.com/en/advanced/best-practice-security.html) referans alınarak hazırlanmıştır.*