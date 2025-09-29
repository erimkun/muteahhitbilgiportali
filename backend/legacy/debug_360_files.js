const Database = require('../database.js');
const fs = require('fs');
const path = require('path');

console.log('=== DEBUGGING 360 VIEW FILES ===\n');

// First check all tables
Database.all('SELECT name FROM sqlite_master WHERE type="table"', [], (err, tables) => {
  if (err) {
    console.error('Error getting tables:', err);
    process.exit(1);
  }
  
  console.log('Available tables:');
  tables.forEach(table => console.log('- ' + table.name));
  console.log('');
  
  // Check if gallery_images exists, if not use correct table name
  const hasGalleryImages = tables.some(t => t.name === 'gallery_images');
  const tableName = hasGalleryImages ? 'gallery_images' : 'gallery';
  
  console.log(`Using table: ${tableName}\n`);
  
  // 1. Check database entries for project 400_111 view_360
  Database.all(`SELECT * FROM ${tableName} WHERE project_id = 1 AND album = "view_360"`, [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  console.log('1. DATABASE ENTRIES FOR VIEW_360 (Project 400_111):');
  rows.forEach((row, i) => {
    console.log(`   ${i+1}. ID: ${row.id}`);
    console.log(`      URL: ${row.url}`);
    console.log(`      Filename: ${row.filename}`);
    console.log(`      Created: ${row.created_at}`);
    console.log('');
  });
  
  // 2. Check actual file system
  console.log('2. CHECKING FILE SYSTEM:');
  
  const paths = [
    'uploads/projects/400_111/view_360',
    'uploads/projects/400_111/project_1/view_360'
  ];
  
  paths.forEach(checkPath => {
    const fullPath = path.join(__dirname, checkPath);
    console.log(`\n   Checking: ${fullPath}`);
    
    try {
      if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath);
        console.log(`   ✓ Directory exists, files: ${files.length}`);
        files.forEach(file => {
          const filePath = path.join(fullPath, file);
          const stats = fs.statSync(filePath);
          console.log(`      - ${file} (${Math.round(stats.size/1024)}KB)`);
        });
      } else {
        console.log(`   ✗ Directory does not exist`);
      }
    } catch (error) {
      console.log(`   ✗ Error accessing directory: ${error.message}`);
    }
  });
  
  // 3. Check which URLs are accessible
  console.log('\n3. URL ANALYSIS:');
  rows.forEach((row, i) => {
    const urlPath = row.url;
    let actualPath = '';
    
    if (urlPath.startsWith('/upload/projects/')) {
      actualPath = path.join(__dirname, urlPath.replace('/upload/projects/', 'uploads/projects/'));
    } else if (urlPath.startsWith('/projects/')) {
      actualPath = path.join(__dirname, 'uploads', urlPath);
    }
    
    console.log(`\n   ${i+1}. URL: ${urlPath}`);
    console.log(`      Expected file: ${actualPath}`);
    
    try {
      if (fs.existsSync(actualPath)) {
        const stats = fs.statSync(actualPath);
        console.log(`      ✓ File exists (${Math.round(stats.size/1024)}KB)`);
      } else {
        console.log(`      ✗ File does not exist`);
      }
    } catch (error) {
      console.log(`      ✗ Error checking file: ${error.message}`);
    }
  });
  
    process.exit(0);
  });
});