const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database bağlantısını oluştur
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking users table...\n');

// Users tablosundaki tüm kayıtları getir
db.all('SELECT * FROM users', (err, users) => {
  if (err) {
    console.error('❌ Error:', err.message);
    db.close();
    return;
  }
  
  console.log('👥 Users:');
  console.log('=========');
  
  if (users.length === 0) {
    console.log('No users found.');
  } else {
    users.forEach((user, index) => {
      console.log(`${index + 1}. User object:`, user);
      console.log('   ---');
    });
  }
  
  console.log(`\n📊 Total users: ${users.length}`);
  
  db.close();
});