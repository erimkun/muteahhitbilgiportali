const path = require('path');
const { logger } = require('../utils/helpers');
const { sanitizeFilename } = require('../utils/sanitizeFilename');

// Allowed mime types and max size (bytes) — configurable via env in future
const ALLOWED_MIMES = [
  // Images
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff',
  // Documents
  'application/pdf',
  // Microsoft Office files
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  // Text files
  'text/plain',
  'text/csv',
  'application/rtf',
  // Video
  'video/mp4',
  // CAD files (often come as octet-stream)
  'application/octet-stream',
  'application/acad',
  'image/vnd.dwg',
  'application/dwg',
  'application/x-dwg',
  'application/x-autocad'
];
const MAX_FILE_SIZE = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024); // 10MB default

function validateAndSanitizeFiles(req, res, next) {
  try {
    // Normalize multer's possible shapes for uploaded files:
    // - req.file (single file)
    // - req.files (array)
    // - req.files (object) when using fields(), e.g. { photos: [..], docs: [..] }
    let raw = req.files || (req.file ? [req.file] : []);
    let files = [];

    if (Array.isArray(raw)) {
      files = raw;
    } else if (raw && typeof raw === 'object') {
      // object map of arrays
      for (const k of Object.keys(raw)) {
        const v = raw[k];
        if (Array.isArray(v)) files.push(...v);
        else if (v) files.push(v);
      }
    }

    for (const file of files) {
      if (!file) continue;

      // Mime-type check
      if (file.mimetype && !ALLOWED_MIMES.includes(file.mimetype)) {
        logger && logger.warn && logger.warn(`Blocked upload mime: ${file.mimetype}`);
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      // Size check
      const size = file.size || (file.buffer && file.buffer.length) || 0;
      if (size && size > MAX_FILE_SIZE) {
        logger && logger.warn && logger.warn(`Blocked upload size: ${file.size}`);
        return res.status(413).json({ error: 'File too large' });
      }

      // Sanitize filename and attach sanitizedName
      const original = file.originalname || file.filename || 'file';
      const ext = path.extname(original);
      const base = path.basename(original, ext);
      const sanitized = sanitizeFilename(base) + ext.replace(/\s+/g, '');
      file.sanitizedName = sanitized;
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { validateAndSanitizeFiles };
