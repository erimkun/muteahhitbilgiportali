const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Checking projects table structure...\n');

db.all("PRAGMA table_info(projects)", (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Projects table columns:');
    rows.forEach((column, index) => {
      console.log(`${index + 1}. ${column.name} (${column.type}) - ${column.notnull ? 'NOT NULL' : 'NULL'} - Default: ${column.dflt_value || 'NULL'}`);
    });
  }
  
  console.log('\nChecking some sample data...');
  db.all("SELECT * FROM projects LIMIT 3", (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('\nSample projects data:');
      rows.forEach((row, index) => {
        console.log(`${index + 1}.`, row);
      });
    }
    db.close();
  });
});