const { body, param } = require('express-validator');

const createModelValidators = [
  body('name').isString().trim().isLength({ min: 2 }).withMessage('Model ismi gerekli'),
  body('description').optional().isString().trim().isLength({ max: 2000 }).withMessage('Description too long')
];

const updateModelValidators = [
  param('id').isInt().withMessage('Model id must be integer'),
  ...createModelValidators
];

module.exports = { createModelValidators, updateModelValidators };
