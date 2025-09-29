const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Database bağlantısını oluştur
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Creating/updating admin user...\n');

const adminPhone = '05326225500';
const adminPassword = 'admin123';
const adminName = 'Admin';

// Şifreyi hash'le
const passwordHash = bcrypt.hashSync(adminPassword, 10);

// Admin kullanıcıyı güncelle veya oluştur
const updateQuery = `
  UPDATE users 
  SET password_hash = ?, name = ?, role = 'admin'
  WHERE phone = ?
`;

db.run(updateQuery, [passwordHash, adminName, adminPhone], function(err) {
  if (err) {
    console.error('❌ Error updating admin:', err.message);
  } else if (this.changes === 0) {
    // Kullanıcı yoksa oluştur
    const insertQuery = `
      INSERT INTO users (phone, password_hash, name, role, is_active, created_at)
      VALUES (?, ?, ?, 'admin', 1, datetime('now'))
    `;
    
    db.run(insertQuery, [adminPhone, passwordHash, adminName], function(err) {
      if (err) {
        console.error('❌ Error creating admin:', err.message);
      } else {
        console.log('✅ Admin user created successfully!');
        console.log(`   Phone: ${adminPhone}`);
        console.log(`   Password: ${adminPassword}`);
      }
      
      db.close();
    });
  } else {
    console.log('✅ Admin user updated successfully!');
    console.log(`   Phone: ${adminPhone}`);
    console.log(`   Password: ${adminPassword}`);
    
    db.close();
  }
});