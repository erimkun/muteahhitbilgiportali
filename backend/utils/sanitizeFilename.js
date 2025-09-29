const path = require('path');

// Simple filename sanitizer: remove path chars, control chars, and limit length
function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return '';
  // Get base name just in case
  let base = path.basename(name);
  // Remove control chars and non-printable
  base = base.replace(/[\x00-\x1f\x7f]/g, '');
  // Replace path traversal sequences
  base = base.replace(/(\.{2,}|\\|\/)+/g, '_');
  // Replace spaces with underscore
  base = base.replace(/\s+/g, '_');
  // Keep only safe chars
  base = base.replace(/[^a-zA-Z0-9._-]/g, '');
  // Limit length
  if (base.length > 200) base = base.slice(0, 200);
  return base || 'file';
}

module.exports = { sanitizeFilename };
