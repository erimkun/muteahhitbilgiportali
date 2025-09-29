const Database = require('../database.js');

console.log('=== CHECKING WRONG URL PATTERNS ===\n');

Database.all('SELECT id, album, url, filename FROM gallery_images WHERE url LIKE "%/files/%" OR url LIKE "%files%"', [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  console.log(`Found ${rows.length} entries with wrong URL patterns:`);
  rows.forEach(row => {
    console.log(`ID: ${row.id}, Album: ${row.album}, URL: ${row.url}, File: ${row.filename}`);
  });
  
  process.exit(0);
});