const { createUserValidators, updateUserValidators } = require('../validators/user');
const { validationResult } = require('express-validator');

async function runValidators(validators, req) {
  for (const v of validators) await v.run(req);
  return validationResult(req);
}

test('create user validator permissive mode allows missing email', async () => {
  process.env.VALIDATION_STRICT = 'false';
  const req = { body: { name: 'Test User' } };
  const res = await runValidators(createUserValidators, req);
  expect(res.isEmpty()).toBe(true);
});

test('update user validator requires integer id', async () => {
  const req = { params: { id: 'abc' }, body: {} };
  const res = await runValidators(updateUserValidators, req);
  expect(res.isEmpty()).toBe(false);
});
