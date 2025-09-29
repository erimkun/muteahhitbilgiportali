const fs = require('fs');
const path = require('path');

/**
 * Frontend asset dosyalarının otomatik isimlendirmesini yöneten utility
 */
class FileNaming {
  /**
   * Kategori bazlı dosya isimlendirme kuralları
   */
  static namingPatterns = {
    'frontend_models': {
      '.gltf': (projectCode) => `bina_model.gltf`,
      '.glb': (projectCode) => `bina_model.glb`,
      '.bin': (projectCode, originalName) => {
        // Binary dosyalar için orijinal ismi koru ama prefix ekle
        const baseName = path.basename(originalName, '.bin');
        return `${baseName}.bin`;
      }
    },
    'frontend_360views': {
      '.gltf': (projectCode) => `panorama_${projectCode}.gltf`, // ✅ 360 logo modeli
      '.glb': (projectCode) => `panorama_${projectCode}.glb`,   // ✅ 360 logo modeli
      '.jpg': (projectCode, originalName) => {
        // 360 görüntüleri için orijinal adları koru
        return originalName;
      },
      '.jpeg': (projectCode, originalName) => {
        return originalName;
      },
      '.png': (projectCode, originalName) => {
        return originalName;
      }
    },
    'frontend_tiles': {
      '.json': (projectCode) => `sezyum_${projectCode}.json`,
      // Diğer tileset dosyaları orijinal isimlerini korsun
      '.b3dm': (projectCode, originalName) => originalName,
      '.i3dm': (projectCode, originalName) => originalName,
      '.pnts': (projectCode, originalName) => originalName,
      '.cmpt': (projectCode, originalName) => originalName,
      '.bin': (projectCode, originalName) => originalName
    }
  };

  /**
   * Dosya adını kategoriye göre yeniden adlandırır
   * @param {string} category - Upload kategorisi
   * @param {string} originalFilename - Orijinal dosya adı
   * @param {string} projectCode - Proje kodu
   * @param {string} targetDirectory - Hedef klasör yolu
   * @returns {Object} Yeni dosya bilgileri
   */
  static generateFileName(category, originalFilename, projectCode, targetDirectory) {
    const ext = path.extname(originalFilename).toLowerCase();
    const patterns = this.namingPatterns[category];
    
    if (!patterns || !patterns[ext]) {
      // Pattern yoksa orijinal ismi koru
      return {
        newFilename: originalFilename,
        renamed: false,
        reason: 'No naming pattern defined'
      };
    }
    
    // Yeni ismi oluştur
    const nameGenerator = patterns[ext];
    let newFilename;
    
    if (typeof nameGenerator === 'function') {
      newFilename = nameGenerator(projectCode, originalFilename);
    } else {
      newFilename = nameGenerator;
    }
    
    // Çakışma kontrolü yap
    const finalFilename = this.resolveNameConflict(newFilename, targetDirectory);
    
    return {
      originalFilename,
      newFilename: finalFilename,
      renamed: originalFilename !== finalFilename,
      reason: originalFilename !== finalFilename ? 'Auto-renamed by pattern' : 'No change needed'
    };
  }

  /**
   * Dosya adı çakışmasını çözer
   * @param {string} desiredFilename - İstenen dosya adı
   * @param {string} targetDirectory - Hedef klasör
   * @returns {string} Çakışmayan dosya adı
   */
  static resolveNameConflict(desiredFilename, targetDirectory) {
    if (!fs.existsSync(targetDirectory)) {
      return desiredFilename;
    }
    
    const fullPath = path.join(targetDirectory, desiredFilename);
    
    if (!fs.existsSync(fullPath)) {
      return desiredFilename;
    }
    
    // Çakışma var, sayı ekle
    const ext = path.extname(desiredFilename);
    const baseName = path.basename(desiredFilename, ext);
    
    let counter = 2;
    let newFilename;
    
    do {
      newFilename = `${baseName}_${counter}${ext}`;
      const newFullPath = path.join(targetDirectory, newFilename);
      
      if (!fs.existsSync(newFullPath)) {
        break;
      }
      
      counter++;
    } while (counter < 100); // Sonsuz loop koruması
    
    console.log(`[FileNaming] Çakışma çözüldü: ${desiredFilename} -> ${newFilename}`);
    return newFilename;
  }

  /**
   * Toplu dosya yeniden adlandırma
   * @param {Array} files - Dosya listesi
   * @param {string} category - Kategori
   * @param {string} projectCode - Proje kodu
   * @param {string} targetDirectory - Hedef klasör
   * @returns {Array} Yeniden adlandırma sonuçları
   */
  static batchRename(files, category, projectCode, targetDirectory) {
    const results = [];
    
    // Önce tüm yeni isimleri hesapla
    for (const file of files) {
      const result = this.generateFileName(category, file.filename, projectCode, targetDirectory);
      result.originalPath = file.path;
      results.push(result);
    }
    
    // Sonra fiziksel olarak yeniden adlandır
    for (const result of results) {
      if (result.renamed) {
        try {
          const newPath = path.join(targetDirectory, result.newFilename);
          fs.renameSync(result.originalPath, newPath);
          result.newPath = newPath;
          result.success = true;
          console.log(`[FileNaming] Renamed: ${result.originalFilename} -> ${result.newFilename}`);
        } catch (error) {
          result.success = false;
          result.error = error.message;
          console.error(`[FileNaming] Rename failed: ${result.originalFilename}`, error);
        }
      } else {
        result.success = true;
        result.newPath = result.originalPath;
      }
    }
    
    return results;
  }

  /**
   * Kategori için desteklenen dosya uzantılarını döndürür
   * @param {string} category - Kategori adı
   * @returns {Array} Desteklenen uzantılar
   */
  static getSupportedExtensions(category) {
    const patterns = this.namingPatterns[category];
    return patterns ? Object.keys(patterns) : [];
  }

  /**
   * Dosyanın isimlendirme kuralına uygun olup olmadığını kontrol eder
   * @param {string} filename - Dosya adı
   * @param {string} category - Kategori
   * @param {string} projectCode - Proje kodu
   * @returns {boolean} Kurallara uygun mu?
   */
  static isValidNaming(filename, category, projectCode) {
    const ext = path.extname(filename).toLowerCase();
    const patterns = this.namingPatterns[category];
    
    if (!patterns || !patterns[ext]) {
      return true; // Pattern yoksa her isim geçerli
    }
    
    const expectedName = patterns[ext](projectCode, filename);
    return filename === expectedName;
  }
}

module.exports = FileNaming;