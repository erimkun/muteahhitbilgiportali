const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');

// Import configuration
const config = require('./config/env');

// Import middleware
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');
const { forceHttps } = require('./middlewares/httpsRedirect');
const { promClient } = require('./middlewares/validationLogger');
const { requireAuthentication } = require('./middlewares/authMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const modelRoutes = require('./routes/modelRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

/**
 * Security & Basic Configuration
 */
// CSP nonce middleware must run before helmet so we can use the per-request nonce in directives
const { cspNonce } = require('./middlewares/cspNonce');
app.use(cspNonce);

// Apply Helmet with CSP directives that read nonce from res.locals
const helmetConfig = Object.assign({}, config.security.helmet);
if (helmetConfig && helmetConfig.contentSecurityPolicy && helmetConfig.contentSecurityPolicy.directives) {
  const directives = helmetConfig.contentSecurityPolicy.directives;
  // Use functions so Helmet can call them per request and pick up res.locals.nonce
  // For legacy admin pages we allow a development-time opt-in for 'unsafe-inline'
  // because many pages use style attributes and inline event handlers which
  // nonces do not cover. Prefer refactoring inline styles/handlers to external
  // files and removing this allowance for production.
  const allowUnsafeInline = (process.env.ALLOW_CSP_UNSAFE_INLINE === 'true') || config.nodeEnv !== 'production';

  if (allowUnsafeInline) {
    // In dev/opt-in mode we allow unsafe-inline and attribute-level inline
    // so legacy pages with inline styles/event handlers work. Do NOT combine
    // nonces with 'unsafe-inline' because browsers may ignore 'unsafe-inline'
    // if a nonce/hash is present in the same directive.
    directives.scriptSrc = ["'self'", "'unsafe-inline'"];
    directives.styleSrc = ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"];
    directives.fontSrc = ["'self'", "https://cdnjs.cloudflare.com"];
    directives.scriptSrcAttr = ["'unsafe-inline'"];
    directives.styleSrcAttr = ["'unsafe-inline'"];
  } else {
    // Production: use per-request nonces and avoid 'unsafe-inline'
    directives.scriptSrc = ["'self'", (req, res) => `'nonce-${res.locals.nonce || ''}'`];
    directives.styleSrc = ["'self'", (req, res) => `'nonce-${res.locals.nonce || ''}'`, "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"];
    directives.fontSrc = ["'self'", "https://cdnjs.cloudflare.com"];
  }
  helmetConfig.contentSecurityPolicy.directives = directives;
}
// Disable HSTS in non-production so we don't send Strict-Transport-Security
// during local development which would cause browsers to upgrade HTTP -> HTTPS
// via HSTS caching. Helmet enables HSTS by default; turn it off unless we're
// in production.
if (config.nodeEnv !== 'production') {
  helmetConfig.hsts = false;
}
app.use(helmet(helmetConfig));
// Hardened CORS handling: explicit allowlist required in production
if (config.nodeEnv === 'production' && (!config.corsOrigin || config.corsOrigin.length === 0)) {
  console.error('\n❌ CORS_ORIGIN tanımlı değil veya boş. Production ortamında açık CORS yasaklandı.');
  console.error('   Örnek: CORS_ORIGIN=https://app.example.com,https://admin.example.com');
  process.exit(1);
}

const allowedOrigins = config.corsOrigin && config.corsOrigin.length > 0 ? config.corsOrigin : true; // dev modunda true serbest bırakılabilir

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser / same-origin (like curl / server-to-server) with no Origin header
    if (!origin) return callback(null, true);
    if (allowedOrigins === true) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn('🚫 CORS blocked origin:', origin);
    return callback(new Error('CORS not allowed for this origin')); // Will result in CORS failure
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Accept', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  maxAge: 86400
}));

// If running behind a proxy (e.g., Nginx, Heroku), enable trust proxy so secure cookies and req.secure work
if (config.trustProxy) {
  app.set('trust proxy', 1);
}

// Optionally force HTTPS in production
if (process.env.FORCE_HTTPS === 'true' || process.env.FORCE_HTTPS === '1' || config.nodeEnv === 'production') {
  app.use(forceHttps);
}

/**
 * Body Parsing & Session Configuration
 */
app.use(express.json());
app.use(session({
  // Merge config.session and ensure secret is set from config
  ...config.session,
  secret: config.sessionSecret || process.env.SESSION_SECRET || 'dev_secret_change_me'
}));

