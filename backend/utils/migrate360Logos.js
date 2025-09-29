#!/usr/bin/env node
/**
 * 360 Logo Dosyalarını Yeniden Adlandırma Script'i
 * Eski 360logo.gltf dosyalarını panorama_{projectCode}.gltf formatına çevirir
 */

const fs = require('fs');
const path = require('path');

const migrate360Logos = () => {
  const frontendPublicPath = path.join(__dirname, '../..', 'frontend', 'public');
  
  console.log('🔄 360 Logo migration başlatılıyor...');
  console.log(`📁 Frontend public path: ${frontendPublicPath}`);
  
  try {
    // Proje klasörlerini tara
    const items = fs.readdirSync(frontendPublicPath);
    const projectFolders = items.filter(folder => {
      const folderPath = path.join(frontendPublicPath, folder);
      return folder.endsWith('_project') && fs.statSync(folderPath).isDirectory();
    });
    
    console.log(`📦 ${projectFolders.length} proje klasörü bulundu: ${projectFolders.join(', ')}`);
    
    let migratedCount = 0;
    
    for (const projectFolder of projectFolders) {
      const projectCode = projectFolder.replace('_project', '');
      const viewsPath = path.join(frontendPublicPath, projectFolder, '360views');
      
      if (fs.existsSync(viewsPath)) {
        const oldLogoPath = path.join(viewsPath, '360logo.gltf');
        const newLogoPath = path.join(viewsPath, `panorama_${projectCode}.gltf`);
        
        if (fs.existsSync(oldLogoPath)) {
          if (!fs.existsSync(newLogoPath)) {
            // Yeniden adlandır
            fs.renameSync(oldLogoPath, newLogoPath);
            console.log(`✅ Renamed: ${projectFolder}/360views/360logo.gltf → panorama_${projectCode}.gltf`);
            migratedCount++;
          } else {
            console.log(`⚠️  ${projectFolder}: panorama_${projectCode}.gltf zaten mevcut, 360logo.gltf siliniyor`);
            fs.unlinkSync(oldLogoPath);
          }
        } else {
          console.log(`ℹ️  ${projectFolder}: 360logo.gltf bulunamadı (zaten migrate edilmiş olabilir)`);
        }
      } else {
        console.log(`ℹ️  ${projectFolder}: 360views klasörü bulunamadı`);
      }
    }
    
    console.log(`\n🎉 Migration tamamlandı: ${migratedCount} dosya yeniden adlandırıldı`);
    
  } catch (error) {
    console.error('❌ Migration hatası:', error);
    process.exit(1);
  }
};

// Reverse migration - acil durumlarda geri almak için
const revertMigration = () => {
  const frontendPublicPath = path.join(__dirname, '../..', 'frontend', 'public');
  
  console.log('🔄 360 Logo migration geri alınıyor...');
  
  try {
    const items = fs.readdirSync(frontendPublicPath);
    const projectFolders = items.filter(folder => {
      const folderPath = path.join(frontendPublicPath, folder);
      return folder.endsWith('_project') && fs.statSync(folderPath).isDirectory();
    });
    
    let revertedCount = 0;
    
    for (const projectFolder of projectFolders) {
      const projectCode = projectFolder.replace('_project', '');
      const viewsPath = path.join(frontendPublicPath, projectFolder, '360views');
      
      if (fs.existsSync(viewsPath)) {
        const newLogoPath = path.join(viewsPath, `panorama_${projectCode}.gltf`);
        const oldLogoPath = path.join(viewsPath, '360logo.gltf');
        
        if (fs.existsSync(newLogoPath) && !fs.existsSync(oldLogoPath)) {
          fs.renameSync(newLogoPath, oldLogoPath);
          console.log(`✅ Reverted: ${projectFolder}/360views/panorama_${projectCode}.gltf → 360logo.gltf`);
          revertedCount++;
        }
      }
    }
    
    console.log(`\n🎉 Revert tamamlandı: ${revertedCount} dosya geri alındı`);
    
  } catch (error) {
    console.error('❌ Revert hatası:', error);
    process.exit(1);
  }
};

// Eğer bu script direkt çalıştırılırsa
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--revert')) {
    revertMigration();
  } else {
    migrate360Logos();
  }
}

module.exports = { migrate360Logos, revertMigration };