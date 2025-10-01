const { body, param } = require('express-validator');

const projectIdValidator = (value) => {
  if (typeof value !== 'string') {
    throw new Error('projectId must be provided');
  }

  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return true;
  }

  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return true;
  }

  throw new Error('projectId must be a numeric id or project code');
};

const uploadValidators = [
  param('projectId').custom(projectIdValidator),
  param('album').optional().isString().trim().isLength({ min: 1 }).withMessage('Album invalid'),
  body('category').optional().isString().trim(),
  body('title').optional().isString().trim().isLength({ min: 1 }).withMessage('Title invalid'),
  body('description').optional().isString().trim().isLength({ max: 2000 }).withMessage('Description too long'),
  // Optional client-provided mime and size (server should validate actual file)
  body('mimeType').optional().isString().trim(),
  body('size').optional().isInt({ min: 1 }).withMessage('Size must be a positive integer')
];

const deleteByFilenameValidators = [
  param('projectId').custom(projectIdValidator),
  param('album').isString().trim().isLength({ min: 1 }).withMessage('Album invalid'),
  param('filename').isString().trim().isLength({ min: 1 }).withMessage('Filename invalid')
];

const bulkDeleteValidators = [
  param('projectId').custom(projectIdValidator),
  param('album').isString().trim().isLength({ min: 1 }).withMessage('Album invalid'),
  body('ids').isArray({ min: 1 }).withMessage('Provide ids array')
];

module.exports = { projectIdValidator, uploadValidators, deleteByFilenameValidators, bulkDeleteValidators };
