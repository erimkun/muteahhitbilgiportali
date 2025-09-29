const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Database bağlantısını oluştur
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

const testPhone = '05326225500';
const testPassword = 'admin123';

console.log('🔍 Testing admin login...\n');

db.get('SELECT * FROM users WHERE phone = ? AND role = "admin"', [testPhone], (err, user) => {
  if (err) {
    console.error('❌ Database error:', err.message);
    db.close();
    return;
  }
  
  if (!user) {
    console.log('❌ Admin user not found with phone:', testPhone);
  } else {
    console.log('✅ Admin user found:');
    console.log('   ID:', user.id);
    console.log('   Phone:', user.phone);
    console.log('   Name:', user.name);
    console.log('   Role:', user.role);
    console.log('   Active:', user.is_active);
    console.log('   Hash:', user.password_hash);
    
    // Test password
    const isPasswordCorrect = bcrypt.compareSync(testPassword, user.password_hash);
    console.log(`\n🔑 Password test for "${testPassword}":`, isPasswordCorrect ? '✅ CORRECT' : '❌ WRONG');
    
    if (!isPasswordCorrect) {
      // Test other common passwords
      const commonPasswords = ['123456', 'admin', 'admin123456', 'password'];
      console.log('\n🔍 Testing common passwords:');
      commonPasswords.forEach(pwd => {
        const result = bcrypt.compareSync(pwd, user.password_hash);
        console.log(`   "${pwd}":`, result ? '✅ CORRECT' : '❌ WRONG');
      });
    }
  }
  
  db.close();
});