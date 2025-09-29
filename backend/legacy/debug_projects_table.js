// Check projects table structure
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

console.log('Checking projects table structure...\n');

db.all("PRAGMA table_info(projects)", (err, columns) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Projects table columns:');
    columns.forEach(col => {
      console.log(`- ${col.name} (${col.type})`);
    });
  }
  
  // Also check actual data
  db.all("SELECT * FROM projects LIMIT 3", (err, rows) => {
    if (err) {
      console.error('Data error:', err);
    } else {
      console.log('\nProjects table sample data:');
      console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
  });
});