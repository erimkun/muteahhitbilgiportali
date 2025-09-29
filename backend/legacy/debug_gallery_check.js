const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database bağlantısını oluştur
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking gallery_images table...\n');

// Gallery images tablosundaki tüm kayıtları getir
db.all('SELECT * FROM gallery_images', (err, galleryImages) => {
  if (err) {
    console.error('❌ Error:', err.message);
    db.close();
    return;
  }
  
  console.log('📸 Gallery Images:');
  console.log('==================');
  
  if (galleryImages.length === 0) {
    console.log('No gallery images found.');
  } else {
    galleryImages.forEach((image, index) => {
      console.log(`${index + 1}. ID: ${image.id}`);
      console.log(`   Project ID: ${image.project_id}`);
      console.log(`   Filename: ${image.filename}`);
      console.log(`   URL: ${image.url}`);
      console.log(`   Upload Date: ${image.upload_date}`);
      console.log('   ---');
    });
  }
  
  console.log(`\n📊 Total gallery images: ${galleryImages.length}`);
  
  // Project ID'lerin dağılımını kontrol et
  db.all(`
    SELECT project_id, COUNT(*) as count 
    FROM gallery_images 
    GROUP BY project_id
  `, (err, projectStats) => {
    if (err) {
      console.error('❌ Stats Error:', err.message);
    } else {
      console.log('\n📈 Images by Project:');
      console.log('====================');
      projectStats.forEach(stat => {
        console.log(`Project ${stat.project_id}: ${stat.count} images`);
      });
    }
    
    db.close();
  });
});