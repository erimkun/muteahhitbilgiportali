const Database = require('../database.js');
const fs = require('fs');
const path = require('path');

console.log('=== FIXING WRONG DATABASE URLs ===\n');

const fixes = [
  {
    id: 10,
    filename: '1755777420480_drone.zip',
    newAlbum: 'drone_photos_file',
    newUrl: '/upload/projects/400_111/drone_photos_file/1755777420480_drone.zip'
  },
  {
    id: 26,
    filename: '1755846538718_FBX_Dosya.zip',
    newAlbum: 'fbx_model_file',
    newUrl: '/upload/projects/400_111/fbx_model_file/1755846538718_FBX_Dosya.zip'
  },
  {
    id: 27,
    filename: '1755847937855_KENT_A___AL___POLAT_400_ADA_111_PARSEL_AVAN_PROJE.dwg',
    newAlbum: 'floor_plans_file',
    newUrl: '/upload/projects/400_111/floor_plans_file/1755847937855_KENT_A___AL___POLAT_400_ADA_111_PARSEL_AVAN_PROJE.dwg'
  }
];

console.log('Fixing entries:');
fixes.forEach((fix, i) => {
  console.log(`${i+1}. ID: ${fix.id}`);
  console.log(`   File: ${fix.filename}`);
  console.log(`   New Album: ${fix.newAlbum}`);
  console.log(`   New URL: ${fix.newUrl}`);
  
  // Check if file actually exists
  const actualPath = path.join(__dirname, fix.newUrl.replace('/upload/projects/', 'uploads/projects/'));
  const exists = fs.existsSync(actualPath);
  console.log(`   File exists: ${exists ? '✓' : '✗'}`);
  
  if (exists) {
    Database.run('UPDATE gallery_images SET album = ?, url = ? WHERE id = ?', [fix.newAlbum, fix.newUrl, fix.id], function(err) {
      if (err) {
        console.error(`   Error updating ID ${fix.id}:`, err);
      } else {
        console.log(`   ✅ Updated ID ${fix.id}`);
      }
    });
  } else {
    console.log(`   ⚠️ File not found, skipping update`);
  }
  console.log('');
});

setTimeout(() => {
  console.log('Database URL fix completed!');
  process.exit(0);
}, 2000);