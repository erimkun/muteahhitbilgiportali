process.env.VALIDATION_STRICT = 'true';
const { loginValidators } = require('../validators/auth');
const { validationResult } = require('express-validator');

async function inspect() {
  const validators = loginValidators();
  const req = { body: { email: 'notanemail', password: 'short' } };
  for (const v of validators) await v.run(req);
  const res = validationResult(req);
  console.log('Validation errors:', res.array());
}

inspect().catch(err => console.error(err));
