const path = require('path');
const fs = require('fs');

/**
 * Utility functions for common operations
 */

/**
 * Parse and validate project ID from request parameters
 * @param {string|number} param - Project ID parameter (can be string like "1094_5" or number like 1)
 * @returns {string|number} Valid project ID (returns as-is for string IDs, defaults to 1 for invalid numeric IDs)
 */
function parseProjectId(param) {
  if (!param) return '1';
  if (typeof param === 'string' && /[a-zA-Z_]/.test(param)) {
    return param; // already a project_code-like key
  }
  const n = Number(param);
  if (Number.isFinite(n) && n > 0) return String(Math.floor(n));
  return '1';
}

/**
 * Normalize phone number to digits only
 * @param {string} phone - Phone number string
 * @returns {string} Normalized phone number
 */
function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

/**
 * Generate safe filename for uploads
 * @param {string} originalName - Original filename
 * @returns {string} Safe filename with timestamp
 */
function generateSafeFilename(originalName) {
  const safeName = originalName.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return Date.now() + '_' + safeName;
}

/**
 * Ensure directory exists, create if not
 * @param {string} dirPath - Directory path
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get file extension from filename
 * @param {string} filename - Filename
 * @returns {string} File extension (lowercase)
 */
function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

/**
 * Check if file extension is allowed
 * @param {string} filename - Filename to check
 * @param {Array<string>} allowedExtensions - Array of allowed extensions
 * @returns {boolean} True if extension is allowed
 */
function isAllowedFileType(filename, allowedExtensions) {
  const ext = getFileExtension(filename);
  return allowedExtensions.includes(ext);
}

/**
 * Validate required fields in request body
 * @param {Object} body - Request body
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Object} Validation result with isValid and missing fields
 */
function validateRequiredFields(body, requiredFields) {
  const missing = requiredFields.filter(field => !body[field]);
  return {
    isValid: missing.length === 0,
    missing
  };
}

/**
 * Sanitize user input to prevent basic injection attacks
 * @param {string} input - User input string
 * @returns {string} Sanitized string
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.replace(/[<>\"']/g, '');
}

/**
 * Format error response object
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {Object} Formatted error response
 */
function formatErrorResponse(message, details = {}) {
  return {
    error: message,
    timestamp: new Date().toISOString(),
    ...details
  };
}

/**
 * Format success response object
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @returns {Object} Formatted success response
 */
function formatSuccessResponse(data = {}, message = 'Success') {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Check if request is from mobile device
 * @param {Object} req - Express request object
 * @returns {boolean} True if mobile device
 */
function isMobileDevice(req) {
  const userAgent = req.get('User-Agent') || '';
  return /Mobile|Android|iPhone|iPad/i.test(userAgent);
}

/**
 * Parse JSON safely
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed object or default value
 */
function parseJSONSafely(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Failed to parse JSON:', error.message);
    return defaultValue;
  }
}

/**
 * Generate pagination info
 * @param {number} total - Total number of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Pagination info
 */
function generatePaginationInfo(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext,
    hasPrev,
    nextPage: hasNext ? page + 1 : null,
    prevPage: hasPrev ? page - 1 : null
  };
}

module.exports = {
  parseProjectId,
  normalizePhone,
  generateSafeFilename,
  ensureDirectoryExists,
  getFileExtension,
  isAllowedFileType,
  validateRequiredFields,
  sanitizeInput,
  formatErrorResponse,
  formatSuccessResponse,
  isMobileDevice,
  parseJSONSafely,
  generatePaginationInfo
};