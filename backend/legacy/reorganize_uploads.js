const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const uploadsDir = path.join(__dirname, 'uploads');
const db = new sqlite3.Database('./db.sqlite');

console.log('🔧 Starting uploads folder reorganization...\n');

/**
 * Reorganize uploads folder structure:
 * 
 * BEFORE (messy):
 * uploads/
 *   ├── drone_photos/
 *   ├── files/
 *   ├── floor_plans/
 *   ├── view_360/
 *   ├── project_1094_5/
 *   └── project_3/
 * 
 * AFTER (organized):
 * uploads/
 *   ├── legacy/              <- Legacy files (admin only)
 *   │   ├── drone_photos/
 *   │   ├── files/
 *   │   ├── floor_plans/
 *   │   └── view_360/
 *   └── projects/            <- Project-based organization
 *       ├── 1094_5/
 *       │   ├── drone_photos/
 *       │   ├── files/
 *       │   ├── floor_plans/
 *       │   └── view_360/
 *       └── 400_111/
 *           ├── drone_photos/
 *           └── files/
 */

async function reorganizeUploads() {
  try {
    // Create new directory structure
    const legacyDir = path.join(uploadsDir, 'legacy');
    const projectsDir = path.join(uploadsDir, 'projects');
    
    if (!fs.existsSync(legacyDir)) {
      fs.mkdirSync(legacyDir, { recursive: true });
      console.log('✅ Created legacy directory');
    }
    
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
      console.log('✅ Created projects directory');
    }
    
    // Move legacy folders to legacy directory
    const legacyFolders = ['drone_photos', 'files', 'floor_plans', 'orthophoto', 'view_360', 'other'];
    
    for (const folder of legacyFolders) {
      const oldPath = path.join(uploadsDir, folder);
      const newPath = path.join(legacyDir, folder);
      
      if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        try {
          fs.renameSync(oldPath, newPath);
          console.log(`📁 Moved ${folder} to legacy/`);
        } catch (error) {
          console.log(`⚠️  Could not move ${folder}: ${error.message}`);
        }
      }
    }
    
    // Move project folders to projects directory
    const items = fs.readdirSync(uploadsDir);
    
    for (const item of items) {
      if (item.startsWith('project_')) {
        const projectId = item.replace('project_', '');
        const oldPath = path.join(uploadsDir, item);
        const newPath = path.join(projectsDir, projectId);
        
        if (!fs.existsSync(newPath)) {
          try {
            fs.renameSync(oldPath, newPath);
            console.log(`📂 Moved ${item} to projects/${projectId}/`);
          } catch (error) {
            console.log(`⚠️  Could not move ${item}: ${error.message}`);
          }
        }
      }
    }
    
    console.log('\n🎉 Uploads folder reorganization completed!');
    console.log('\n📋 New structure:');
    console.log('uploads/');
    console.log('├── legacy/           (admin-only access)');
    console.log('└── projects/         (project-based access)');
    
  } catch (error) {
    console.error('❌ Error during reorganization:', error);
  } finally {
    db.close();
  }
}

// Execute reorganization
reorganizeUploads();