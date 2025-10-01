const { body } = require('express-validator');

/**
 * loginValidators: Accepts either phone or email plus password.
 * Admin login uses phone, so validator must allow phone-based auth.
 */
function loginValidators() {
  const isStrict = process.env.VALIDATION_STRICT === 'true';

  const phoneCheck = body('phone')
    .optional()
    .matches(/^0?5\d{9}$/)
    .withMessage('Geçerli bir Türkiye telefon numarası girin (05XXXXXXXXX)');

  const emailCheck = body('email')
    .optional()
    .isEmail()
    .withMessage('Geçerli bir e-posta adresi girin')
    .bail()
    .normalizeEmail();

  const passwordCheck = isStrict
    ? body('password').exists().withMessage('Şifre gerekli').isLength({ min: 8 }).withMessage('Şifre en az 8 karakter olmalıdır')
    : body('password').exists().withMessage('Şifre gerekli').isLength({ min: 6 }).withMessage('Şifre çok kısa');

  // At least one identifier (phone or email) must be present
  const presenceCheck = body().custom((value, { req }) => {
    if (!req.body.phone && !req.body.email) {
      throw new Error('Telefon veya email gereklidir');
    }
    return true;
  });

  return [presenceCheck, phoneCheck, emailCheck, passwordCheck];
}

module.exports = { loginValidators };
