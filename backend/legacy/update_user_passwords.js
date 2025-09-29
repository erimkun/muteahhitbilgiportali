const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Database bağlantısını oluştur
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Updating user passwords...\n');

const users = [
  { phone: '05367666396', password: 'user123', name: 'Orchun Kayhan' },
  { phone: '05373111610', password: 'user123', name: 'Kral Umut' }
];

let updateCount = 0;

users.forEach(userData => {
  const passwordHash = bcrypt.hashSync(userData.password, 10);
  
  const updateQuery = `
    UPDATE users 
    SET password_hash = ?
    WHERE phone = ?
  `;
  
  db.run(updateQuery, [passwordHash, userData.phone], function(err) {
    if (err) {
      console.error(`❌ Error updating ${userData.name}:`, err.message);
    } else if (this.changes === 0) {
      console.log(`❌ User not found: ${userData.name} (${userData.phone})`);
    } else {
      console.log(`✅ Updated ${userData.name} password to: ${userData.password}`);
    }
    
    updateCount++;
    
    if (updateCount === users.length) {
      console.log('\n🎉 All user passwords updated!');
      db.close();
    }
  });
});