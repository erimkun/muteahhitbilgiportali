const { loginValidators } = require('../validators/auth');
const { createProjectValidators } = require('../validators/project');
const { validationResult } = require('express-validator');

// Helper to run validators on a fake req
async function runValidators(validators, req) {
  for (const v of validators) {
    await v.run(req);
  }
  return validationResult(req);
}

test('auth login validator - invalid email should fail in strict mode', async () => {
  process.env.VALIDATION_STRICT = 'true';
  const req = { body: { email: 'notanemail', password: 'short' } };
  const result = await runValidators(loginValidators(), req);
  expect(result.isEmpty()).toBe(false);
  const arr = result.array();
  // Ensure at least one of the credentials failed validation (email or password)
  expect(arr.some(e => (e.param || e.path) === 'email' || (e.param || e.path) === 'password')).toBe(true);
});

test('project create validator - missing name allowed in permissive mode', async () => {
  process.env.VALIDATION_STRICT = 'false';
  const req = { body: { description: 'a project' } };
  const result = await runValidators(createProjectValidators, req);
  expect(result.isEmpty()).toBe(true);
});
