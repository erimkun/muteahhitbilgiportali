/**
 * Error handling middleware for consistent error responses
 */

/**
 * Not found middleware - handles 404 errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function notFound(req, res, next) {
  // Skip logging for common browser/system requests to reduce noise
  const skipLogging = [
    '/.well-known/',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/apple-touch-icon',
    '/manifest.json'
  ].some(path => req.originalUrl.includes(path));
  
  const error = new Error(`Not found - ${req.originalUrl}`);
  error.skipLogging = skipLogging;
  res.status(404);
  next(error);
}

/**
 * General error handler middleware
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(error, req, res, next) {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  // Only log errors that are not browser/system technical requests
  if (!error.skipLogging) {
    console.error('Error occurred:', {
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }

  res.status(statusCode).json({
    error: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
}

/**
 * Async error wrapper to catch async/await errors
 * @param {Function} fn - Async function to wrap
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Database error handler - converts database errors to user-friendly messages
 * @param {Error} error - Database error
 */
function handleDatabaseError(error) {
  console.error('Database error:', error);
  
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new Error('A record with this information already exists.');
  }
  
  if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return new Error('Referenced record does not exist.');
  }
  
  return new Error('Database operation failed. Please try again.');
}

module.exports = {
  notFound,
  errorHandler,
  asyncHandler,
  handleDatabaseError
};