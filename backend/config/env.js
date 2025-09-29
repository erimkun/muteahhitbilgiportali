require('dotenv').config();

const config = {
  port: process.env.PORT || 3001,
  sessionSecret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || true,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configuration
  database: {
    filename: 'db.sqlite'
  },
  
  // Session configuration
  // Production-safe defaults: custom name, rolling sessions, and cookie options driven by environment
  trustProxy: process.env.TRUST_PROXY === 'true' || false,
  session: {
    name: process.env.SESSION_NAME || 'mthub_session',
    resave: false,
    saveUninitialized: false,
    rolling: true, // refresh expiry on each request
    cookie: {
      httpOnly: true,
      // secure cookies should be enabled in production (requires HTTPS or proper proxy)
      secure: process.env.NODE_ENV === 'production',
      // Use strict sameSite for better CSRF protection in most cases. Adjust if cross-site embed is required.
      sameSite: process.env.SESSION_SAMESITE || 'strict',
      // Shorter default session lifetime for production
      maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 1000 * 60 * 60 * 4, // 4 hours
      // Optional domain to scope cookies to your production domain (set in .env)
      domain: process.env.COOKIE_DOMAIN || undefined
    }
  },
  
  // Rate limiting configuration
  rateLimit: {
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20, // limit each IP to 20 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false
    }
  },
  
  // File upload configuration
  upload: {
    maxFiles: 50,
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.dwg', '.zip', '.fbx']
  },
  
  // Security configuration
  // Security configuration
  security: {
    helmet: {
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: {
        // Note: We will set a per-request nonce in middleware and allow it for inline scripts/styles.
        directives: {
          defaultSrc: ["'self'"],
          // Avoid 'unsafe-inline' — use nonces instead via runtime middleware
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          frameAncestors: ["'self'", "http://localhost:5173", "http://localhost:3001"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        },
        reportOnly: false
      }
    }
  },
};

module.exports = config;