const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

console.log('=== GALLERY_IMAGES TABLE STRUCTURE ===');
db.all("PRAGMA table_info(gallery_images)", (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Gallery images columns:', rows);
  }
  
  console.log('\n=== GALLERY_IMAGES DATA ===');
  db.all("SELECT * FROM gallery_images", (err2, rows2) => {
    if (err2) {
      console.error('Gallery data error:', err2);
    } else {
      console.log('Gallery images:', JSON.stringify(rows2, null, 2));
    }
    
    console.log('\n=== PROJECT_ASSETS TABLE STRUCTURE ===');
    db.all("PRAGMA table_info(project_assets)", (err3, info) => {
      if (err3) {
        console.error('Assets info error:', err3);
      } else {
        console.log('Project assets columns:', info);
      }
      
      console.log('\n=== PROJECT_ASSETS DATA ===');
      db.all("SELECT * FROM project_assets", (err4, rows4) => {
        if (err4) {
          console.error('Assets data error:', err4);
        } else {
          console.log('Project assets:', JSON.stringify(rows4, null, 2));
        }
        db.close();
      });
    });
  });
});