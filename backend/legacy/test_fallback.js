const Database = require('../database.js');

Database.all('SELECT * FROM gallery_images WHERE album = "drone_photos_file"', [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log(`Database entries for drone_photos_file: ${rows.length}`);
    rows.forEach(row => {
      console.log(`- ${row.url}`);
    });
    
    if (rows.length === 0) {
      console.log('\n🎯 FALLBACK ÇALIŞIYOR: Database boş olduğu için file system scan yapıyor!');
    } else {
      console.log('\n📊 DATABASE ÇALIŞIYOR: Database\'den entries getiriyor');
    }
  }
  process.exit(0);
});