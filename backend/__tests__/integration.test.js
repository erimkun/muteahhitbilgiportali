const request = require('supertest');
const app = require('../index');

describe('Basic integration tests', () => {
  test('GET / responds with health json', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('environment');
  });

  test('GET /session responds with session info', async () => {
    const res = await request(app).get('/session').expect(200);

    // There are two possible shapes in the codebase depending on route ordering:
    // 1) { authenticated, admin, user }
    // 2) formatSuccessResponse wrapper: { success, message, data: { admin, user } }
    if (res.body && Object.prototype.hasOwnProperty.call(res.body, 'authenticated')) {
      expect(res.body).toHaveProperty('authenticated');
      expect(res.body).toHaveProperty('admin');
      expect(res.body).toHaveProperty('user');
    } else {
      // Wrapped format
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('admin');
      expect(res.body.data).toHaveProperty('user');
    }
  });
});
