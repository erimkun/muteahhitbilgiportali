const { sanitizeFilename } = require('../utils/sanitizeFilename');

test('sanitizeFilename removes path traversal and control chars', () => {
  const raw = '../secret\u0000name..\\evil.txt';
  const out = sanitizeFilename(raw);
  // allow dot for extension, but disallow slashes and backslashes
  expect(out).not.toMatch(/\\|\//);
  expect(out).not.toMatch(/[\x00-\x1f\x7f]/);
  expect(out.length).toBeGreaterThan(0);
});

test('sanitizeFilename limits length', () => {
  const long = 'a'.repeat(1000) + '.jpg';
  const out = sanitizeFilename(long);
  expect(out.length).toBeLessThanOrEqual(200);
});
