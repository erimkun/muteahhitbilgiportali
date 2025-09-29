const { body, param } = require('express-validator');

const isStrict = process.env.VALIDATION_STRICT === 'true';

// Common email validator that adapts to strict toggle
const emailValidator = () => (
  isStrict
    ? body('email').isEmail().withMessage('Geçerli bir e-posta girin').normalizeEmail()
    : body('email').optional().isString().trim().isLength({ min: 3 }).withMessage('Email kısa')
);

const createUserValidators = [
  emailValidator(),
  body('phone')
    .optional()
    .isString().trim().isLength({ min: 7 }).withMessage('Telefon kısa'),
  body('name')
    .optional()
    .isString().trim().isLength({ min: 2 }).withMessage('İsim kısa'),
  body('role')
    .optional()
    .isIn(['admin', 'user']).withMessage('Geçersiz rol')
];

const updateUserValidators = [
  param('id').isInt().withMessage('User id must be integer'),
  ...createUserValidators
];

// Admin-only endpoints
const adminCreateUserValidators = [
  emailValidator(),
  body('name').isString().trim().isLength({ min: 2 }).withMessage('İsim gerekli ve kısa olamaz'),
  body('role').optional().isIn(['admin', 'user']).withMessage('Geçersiz rol'),
  body('password').optional().isLength({ min: 8 }).withMessage('Parola en az 8 karakter olmalıdır')
];

// Assign a project to a user: POST /admin/users/:id/projects
const assignProjectValidators = [
  param('id').isInt().withMessage('User id must be integer'),
  body('projectId').isInt().withMessage('projectId must be integer')
];

module.exports = {
  createUserValidators,
  updateUserValidators,
  adminCreateUserValidators,
  assignProjectValidators
};
