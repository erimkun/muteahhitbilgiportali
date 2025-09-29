const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database bağlantısını oluştur
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Fixing gallery URLs for project 400_111...\n');

// Eski format URL'leri yeni format'a çevir
const updateQueries = [
  // drone_photos
  {
    old: '/uploads/drone_photos/',
    new: '/upload/projects/400_111/drone_photos/'
  },
  // orthophoto  
  {
    old: '/uploads/orthophoto/',
    new: '/upload/projects/400_111/orthophoto/'
  },
  // files
  {
    old: '/uploads/files/',
    new: '/upload/projects/400_111/files/'
  },
  // view_360
  {
    old: '/uploads/view_360/',
    new: '/upload/projects/400_111/view_360/'
  },
  // floor_plans
  {
    old: '/uploads/floor_plans/',
    new: '/upload/projects/400_111/floor_plans/'
  },
  // other
  {
    old: '/uploads/other/',
    new: '/upload/projects/400_111/other/'
  }
];

let updateCount = 0;
let totalUpdates = updateQueries.length;
let completedUpdates = 0;

updateQueries.forEach(update => {
  const query = `UPDATE gallery_images SET url = REPLACE(url, ?, ?) WHERE url LIKE ?`;
  
  db.run(query, [update.old, update.new, `${update.old}%`], function(err) {
    if (err) {
      console.error(`❌ Error updating ${update.old}:`, err.message);
    } else {
      console.log(`✅ Updated ${this.changes} URLs: ${update.old} → ${update.new}`);
      updateCount += this.changes;
    }
    
    completedUpdates++;
    
    if (completedUpdates === totalUpdates) {
      console.log(`\n🎉 Total URLs updated: ${updateCount}`);
      
      // Güncellenmiş durumu kontrol et
      db.all('SELECT id, url FROM gallery_images WHERE project_id = "400_111"', (err, rows) => {
        if (err) {
          console.error('❌ Error checking results:', err.message);
        } else {
          console.log('\n📋 Updated URLs:');
          console.log('================');
          rows.forEach(row => {
            console.log(`ID ${row.id}: ${row.url}`);
          });
        }
        
        db.close();
      });
    }
  });
});