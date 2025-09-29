const { body, param } = require('express-validator');

const isStrict = process.env.VALIDATION_STRICT === 'true';

const createProjectValidators = [
  body('name')
    .optional(!isStrict)
    .isString().withMessage('Project name must be a string')
    .trim()
    .isLength({ min: 3 }).withMessage('Project name too short'),
  body('description')
    .optional()
    .isString().withMessage('Description must be a string')
    .isLength({ max: 2000 }).withMessage('Description too long')
];

const updateProjectValidators = [
  param('id').isInt().withMessage('Project id must be an integer'),
  ...createProjectValidators
];

module.exports = { createProjectValidators, updateProjectValidators };
