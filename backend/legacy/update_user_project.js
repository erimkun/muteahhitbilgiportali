const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Updating user 2 project assignments...\n');

// Remove user 2 from project 1
db.run('DELETE FROM user_projects WHERE user_id = 2 AND project_id = 1', function(err) {
  if (err) {
    console.error('❌ Error removing from project 1:', err.message);
  } else {
    console.log('✅ Removed user 2 from project 1 (400_111)');
  }
  
  // Add user 2 to project 2
  db.run('INSERT INTO user_projects (user_id, project_id, permissions, granted_at) VALUES (2, 2, "read", datetime("now"))', function(err) {
    if (err) {
      console.error('❌ Error adding to project 2:', err.message);
    } else {
      console.log('✅ Added user 2 to project 2 (917_68)');
    }
    
    // Show final assignments
    db.all('SELECT up.*, p.project_code FROM user_projects up JOIN projects p ON up.project_id = p.id WHERE up.user_id = 2', (err, rows) => {
      if (err) {
        console.error('❌ Error checking assignments:', err.message);
      } else {
        console.log('\n📋 User 2 project assignments:');
        rows.forEach(row => {
          console.log(`   Project ${row.project_id} (${row.project_code}): ${row.permissions}`);
        });
      }
      
      db.close();
    });
  });
});