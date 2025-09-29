#!/usr/bin/env node
/**
 * Hızlı Proje Ekleme Scripti
 * Kullanım: node add_project.js PROJECT_CODE "Project Name" "Description"
 * Örnek: node add_project.js 555_222 "Villa Projesi" "Lüks villa geliştirme projesi"
 */

const fs = require('fs').promises;
const path = require('path');
const { ProjectService } = require('../services/dbService');

async function createProject(projectCode, name, description) {
  try {
    console.log(`🚀 Creating project: ${projectCode}`);
    
    // 1. Database'e proje ekle
    console.log('📊 Adding to database...');
    const projectId = await ProjectService.createProject({
      project_code: projectCode,
      name: name,
      description: description
    });
    console.log(`✅ Project created with ID: ${projectId}`);
    
    // 2. Frontend asset klasörleri oluştur
    console.log('📁 Creating frontend folders...');
    const frontendBase = path.join(__dirname, '..', 'frontend', 'public', `${projectCode}_project`);
    await fs.mkdir(frontendBase, { recursive: true });
    await fs.mkdir(path.join(frontendBase, 'tiles'), { recursive: true });
    await fs.mkdir(path.join(frontendBase, 'models'), { recursive: true });
    await fs.mkdir(path.join(frontendBase, '360views'), { recursive: true });
    
    // 3. Backend upload klasörleri oluştur
    console.log('📂 Creating backend folders...');
    const backendBase = path.join(__dirname, 'uploads', 'projects', projectCode);
    const albums = ['drone_photos', 'floor_plans', 'fbx_model_file', 'muteahhit', 'orthophoto', 'view_360', 'other'];
    
    for (const album of albums) {
      await fs.mkdir(path.join(backendBase, album), { recursive: true });
    }
    
    // 4. Placeholder tileset dosyası oluştur
    console.log('🎯 Creating placeholder tileset...');
    const tilesetContent = {
      asset: { version: "1.0" },
      geometricError: 500,
      root: {
        boundingVolume: {
          region: [0.5, 0.5, 0.6, 0.6, 0, 100]
        },
        geometricError: 0,
        refine: "REPLACE"
      }
    };
    
    await fs.writeFile(
      path.join(frontendBase, 'tiles', `sezyum_${projectCode}.json`),
      JSON.stringify(tilesetContent, null, 2)
    );
    
    console.log('🎉 Project setup completed successfully!');
    console.log(`📍 Access URL: http://localhost:5174/app/${projectId}`);
    console.log(`📁 Frontend assets: frontend/public/${projectCode}_project/`);
    console.log(`📂 Backend uploads: backend/uploads/projects/${projectCode}/`);
    
    return projectId;
    
  } catch (error) {
    console.error('❌ Error creating project:', error.message);
    process.exit(1);
  }
}

// Command line kullanımı
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node add_project.js PROJECT_CODE "Project Name" ["Description"]');
    console.log('Example: node add_project.js 555_222 "Villa Projesi" "Lüks villa geliştirme projesi"');
    process.exit(1);
  }
  
  const [projectCode, name, description = ''] = args;
  createProject(projectCode, name, description);
}

module.exports = { createProject };
