const Database = require('../database.js');
const fs = require('fs');
const path = require('path');

console.log('Cleaning up invalid gallery entries...\n');

// Get all view_360 entries for project 400_111
Database.all('SELECT * FROM gallery_images WHERE album = "view_360"', [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  console.log('Found entries:');
  rows.forEach((row, i) => {
    console.log(`${i+1}. ID: ${row.id}, URL: ${row.url}`);
  });
  
  let toDelete = [];
  let validEntries = [];
  
  // Check which files actually exist
  rows.forEach(row => {
    const urlPath = row.url;
    let actualPath = '';
    
    if (urlPath.startsWith('/upload/projects/')) {
      actualPath = path.join(__dirname, urlPath.replace('/upload/projects/', 'uploads/projects/'));
    }
    
    const exists = fs.existsSync(actualPath);
    console.log(`\nChecking: ${urlPath}`);
    console.log(`File path: ${actualPath}`);
    console.log(`Exists: ${exists}`);
    
    if (exists) {
      validEntries.push(row);
    } else {
      toDelete.push(row);
    }
  });
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Valid entries: ${validEntries.length}`);
  console.log(`Invalid entries to delete: ${toDelete.length}`);
  
  if (toDelete.length > 0) {
    console.log(`\nDeleting invalid entries:`);
    toDelete.forEach(row => {
      console.log(`- ID: ${row.id}, URL: ${row.url}`);
    });
    
    const deleteIds = toDelete.map(row => row.id).join(',');
    Database.run(`DELETE FROM gallery_images WHERE id IN (${deleteIds})`, [], function(err) {
      if (err) {
        console.error('Error deleting entries:', err);
      } else {
        console.log(`\n✓ Successfully deleted ${this.changes} invalid entries`);
      }
      process.exit(0);
    });
  } else {
    console.log('\nNo invalid entries to delete.');
    process.exit(0);
  }
});