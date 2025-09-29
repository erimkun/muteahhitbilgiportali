const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const uploadsDir = path.join(__dirname, 'uploads');
const db = new sqlite3.Database('./db.sqlite');

console.log('🔧 Migrating legacy files to project 400_111...\n');

/**
 * Migrate legacy files to project 400_111:
 * 
 * BEFORE:
 * uploads/
 *   ├── legacy/              <- These are actually project 400_111 files
 *   │   ├── drone_photos/
 *   │   ├── files/
 *   │   └── ...
 *   └── projects/
 *       ├── 1094_5/
 *       └── 3/
 * 
 * AFTER:
 * uploads/
 *   └── projects/
 *       ├── 400_111/         <- Legacy files moved here
 *       │   ├── drone_photos/
 *       │   ├── files/
 *       │   └── ...
 *       ├── 1094_5/
 *       └── 3/
 */

async function migrateLegacyToProject() {
  try {
    const legacyDir = path.join(uploadsDir, 'legacy');
    const projectsDir = path.join(uploadsDir, 'projects');
    const project400Dir = path.join(projectsDir, '400_111');
    
    // Create project 400_111 directory
    if (!fs.existsSync(project400Dir)) {
      fs.mkdirSync(project400Dir, { recursive: true });
      console.log('✅ Created projects/400_111 directory');
    }
    
    // Check if legacy directory exists
    if (!fs.existsSync(legacyDir)) {
      console.log('ℹ️  No legacy directory found, nothing to migrate');
      return;
    }
    
    // Get all folders in legacy directory
    const legacyFolders = fs.readdirSync(legacyDir);
    
    for (const folder of legacyFolders) {
      const legacyFolderPath = path.join(legacyDir, folder);
      const projectFolderPath = path.join(project400Dir, folder);
      
      // Check if it's a directory
      if (fs.statSync(legacyFolderPath).isDirectory()) {
        try {
          // Move folder to project 400_111
          fs.renameSync(legacyFolderPath, projectFolderPath);
          console.log(`📁 Moved legacy/${folder} → projects/400_111/${folder}`);
        } catch (error) {
          console.log(`⚠️  Could not move ${folder}: ${error.message}`);
        }
      }
    }
    
    // Remove empty legacy directory
    try {
      fs.rmdirSync(legacyDir);
      console.log('🗑️  Removed empty legacy directory');
    } catch (error) {
      console.log(`⚠️  Could not remove legacy directory: ${error.message}`);
    }
    
    // Update gallery_images database entries for project 1 → 400_111
    console.log('\n🔄 Updating database entries...');
    
    db.run(
      `UPDATE gallery_images SET project_id = '400_111' WHERE project_id = 1`,
      function(err) {
        if (err) {
          console.error('❌ Database update error:', err);
        } else {
          console.log(`✅ Updated ${this.changes} database entries: project_id 1 → '400_111'`);
        }
        
        // Also update URLs in database
        db.run(
          `UPDATE gallery_images SET url = REPLACE(url, '/upload/', '/upload/projects/400_111/') WHERE project_id = '400_111'`,
          function(err) {
            if (err) {
              console.error('❌ URL update error:', err);
            } else {
              console.log(`✅ Updated ${this.changes} URLs to new project structure`);
            }
            
            console.log('\n🎉 Migration completed!');
            console.log('\n📋 New structure:');
            console.log('uploads/');
            console.log('└── projects/');
            console.log('    ├── 400_111/    (legacy files)');
            console.log('    ├── 1094_5/');
            console.log('    └── 3/');
            
            db.close();
          }
        );
      }
    );
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    db.close();
  }
}

// Execute migration
migrateLegacyToProject();