// Debug user projects query
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

console.log('Testing getUserProjects query...\n');

// Test the exact query
db.all(`
  SELECT p.id, p.project_code, p.name as project_name, up.granted_at as assigned_at
  FROM projects p
  INNER JOIN user_projects up ON p.id = up.project_id
  WHERE up.user_id = ?
  ORDER BY up.granted_at DESC
`, [1], (err, rows) => {
  if (err) {
    console.error('Query Error:', err);
  } else {
    console.log('Query Success - Projects for user 1:');
    console.log(JSON.stringify(rows, null, 2));
  }
  
  // Also check if tables exist
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'", (err, row) => {
    if (err) {
      console.error('Table check error:', err);
    } else {
      console.log('\nProjects table exists:', !!row);
    }
  });
  
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='user_projects'", (err, row) => {
    if (err) {
      console.error('Table check error:', err);
    } else {
      console.log('User_projects table exists:', !!row);
    }
    
    // Check user_projects content
    db.all("SELECT * FROM user_projects LIMIT 5", (err, rows) => {
      if (err) {
        console.error('User_projects content error:', err);
      } else {
        console.log('\nUser_projects table content:');
        console.log(JSON.stringify(rows, null, 2));
      }
      db.close();
    });
  });
});