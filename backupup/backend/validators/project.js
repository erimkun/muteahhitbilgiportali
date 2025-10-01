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
    .isLength({ max: 2000 }).withMessage('Description too long'),
  body('toplam_insaat_alan')
    .optional()
    .isFloat({ min: 0 }).withMessage('Toplam inşaat alanı 0 veya pozitif bir sayı olmalıdır'),
  body('parsel_alan')
    .optional()
    .isFloat({ min: 0 }).withMessage('Parsel alanı 0 veya pozitif bir sayı olmalıdır'),
  body('bina_sayisi')
    .optional()
    .isInt({ min: 0 }).withMessage('Bina sayısı 0 veya pozitif bir tam sayı olmalıdır'),
  body('bagimsiz_birim_sayi')
    .optional()
    .isInt({ min: 0 }).withMessage('Bağımsız birim sayısı 0 veya pozitif bir tam sayı olmalıdır')
];

const updateProjectValidators = [
  param('id').isInt().withMessage('Project id must be an integer'),
  ...createProjectValidators
];

module.exports = { createProjectValidators, updateProjectValidators };
