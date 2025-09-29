const Database = require('../database.js');

Database.all('SELECT * FROM gallery_images WHERE album = "view_360"', [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('All view_360 entries:');
    rows.forEach((row, i) => {
      console.log(`${i+1}. Project: ${row.project_id}, URL: ${row.url}, Created: ${row.created_at}`);
    });
  }
  process.exit(0);
});