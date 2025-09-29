const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

console.log('=== DATABASE TABLES ===');
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Tables:', rows.map(r => r.name));
  }
  
  console.log('\n=== PROJECT_GALLERY DATA ===');
  db.all("SELECT * FROM project_gallery WHERE project_id = 1", (err2, rows2) => {
    if (err2) {
      console.error('Gallery error:', err2);
    } else {
      console.log('Project gallery entries:', JSON.stringify(rows2, null, 2));
    }
    
    console.log('\n=== ALL PROJECTS ===');
    db.all("SELECT * FROM projects", (err3, rows3) => {
      if (err3) {
        console.error('Projects error:', err3);
      } else {
        console.log('Projects:', JSON.stringify(rows3, null, 2));
      }
      db.close();
    });
  });
});