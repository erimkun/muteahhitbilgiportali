const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
console.log('📄 Database path:', dbPath);

const db = new sqlite3.Database(dbPath);

console.log('\n🔍 DEBUGGING PROJECT 1 FILES\n');

// 1. Check if project 1 exists
db.get("SELECT * FROM projects WHERE id = 1", [], (err, project) => {
  if (err) {
    console.error('❌ Project query error:', err);
    return;
  }
  
  console.log('🏗️  Project 1 info:');
  if (project) {
    console.log(`   ID: ${project.id}`);
    console.log(`   Name: ${project.name}`);
    console.log(`   Project Code: ${project.project_code}`);
  } else {
    console.log('   ❌ Project 1 not found!');
  }
  
  // 2. Check gallery_images for project 1
  console.log('\n📁 Gallery images for project 1:');
  db.all("SELECT id, album, filename, title, url FROM gallery_images WHERE project_id = 1", [], (err, files) => {
    if (err) {
      console.error('❌ Gallery query error:', err);
      return;
    }
    
    console.log(`   Total files: ${files.length}`);
    
    if (files.length === 0) {
      console.log('   ❌ No files found for project 1!');
    } else {
      // Group by album
      const albums = {};
      files.forEach(file => {
        if (!albums[file.album]) albums[file.album] = [];
        albums[file.album].push(file);
      });
      
      Object.keys(albums).forEach(album => {
        console.log(`\n   📂 ${album} (${albums[album].length} files):`);
        albums[album].forEach(file => {
          console.log(`      - ${file.filename} (ID: ${file.id})`);
        });
      });
    }
    
    // 3. Test specific API endpoint simulation
    console.log('\n🧪 Simulating API call: /api/projects/1/gallery/drone_photos');
    
    db.all(
      "SELECT id, album, filename, url, title, created_at FROM gallery_images WHERE album = ? AND project_id = ? ORDER BY created_at DESC",
      ['drone_photos', 1],
      (err, rows) => {
        if (err) {
          console.error('❌ API simulation error:', err);
        } else {
          console.log(`✅ API would return ${rows.length} files:`);
          rows.forEach(row => {
            console.log(`   - ${row.filename} -> ${row.url}`);
          });
        }
        
        db.close();
        console.log('\n✨ Debug completed.');
      }
    );
  });
});