/**
 * Rate Limiting
 */
app.use('/api', apiLimiter);

/**
 * Secure Static File Serving with Authentication
 *
 * NOTE: the actual mounts for '/uploads' and '/upload' are registered later
 * after the admin HTML routes. This ordering guarantees that GET /upload
 * requests are handled by serveAdminHtml(...) which injects CSP nonces and
 * performs the intended session/admin checks for admin pages. If the static
 * mounts are registered earlier, they will intercept GET /upload and the
 * secureFileServing middleware may return a JSON error (e.g. when the
 * request is for the HTML page), preventing the HTML helper from running.
 */
const { secureFileServing, validateProjectAccess } = require('./middlewares/secureFileMiddleware');

// Serve admin login early so static middleware doesn't bypass our nonce injection.
// Helper to read an admin HTML file, inject nonce into inline style/script tags, and send it.
function serveAdminHtml(fileName) {
  return (req, res) => {
    if (!req.session?.admin) {
      return res.redirect('/admin/login');
    }

    const filePath = path.join(__dirname, 'public', fileName);
    try {
      let html = require('fs').readFileSync(filePath, 'utf8');
      const nonce = res.locals.nonce || '';

      if (nonce) {
        html = html.replace(/<style\b([^>]*)>/gi, (match, attrs) => {
          if (/\bnonce=/.test(attrs)) return match;
          return `<style${attrs} nonce="${nonce}">`;
        });

        html = html.replace(/<script\b([^>]*)>/gi, (match, attrs) => {
          if (/\bnonce=/.test(attrs)) return match;
          return `<script${attrs} nonce="${nonce}">`;
        });
      }

      res.set('Content-Type', 'text/html');
      return res.send(html);
    } catch (err) {
      console.error(`Failed to read ${fileName} for nonce injection`, err);
      return res.sendFile(filePath);
    }
  };
}

