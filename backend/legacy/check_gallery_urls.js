const Database = require('../database.js');

// First check table structure
Database.all("PRAGMA table_info(gallery_images)", [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Gallery Images Table Structure:');
    rows.forEach(row => {
      console.log(`Column: ${row.name}, Type: ${row.type}`);
    });
    
    // Now check URLs
    Database.all('SELECT * FROM gallery_images WHERE url LIKE "%view_360%" LIMIT 10', [], (err, rows) => {
      if (err) {
        console.error('Error checking URLs:', err);
      } else {
        console.log('\nGallery Images URLs:');
        rows.forEach(row => {
          console.log(`Project ${row.project_id}: ${row.url}`);
        });
      }
      process.exit(0);
    });
  }
});