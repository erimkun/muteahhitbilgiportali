// Check user_projects table structure
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

console.log('Checking user_projects table structure...\n');

db.all("PRAGMA table_info(user_projects)", (err, columns) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('User_projects table columns:');
    columns.forEach(col => {
      console.log(`- ${col.name} (${col.type})`);
    });
  }
  db.close();
});