// Public admin pages served via helper to ensure nonce injection and auth checks
app.get('/admin/login', (req, res) => {
  // Allow login page without requiring admin session
  if (req.session?.admin) {
    return res.redirect('/projects');
  }

  const loginPath = path.join(__dirname, 'public', 'admin-login.html');
  try {
    let html = require('fs').readFileSync(loginPath, 'utf8');
    const nonce = res.locals.nonce || '';

    if (nonce) {
      html = html.replace(/<style\b([^>]*)>/gi, (match, attrs) => {
        if (/\bnonce=/.test(attrs)) return match;
        return `<style${attrs} nonce="${nonce}">`;
      });

      html = html.replace(/<script\b([^>]*)>/gi, (match, attrs) => {
        if (/\bnonce=/.test(attrs)) return match;
        return `<script${attrs} nonce="${nonce}">`;
      });
    }

    res.set('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    console.error('Failed to read admin-login.html for nonce injection', err);
    return res.sendFile(loginPath);
  }
});

app.get('/files', serveAdminHtml('file-manager.html'));
app.get('/projects', serveAdminHtml('projects.html'));
app.get('/upload', serveAdminHtml('upload.html'));
app.get('/users', serveAdminHtml('user-management.html'));

// Also handle direct HTML file paths to avoid express.static serving them without nonce injection
app.get('/file-manager.html', serveAdminHtml('file-manager.html'));
app.get('/projects.html', serveAdminHtml('projects.html'));
app.get('/upload.html', serveAdminHtml('upload.html'));
app.get('/user-management.html', serveAdminHtml('user-management.html'));

// Secure static mounts for uploads. These are placed after the admin HTML
// routes above so that requests for the admin HTML pages (e.g. GET /upload)
// are handled by serveAdminHtml which injects CSP nonces and runs the
// session/admin checks for admin pages. The secureFileServing middleware
// still protects direct access to uploaded assets under /uploads or /upload/*.

// User logos route - restricted access
app.use('/uploads/user-logos', 
  requireAuthentication,
  (req, res, next) => {
    // Extract filename from path
    const filename = path.basename(req.path);
    const userIdMatch = filename.match(/^user_(\d+)_logo_/);
    
    if (!userIdMatch) {
      return res.status(404).send('Not found');
    }
    
    const logoUserId = parseInt(userIdMatch[1]);
    
    // Check if admin is logged in
    const isAdmin = req.session?.admin || 
                   (req.session?.user && ['admin', 'superadmin'].includes(req.session.user.role));
    
    // Check if user owns the logo
    const isOwner = req.session?.user && req.session.user.id === logoUserId;
    
    // Allow access if admin or owner
    if (isAdmin || isOwner) {
      next();
    } else {
      console.log('Logo access denied:', {
        logoUserId,
        sessionUser: req.session?.user?.id,
        sessionAdmin: req.session?.admin?.id,
        userRole: req.session?.user?.role
      });
      res.status(403).send('Access denied');
    }
  },
  express.static(path.join(__dirname, 'uploads', 'user-logos'))
);

app.use('/uploads', 
  secureFileServing,
  validateProjectAccess,
  (req, res, next) => {
    if (req.path.endsWith('.pdf')) {
      res.set({
        'Content-Type': 'application/pdf',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Disposition': 'inline'
      });
    }
    next();
  }, 
  express.static(path.join(__dirname, 'uploads'))
);

app.use('/upload', 
  secureFileServing,  // This already handles both authentication and project access validation
  (req, res, next) => {
    if (req.path.endsWith('.pdf')) {
      res.set({
        'Content-Type': 'application/pdf', 
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Disposition': 'inline'
      });
    }
    next();
  }, 
  express.static(path.join(__dirname, 'uploads'))
); // Alias for compatibility

app.use(express.static(path.join(__dirname, 'public'))); // Public static files

/**
 * Basic Health Check Route
 */
app.get('/', (req, res) => {
  res.json({
    message: 'MuteahhitHub Backend API is running!',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// Expose Prometheus metrics (useful for monitoring validation failures)
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

/**
 * API Routes
 */
app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/', projectRoutes);
app.use('/', galleryRoutes);
app.use('/', modelRoutes);
app.use('/', adminRoutes);

/**
 * Admin Interface Routes
 */
// NOTE: admin pages are served earlier in this file via `serveAdminHtml(..)` which
// injects per-request nonces into inline <script>/<style> tags. Do not overwrite
// those routes with plain sendFile() calls because that will bypass nonce
// injection and cause CSP failures in production.

/**
 * Session Info Endpoint (for frontend to get current user info)
 */
app.get('/session', (req, res) => {
  res.json({
    admin: req.session?.admin || null,
    user: req.session?.user || null,
    authenticated: !!(req.session?.admin || req.session?.user)
  });
});

/**
 * Error Handling Middleware
 */
app.use(notFound);
app.use(errorHandler);

/**
 * Start Server only when this file is executed directly.
 * This allows tests (supertest) to require the app without starting the HTTP listener.
 */
const port = config.port;
if (require.main === module) {
  // Prevent accidental production start with insecure defaults
  if (config.nodeEnv === 'production' && (!config.sessionSecret || config.sessionSecret === 'dev_secret_change_me')) {
    console.error('\n\u274C ERROR: Production start blocked - SESSION_SECRET is not configured securely.');
    console.error('Please set a strong SESSION_SECRET in your environment (see .env.example.production) and restart.\n');
    process.exit(1);
  }

  // Warn and block if unsafe-inline is explicitly allowed in production
  const allowUnsafeInlineEnv = (process.env.ALLOW_CSP_UNSAFE_INLINE === 'true');
  if (config.nodeEnv === 'production' && allowUnsafeInlineEnv) {
    console.error('\n\u274C ERROR: ALLOW_CSP_UNSAFE_INLINE is enabled in production. This allows unsafe inline scripts/styles and weakens CSP.');
    console.error('Set ALLOW_CSP_UNSAFE_INLINE=false and refactor admin pages to remove inline event handlers/style attributes before starting in production.');
    process.exit(1);
  }
  app.listen(port, () => {
    console.log(`🚀 MuteahhitHub Backend API server running on port ${port}`);
    console.log(`📝 Environment: ${config.nodeEnv}`);
    console.log(`🔒 Session secret configured: ${config.sessionSecret !== 'dev_secret_change_me' ? 'Yes' : 'No (using default)'}`);
    console.log(`🌐 CORS origins: ${Array.isArray(config.corsOrigin) ? config.corsOrigin.join(', ') : 'All origins allowed'}`);
    console.log(`📁 Static files served from: ${path.join(__dirname, 'uploads')}`);
  });
}

module.exports = app;