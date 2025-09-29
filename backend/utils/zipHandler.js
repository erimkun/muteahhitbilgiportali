const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

/**
 * ZIP dosyalarını güvenli şekilde işleyen utility class
 */
class ZipHandler {
  /**
   * ZIP dosyasını çıkarır ve klasör yapısını korur
   * @param {string} zipPath - ZIP dosyasının yolu
   * @param {string} extractToPath - Çıkarılacak hedef klasör
   * @param {Object} options - İşleme seçenekleri
   * @returns {Promise<Object>} İşlem sonucu
   */
  static async extractZipFile(zipPath, extractToPath, options = {}) {
    try {
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      
      // Klasör yapısını analiz et
      const structure = this.analyzeZipStructure(entries);
      console.log(`[ZipHandler] ZIP analizi: ${structure.totalFiles} dosya, ${structure.directories.length} klasör`);
      
      // Güvenlik kontrolü - zararlı yolları filtrele
      const safeEntries = entries.filter(entry => {
        const entryPath = entry.entryName;
        const isSafe = !entryPath.includes('..') && !entryPath.startsWith('/') && !entryPath.includes('\\..\\');
        if (!isSafe) {
          console.warn(`[ZipHandler] Güvenlik riski: ${entryPath} filtrelendi`);
        }
        return isSafe;
      });
      
      console.log(`[ZipHandler] ${safeEntries.length} güvenli dosya çıkarılacak`);
      
      // Dosyaları çıkar
      for (const entry of safeEntries) {
        if (!entry.isDirectory) {
          const entryPath = path.join(extractToPath, entry.entryName);
          const entryDir = path.dirname(entryPath);
          
          // Klasörü oluştur
          if (!fs.existsSync(entryDir)) {
            fs.mkdirSync(entryDir, { recursive: true });
          }
          
          // Dosyayı yaz
          fs.writeFileSync(entryPath, entry.getData());
        }
      }
      
      // Ana dosyaları bul
      const mainFiles = this.findMainFiles(extractToPath, options.fileTypes || ['.json']);
      
      return {
        success: true,
        extractedFiles: safeEntries.filter(e => !e.isDirectory).length,
        structure: structure,
        mainFiles: mainFiles
      };
      
    } catch (error) {
      console.error('[ZipHandler] Çıkarma hatası:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * ZIP içeriğini analiz eder
   * @param {Array} entries - ZIP giriş listesi
   * @returns {Object} Yapı analizi
   */
  static analyzeZipStructure(entries) {
    const structure = {
      totalFiles: 0,
      directories: [],
      fileTypes: {}
    };
    
    entries.forEach(entry => {
      if (entry.isDirectory) {
        structure.directories.push(entry.entryName);
      } else {
        structure.totalFiles++;
        const ext = path.extname(entry.entryName).toLowerCase();
        structure.fileTypes[ext] = (structure.fileTypes[ext] || 0) + 1;
      }
    });
    
    return structure;
  }
  
  /**
   * Ana tileset dosyalarını bulur
   * @param {string} directory - Arama yapılacak klasör
   * @param {Array} fileTypes - Aranacak dosya uzantıları
   * @returns {Array} Bulunan ana dosyalar
   */
  static findMainFiles(directory, fileTypes = ['.json']) {
    const mainFiles = [];
    
    const searchDirectory = (dir, depth = 0) => {
      if (depth > 3) return; // Sonsuz loop koruması
      
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          searchDirectory(fullPath, depth + 1);
        } else {
          const ext = path.extname(file).toLowerCase();
          if (fileTypes.includes(ext)) {
            // Ana tileset dosyası kriterlerini kontrol et
            const isMainFile = this.isMainTilesetFile(file, fullPath);
            
            const priority = this.getTilesetPriority(file, fullPath);
            
            mainFiles.push({
              filename: file,
              path: fullPath,
              relativePath: path.relative(directory, fullPath),
              isMain: isMainFile,
              priority: priority
            });
            
            // Ana JSON dosyası bulundu
            console.log(`[ZipHandler] Found JSON file: ${file} (isMain: ${isMainFile}, priority: ${priority})`);
          }
        }
      }
    };
    
    searchDirectory(directory);
    
    // Öncelik sırasına göre sırala (yüksek öncelik önce)
    mainFiles.sort((a, b) => b.priority - a.priority);
    
    return mainFiles;
  }
  
  /**
   * Dosyanın ana tileset dosyası olup olmadığını kontrol eder
   * @param {string} filename - Dosya adı
   * @param {string} filePath - Dosya yolu
   * @returns {boolean} Ana dosya mı?
   */
  static isMainTilesetFile(filename, filePath) {
    const lowerName = filename.toLowerCase();
    
    // Ana tileset dosyası kriterleri - kesin kabul
    const mainFilePatterns = [
      'tileset.json',
      'scene.json', 
      'root.json',
      'production.json'
    ];
    
    // Kesin ana dosya isimleri
    if (mainFilePatterns.includes(lowerName)) {
      return true;
    }
    
    // Master dosya pattern'leri
    if (lowerName.startsWith('production') || 
        lowerName.startsWith('master') || 
        lowerName.startsWith('main')) {
      return true;
    }
    
    // İçeriğe göre kontrol (JSON dosyası ise)
    if (lowerName.endsWith('.json')) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);
        
        // Cesium 3D Tiles tileset kontrolü
        if (json.asset && json.asset.version && json.root) {
          // Master tileset kriterleri:
          
          // 1. Yüksek geometricError (>200) = master tileset
          const geometricError = json.geometricError || json.root.geometricError || 0;
          if (geometricError > 200) return true;
          
          // 2. Birden fazla children = master tileset  
          if (json.root.children && json.root.children.length > 1) return true;
          
          // 3. Büyük bounding volume = master tileset
          const sphere = json.root.boundingVolume?.sphere;
          if (sphere && sphere[3] > 300) return true; // Radius > 300
          
          // 4. Content URI'si Data/ ile başlıyorsa alt-tile değildir
          if (json.root.content && json.root.content.uri && 
              json.root.content.uri.startsWith('Data/')) {
            return false; // Bu bir alt-tile
          }
          
          // Diğer tileset dosyaları da kabul et (ama öncelik düşük)
          return true;
        }
        
        // glTF scene dosyası kontrolü
        if (json.scene !== undefined && json.scenes) {
          return true;
        }
        
      } catch (e) {
        // JSON parse hatası, ana dosya değil
        console.warn(`[ZipHandler] JSON parse error for ${filename}: ${e.message}`);
      }
    }
    
    return false;
  }
  
  /**
   * Tileset dosyası için öncelik puanı hesaplar
   * @param {string} filename - Dosya adı
   * @returns {number} Öncelik puanı (yüksek = daha önemli)
   */
   static getTilesetPriority(filename, filePath = null) {
    const lowerName = filename.toLowerCase();
    let priority = 10; // Base priority
    
    // En yüksek öncelik - kesin master tileset isimleri
    if (lowerName === 'tileset.json') return 1000;
    if (lowerName === 'scene.json') return 900;
    if (lowerName === 'root.json') return 800;
    
    // Çok yüksek öncelik - Production/Master isimleri
    if (lowerName.startsWith('production')) priority += 700;
    if (lowerName.startsWith('master')) priority += 650;
    if (lowerName.startsWith('main')) priority += 600;
    
    // Yüksek öncelik - Genel master dosya isimleri
    if (lowerName.includes('tileset')) priority += 500;
    if (lowerName.includes('scene')) priority += 450;
    if (lowerName.includes('root')) priority += 400;
    
    // JSON içeriğine dayalı öncelik hesaplama
    if (filePath && lowerName.endsWith('.json')) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(content);
        
        // Master tileset özellikleri
        if (json.root) {
          // Yüksek geometricError = master tileset
          const geometricError = json.geometricError || json.root.geometricError || 0;
          if (geometricError > 500) priority += 300;
          else if (geometricError > 200) priority += 200;
          else if (geometricError > 50) priority += 100;
          
          // Çoklu children = master tileset
          if (json.root.children && json.root.children.length > 1) {
            priority += 250;
          }
          
          // Bounding sphere büyüklüğü
          const sphere = json.root.boundingVolume?.sphere;
          if (sphere && sphere[3] > 300) priority += 150; // Büyük radius = master
        }
      } catch (e) {
        // JSON parse hatası, priority değişmez
      }
    }
    
    // Düşük öncelik - Detaylı tile dosyaları
    if (lowerName.includes('tile_') && !lowerName.includes('tileset')) {
      priority -= 100; // Alt-tile dosyalarının önceliğini düşür
    }
    
    // JSON dosyası base bonus
    if (lowerName.endsWith('.json')) priority += 50;
    
    return priority;
  }
  
  /**
   * Ana tileset JSON dosyasının ismini değiştir (içeriğe dokunma)
   * @param {string} tilesetPath - Tileset JSON dosya yolu
   * @param {string} newName - Yeni dosya adı
   */
  static renameTilesetFile(tilesetPath, newName) {
    try {
      console.log(`[ZipHandler] Renaming tileset: ${path.basename(tilesetPath)} → ${newName}`);
      
      const directory = path.dirname(tilesetPath);
      const newPath = path.join(directory, newName);
      
      // Dosyayı yeniden adlandır
      fs.renameSync(tilesetPath, newPath);
      
      console.log(`[ZipHandler] Tileset renamed successfully`);
      return newPath;
      
    } catch (error) {
      console.error(`[ZipHandler] Failed to rename tileset: ${error.message}`);
      return tilesetPath;
    }
  }
  

}

module.exports = ZipHandler;