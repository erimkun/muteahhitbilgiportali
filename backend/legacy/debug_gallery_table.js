// Check gallery table and recent uploads
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

console.log('Checking gallery_images table...\n');

// Check gallery table structure
db.all("PRAGMA table_info(gallery_images)", (err, columns) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Gallery table columns:');
    columns.forEach(col => {
      console.log(`- ${col.name} (${col.type})`);
    });
  }
  
  // Check recent gallery entries
  console.log('\n--- Recent gallery entries ---');
  db.all("SELECT * FROM gallery_images ORDER BY created_at DESC LIMIT 10", (err, rows) => {
    if (err) {
      console.error('Gallery query error:', err);
    } else {
      console.log(`Found ${rows.length} gallery entries:`);
      rows.forEach(row => {
        console.log(`ID: ${row.id}, Project: ${row.project_id}, Album: ${row.album}, File: ${row.filename}, Created: ${row.created_at}`);
      });
    }
    
    // Check specifically for project 1094_5
    console.log('\n--- Project 1094_5 gallery entries ---');
    db.all("SELECT * FROM gallery_images WHERE project_id = '1094_5'", (err, rows) => {
      if (err) {
        console.error('Project 1094_5 query error:', err);
      } else {
        console.log(`Found ${rows.length} entries for project 1094_5:`);
        rows.forEach(row => {
          console.log(`ID: ${row.id}, Album: ${row.album}, File: ${row.filename}, Created: ${row.created_at}`);
        });
      }
      
      db.close();
    });
  });
});