const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Use a temp DB and uploads dir for isolation
process.env.DBSOURCE = path.join(os.tmpdir(), `test_db_${Date.now()}.sqlite`);
process.env.UPLOADS_DIR = path.join(os.tmpdir(), `test_uploads_${Date.now()}`);
process.env.ALLOW_LEGACY_ADMIN_LOGIN = 'true';

const app = require('../index');

describe('E2E upload flow (admin)', () => {
  const agent = request.agent(app);

  beforeAll(async () => {
    // Create uploads dir and ensure DB seeded admin exists
    const fs = require('fs').promises;
    const uploadsDir = process.env.UPLOADS_DIR;
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
    } catch (e) {
      // ignore
    }

    const db = require('../database');
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);

    // Wait for users table to exist and then insert or replace a seeded admin user (retry loop)
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const phone = process.env.ADMIN_PHONE || '05000000000';
      const tryInsert = () => {
        attempts++;
        // Use phone unique constraint to replace or insert admin user
        db.run('INSERT OR REPLACE INTO users (phone, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?)', [phone, hash, 'Test Admin', 'superadmin', 1], function(err) {
          if (err) {
            if (attempts > 50) return reject(err);
            // Table may not be ready yet, retry shortly
            return setTimeout(tryInsert, 100);
          }
          resolve();
        });
      };
      tryInsert();
    });
  });

  afterAll(async () => {
    // Cleanup: remove temp uploads and close DB connection
    const fs = require('fs').promises;
    const uploadsDir = process.env.UPLOADS_DIR;
    try {
      await fs.rm(uploadsDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }

    const db = require('../database');
    try { db.close(); } catch (e) {}
  });

  test('Admin login and simple file upload', async () => {
    // Login as seeded admin (prefer ADMIN_PHONE from env if set)
    const adminPhone = process.env.ADMIN_PHONE || '05000000000';
    const loginRes = await agent
      .post('/admin/login')
      .send({ phone: adminPhone, password: 'admin123' })
      .expect(200);

    expect(loginRes.body).toHaveProperty('success');

    // Upload a small PNG file via admin projects upload endpoint (category required)
    const pngBuffer = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]); // minimal PNG header
    const uploadRes = await agent
      .post('/admin/projects/upload')
      .field('projectId', '1')
      .field('category', 'drone_photos')
      .attach('files', pngBuffer, 'hello.png')
      .expect(200);

    expect(uploadRes.body).toHaveProperty('success');
    expect(uploadRes.body.success).toBe(true);
  }, 30000);
});
