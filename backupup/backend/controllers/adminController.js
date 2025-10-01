const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { UserService, ProjectService, GalleryService } = require('../services/dbService');
const { formatErrorResponse, formatSuccessResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middlewares/errorHandler');
const { uploadCategories, createCategoryUpload } = require('../middlewares/uploadMiddleware');
const ZipHandler = require('../utils/zipHandler');
const FileNaming = require('../utils/fileNaming');

/**
 * Admin Management Controller
 * Handles comprehensive admin panel operations
 */

/**
 * Get admin dashboard statistics
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    const stats = {
      totalUsers: 0,
      totalProjects: 0,
      totalFiles: 0,
      activeUsers: 0
    };
    
    // Get user statistics
    const users = await UserService.getAllUsers();
    stats.totalUsers = users.length;
    stats.activeUsers = users.filter(u => u.is_active === 1).length;
    
    // Get project statistics
    const projects = await ProjectService.getAllProjects();
    stats.totalProjects = projects.length;
    
    // Count files in uploads directory
    try {
      const uploadsPath = path.join(__dirname, '..', 'uploads', 'projects');
      const projectDirs = await fs.readdir(uploadsPath);
      let fileCount = 0;
      
      for (const projectDir of projectDirs) {
        const projectPath = path.join(uploadsPath, projectDir);
        const stat = await fs.stat(projectPath);
        if (stat.isDirectory()) {
          const subDirs = await fs.readdir(projectPath);
          for (const subDir of subDirs) {
            const subDirPath = path.join(projectPath, subDir);
            try {
              const files = await fs.readdir(subDirPath);
              fileCount += files.length;
            } catch (e) {
              // Skip if not a directory or access error
            }
          }
        }
      }
      stats.totalFiles = fileCount;
    } catch (e) {
      console.error('Error counting files:', e);
      stats.totalFiles = 0;
    }
    
    res.json(formatSuccessResponse(stats));
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve dashboard statistics'));
  }
});

/**
 * Get all users with their project assignments
 */
const getAllUsersWithProjects = asyncHandler(async (req, res) => {
  try {
    const users = await UserService.getAllUsers();
    
    // For each user, get their project assignments
    const usersWithProjects = await Promise.all(users.map(async (user) => {
      const projects = await UserService.getUserProjects(user.id);
      return {
        ...user,
        assignedProjects: projects || []
      };
    }));
    
    res.json(formatSuccessResponse(usersWithProjects));
  } catch (error) {
    console.error('Get all users with projects error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve users'));
  }
});

/**
 * Get project files summary
 */
const getProjectFiles = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  console.log(`🔍 Getting files for project: ${projectId}`);
  
  try {
    const project = await ProjectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json(formatErrorResponse('Project not found'));
    }
    
    const files = {
      // Backend kategorileri (mevcut)
      drone_photos_jpg: [],
      drone_photos_zip: [],
      floor_plans_jpeg: [],
      floor_plans_dwg: [],
      orthophoto_jpeg: [],
      orthophoto_tiff: [],
      view_360: [],
      models_fbx: [],
      documents_pdf: [],
      files_zip: [],
      other: [],
      contractor_depot: [],
      
      // YENİ: Frontend kategorileri
      frontend_models: [],
      frontend_tiles: [],
      frontend_360views: [],
      frontend_tiles_zip: []
    };
    
    // Get files from uploads directory
    const projectPath = path.join(__dirname, '..', 'uploads', 'projects', project.project_code);
    
    try {
      const directories = await fs.readdir(projectPath);
      console.log(`🔍 Found directories in ${projectPath}:`, directories);

      for (const dir of directories) {
        const dirPath = path.join(projectPath, dir);
        const stat = await fs.stat(dirPath);

        if (stat.isDirectory()) {
          try {
            const dirFiles = await fs.readdir(dirPath);
            console.log(`🔍 Directory ${dir} has files:`, dirFiles);
            const fileDetails = await Promise.all(dirFiles.map(async (file) => {
              const filePath = path.join(dirPath, file);
              const fileStat = await fs.stat(filePath);

              // Sadece dosyaları döndür, directory'leri değil
              if (fileStat.isFile()) {
                return {
                  name: file,
                  size: fileStat.size,
                  modified: fileStat.mtime,
                  path: `projects/${project.project_code}/${dir}/${file}`
                };
              }
              return null;
            }));

            // null değerleri filtrele
            const filteredFileDetails = fileDetails.filter(file => file !== null);
            console.log(`🔍 Filtered files in ${dir}:`, filteredFileDetails.map(f => f.name));

            // Categorize files based on directory names and file extensions
            const categorizedFiles = fileDetails.map(file => {
              const fileExt = path.extname(file.name).toLowerCase();
              let category = 'other';

              // Handle backward compatibility with old directory names
              let normalizedDir = dir.toLowerCase();
              if (normalizedDir === 'drone_photos') normalizedDir = 'drone';
              if (normalizedDir === 'drone_photos_file') normalizedDir = 'drone_file';
              if (normalizedDir === 'floor_plans') normalizedDir = 'floor';
              if (normalizedDir === 'floor_plans_file') normalizedDir = 'floor_file';
              if (normalizedDir === 'orthophoto') normalizedDir = 'ortho';

              // Determine category based on directory and file extension
              if (normalizedDir.includes('drone') || normalizedDir.includes('photo')) {
                category = ['.zip', '.rar'].includes(fileExt) ? 'drone_photos_zip' : 'drone_photos_jpg';
              } else if (normalizedDir.includes('floor') || normalizedDir.includes('plan')) {
                category = ['.dwg', '.dxf'].includes(fileExt) ? 'floor_plans_dwg' : 'floor_plans_jpeg';
              } else if (normalizedDir.includes('ortho')) {
                category = ['.tiff', '.tif'].includes(fileExt) ? 'orthophoto_tiff' : 'orthophoto_jpeg';
              } else if (normalizedDir.includes('360') || normalizedDir.includes('view')) {
                category = 'view_360';
              } else if (normalizedDir.includes('model')) {
                category = 'models_fbx';
              } else if (normalizedDir.includes('document')) {
                category = 'documents_pdf';
              } else if (normalizedDir.includes('contractor') || normalizedDir.includes('depot')) {
                console.log(`🔍 Categorizing ${dir} as contractor_depot`);
                category = 'contractor_depot';
              } else if (normalizedDir.includes('drone_file')) {
                category = 'drone_photos_zip';
              } else if (normalizedDir.includes('floor_file')) {
                category = 'floor_plans_dwg';
              } else if (normalizedDir.includes('fbx') || normalizedDir.includes('model')) {
                category = 'models_fbx';
              } else if (normalizedDir.includes('muteahhit')) {
                console.log(`🔍 Categorizing ${dir} as contractor_depot (muteahhit)`);
                category = 'contractor_depot';
              } else if (normalizedDir.includes('file') || normalizedDir.includes('archive')) {
                category = 'files_zip';
              }

              console.log(`🔍 File ${file.name} in dir ${dir} categorized as: ${category}`);
              return { ...file, category };
            });

            // Group files by category
            categorizedFiles.forEach(file => {
              if (files[file.category]) {
                files[file.category].push(file);
                console.log(`🔍 Added file ${file.name} to category ${file.category}`);
              } else {
                files.other.push(file);
                console.log(`🔍 Added file ${file.name} to other category`);
              }
            });
          } catch (e) {
            console.warn(`Could not read directory ${dir}:`, e.message);
          }
        }
      }
    } catch (e) {
      console.warn(`Could not read project directory ${projectPath}:`, e.message);
    }
    
    // YENİ: Frontend asset'leri oku
    try {
      const frontendProjectPath = path.join(__dirname, '../..', 'frontend', 'public', `${project.project_code}_project`);
      console.log(`🎭 Checking frontend assets at: ${frontendProjectPath}`);
      
      if (await fs.access(frontendProjectPath).then(() => true).catch(() => false)) {
        const frontendCategories = ['models', 'tiles', '360views'];
        
        for (const category of frontendCategories) {
          const categoryPath = path.join(frontendProjectPath, category);
          
          if (await fs.access(categoryPath).then(() => true).catch(() => false)) {
            try {
              const categoryFiles = await fs.readdir(categoryPath);
              
              const frontendFileDetails = await Promise.all(categoryFiles.map(async (file) => {
                const filePath = path.join(categoryPath, file);
                const fileStat = await fs.stat(filePath);
                
                // Sadece dosyaları döndür, directory'leri değil
                if (fileStat.isFile()) {
                  return {
                    name: file,
                    size: fileStat.size,
                    modified: fileStat.mtime,
                    path: `${project.project_code}_project/${category}/${file}`,
                    isFrontendAsset: true
                  };
                }
                return null;
              }));
              
              // null değerleri filtrele
              const filteredFiles = frontendFileDetails.filter(file => file !== null);
              
              files[`frontend_${category}`] = filteredFiles;
              console.log(`🎭 Found ${filteredFiles.length} files in frontend_${category}`);
              
            } catch (e) {
              console.warn(`Could not read frontend directory ${categoryPath}:`, e.message);
              files[`frontend_${category}`] = [];
            }
          } else {
            files[`frontend_${category}`] = [];
          }
        }
      }
    } catch (e) {
      console.warn('Error reading frontend assets:', e.message);
    }
    
    // Get gallery images
    try {
      const galleryImages = await GalleryService.getAllProjectGalleryImages(projectId);
      files.gallery = galleryImages || [];
    } catch (e) {
      files.gallery = [];
    }
    
    console.log(`📁 Files object being returned:`, JSON.stringify(files, null, 2));
    
    res.json(formatSuccessResponse({
      project,
      files
    }));
  } catch (error) {
    console.error('Get project files error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve project files'));
  }
});

/**
 * Delete project file
 */
const deleteProjectFile = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { category, filename, filePath } = req.body;
  
  console.log(`🗑️ DELETE request - ProjectId: ${projectId}, FilePath: ${filePath}, Category: ${category}, Filename: ${filename}`);

  if (!filePath && (!category || !filename)) {
    return res.status(400).json(formatErrorResponse('Missing filePath or category/filename'));
  }

  try {
    const project = await ProjectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json(formatErrorResponse('Project not found'));
    }

    let fullFilePath;
    if (filePath) {
      // Dosya path'ini analiz et - frontend asset mi backend asset mi?
      const isBackendAsset = filePath.startsWith('projects/') || filePath.startsWith('uploads/');
      const isFrontendAsset = filePath.includes(`${project.project_code}_project/`);
      
      if (isFrontendAsset) {
        // Frontend asset - frontend/public/ klasöründe
        const frontendPublicRoot = path.join(__dirname, '..', '..', 'frontend', 'public');
        let rel = String(filePath).replace(/^\/*/, '');
        rel = rel.split('/').join(path.sep);
        if (rel.includes('..')) {
          return res.status(400).json(formatErrorResponse('Invalid file path'));
        }
        const expectedPrefix = `${project.project_code}_project` + path.sep;
        if (!rel.includes(expectedPrefix)) {
          return res.status(400).json(formatErrorResponse('File path does not belong to this project'));
        }
        fullFilePath = path.join(frontendPublicRoot, rel);
      } else {
        // Backend asset - uploads/ klasöründe
        const uploadsRoot = path.join(__dirname, '..', 'uploads');
        let rel = String(filePath).replace(/^\/*/, '');
        rel = rel.split('/').join(path.sep);
        if (rel.includes('..')) {
          return res.status(400).json(formatErrorResponse('Invalid file path'));
        }
        const expectedPrefix = path.join('projects', project.project_code) + path.sep;
        if (!rel.startsWith(expectedPrefix)) {
          return res.status(400).json(formatErrorResponse('File path does not belong to this project'));
        }
        fullFilePath = path.join(uploadsRoot, rel);
      }
    } else {
      // Legacy - category/filename ile silme
      fullFilePath = path.join(__dirname, '..', 'uploads', 'projects', project.project_code, category, filename);
    }

    // Check if file exists before attempting to delete
    try {
      await fs.access(fullFilePath);
    } catch (error) {
      return res.status(404).json(formatErrorResponse('File not found'));
    }

    try {
      await fs.unlink(fullFilePath);

      // Database cleanup: remove any gallery images that reference this file
      const { GalleryService } = require('../services/dbService');
      const filename = path.basename(fullFilePath);

      try {
        // Clean up gallery images that reference this deleted file
        if (isBackendAsset) {
          // For backend assets, match by filename in gallery
          const galleryImages = await GalleryService.getAllProjectGalleryImages(projectId);
          for (const image of galleryImages) {
            if (image.filename === filename || image.url.includes(filename)) {
              await GalleryService.deleteGalleryImage(image.id, projectId);
              console.log(`Cleaned up gallery image record for deleted file: ${filename}`);
            }
          }
        }
      } catch (cleanupError) {
        console.warn('Database cleanup warning (non-critical):', cleanupError.message);
        // Don't fail the entire operation for cleanup issues
      }

      res.json(formatSuccessResponse({ filename: filename || path.basename(fullFilePath) }, 'File deleted successfully'));
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json(formatErrorResponse('File not found'));
      }
      throw e;
    }
  } catch (error) {
    console.error('Delete project file error:', error);
    res.status(500).json(formatErrorResponse('Failed to delete file'));
  }
});

/**
 * Get system information
 */
const getSystemInfo = asyncHandler(async (req, res) => {
  try {
    const info = {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
    
    res.json(formatSuccessResponse(info));
  } catch (error) {
    console.error('Get system info error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve system information'));
  }
});

/**
 * Upload project files with new category system
 */
const uploadProjectFiles = asyncHandler(async (req, res) => {
  const { projectId, category } = req.body;
  
  if (!projectId || !category) {
    return res.status(400).json(formatErrorResponse('Missing projectId or category'));
  }
  
  try {
    const project = await ProjectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json(formatErrorResponse('Project not found'));
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json(formatErrorResponse('No files uploaded'));
    }

    // Yeni kategori sistemini kontrol et
    const categoryConfig = uploadCategories[category];
    const uploadedFiles = [];

    if (categoryConfig) {
      // YENİ: Kategori bazlı upload sistemi
      console.log(`[AdminController] Using new category system: ${category}`);
      
      const projectCode = project.project_code;
      const destinationPath = categoryConfig.destination(projectCode);
      
      // Klasörü oluştur
      await fs.mkdir(destinationPath, { recursive: true });
      
      // Dosyaları işle
      const processedFiles = [];
      
      for (const file of req.files) {
        const fileExt = path.extname(file.originalname).toLowerCase();
        
        // Uzantı kontrolü
        if (!categoryConfig.allowedExtensions.includes(fileExt)) {
          return res.status(400).json(formatErrorResponse(
            `File ${file.originalname} has invalid extension for category ${category}. Allowed: ${categoryConfig.allowedExtensions.join(', ')}`
          ));
        }
        
        // Geçici dosya oluştur
        const timestamp = Date.now();
        const tempFilename = `${timestamp}_${file.originalname}`;
        const tempFilePath = path.join(destinationPath, tempFilename);
        await fs.writeFile(tempFilePath, file.buffer);
        
        processedFiles.push({
          filename: file.originalname,
          tempFilename: tempFilename,
          path: tempFilePath,
          size: file.size,
          buffer: file.buffer
        });
      }
      
      // ZIP çıkarma işlemi
      if (categoryConfig.extractZip) {
        console.log(`[AdminController] Processing ZIP extraction for category: ${category}`);
        
        for (const file of processedFiles) {
          if (['.zip', '.rar', '.7z'].includes(path.extname(file.filename).toLowerCase())) {
            
            const extractResult = await ZipHandler.extractZipFile(
              file.path, 
              destinationPath,
              { fileTypes: ['.json', '.gltf', '.glb', '.b3dm', '.i3dm', '.pnts', '.cmpt', '.jpg', '.png', '.bin'] }
            );
            
            if (extractResult.success) {
              // Orijinal ZIP'i sil
              try {
                await fs.unlink(file.path);
                console.log(`[AdminController] ZIP file deleted: ${path.basename(file.path)}`);
              } catch (e) {
                console.warn(`[AdminController] Failed to delete ZIP: ${e.message}`);
              }
              
              // Ana tileset dosyasını yeniden adlandır  
              if (category === 'frontend_tiles_zip') {
                console.log(`[AdminController] Looking for main JSON file in: ${destinationPath}`);
                
                // Ana dizinde JSON dosyalarını bul
                const findMainJson = (dir) => {
                  const files = fsSync.readdirSync(dir);
                  for (const file of files) {
                    const fullPath = path.join(dir, file);
                    const stat = fsSync.statSync(fullPath);
                    
                    if (stat.isFile() && file.toLowerCase().endsWith('.json')) {
                      // Production, tileset, main gibi kelimeleri ara
                      if (file.toLowerCase().includes('production') || 
                          file.toLowerCase().includes('tileset') ||
                          file.toLowerCase().includes('main') ||
                          file.toLowerCase() === 'tileset.json') {
                        console.log(`[AdminController] Found main JSON: ${file}`);
                        return fullPath;
                      }
                    }
                  }
                  
                  // Bulunamazsa ilk JSON dosyasını al
                  for (const file of files) {
                    const fullPath = path.join(dir, file);
                    const stat = fsSync.statSync(fullPath);
                    
                    if (stat.isFile() && file.toLowerCase().endsWith('.json')) {
                      console.log(`[AdminController] Taking first JSON as main: ${file}`);
                      return fullPath;
                    }
                  }
                  return null;
                };
                
                const mainJsonPath = findMainJson(destinationPath);
                if (mainJsonPath) {
                  const newJsonPath = path.join(destinationPath, `sezyum_${projectCode}.json`);
                  
                  if (mainJsonPath !== newJsonPath) {
                    await fs.rename(mainJsonPath, newJsonPath);
                    console.log(`[AdminController] Tileset renamed: ${path.basename(mainJsonPath)} -> sezyum_${projectCode}.json`);
                  }
                } else {
                  console.warn(`[AdminController] No JSON file found in main directory`);
                }
              }
              
              file.extracted = true;
              file.extractedFiles = extractResult.extractedFiles;
              file.structure = extractResult.structure;
              file.mainFiles = extractResult.mainFiles;
              
            } else {
              file.extractError = extractResult.error;
              console.error(`[AdminController] ZIP extraction failed: ${extractResult.error}`);
            }
          }
        }
      }
      
      // Otomatik dosya yeniden adlandırma
      if (categoryConfig.autoRename) {
        console.log(`[AdminController] Auto-renaming files for category: ${category}`);
        
        const filesToRename = processedFiles.filter(f => !f.extracted);
        
        if (filesToRename.length > 0) {
          const renameResults = FileNaming.batchRename(
            filesToRename.map(f => ({ filename: f.filename, path: f.path })),
            category,
            projectCode,
            destinationPath
          );
          
          renameResults.forEach((result, index) => {
            if (index < filesToRename.length) {
              filesToRename[index].renamed = result.renamed;
              filesToRename[index].newFilename = result.newFilename;
              filesToRename[index].renameSuccess = result.success;
            }
          });
        }
      }
      
      // Yanıt için dosya bilgilerini hazırla ve database'e kaydet
      const galleryImages = [];
      processedFiles.forEach(file => {
        const finalFilename = file.tempFilename; // Use the actual saved filename
        const relativePath = categoryConfig.isFrontendAsset
          ? `frontend/public/${projectCode}_project/${category.replace('frontend_', '')}/${finalFilename}`
          : `uploads/projects/${projectCode}/${category}/${finalFilename}`;

        uploadedFiles.push({
          originalName: file.filename,
          name: finalFilename,
          size: file.size,
          path: relativePath,
          extracted: file.extracted || false,
          extractedFiles: file.extractedFiles || 0,
          structure: file.structure || null,
          renamed: file.renamed || false,
          category: category,
          isFrontendAsset: categoryConfig.isFrontendAsset
        });

        // Create gallery image record for backend assets (not frontend)
        if (!categoryConfig.isFrontendAsset) {
          galleryImages.push({
            album: category,
            filename: finalFilename,
            url: `/upload/projects/${projectCode}/${category}/${finalFilename}`,
            title: file.filename,
            projectId: String(projectCode)
          });
        }
      });

      // Store gallery images in database
      if (galleryImages.length > 0) {
        try {
          console.log(`[AdminController] Storing ${galleryImages.length} gallery images in database`);
          await GalleryService.createGalleryImages(galleryImages);
          console.log(`[AdminController] Successfully stored gallery images in database`);
        } catch (dbError) {
          console.error('[AdminController] Failed to store gallery images in database:', dbError);
          // Don't fail the entire operation for database issues
        }
      }
      
    } else {
      // ESKI: Backward compatibility için legacy sistem
      console.log(`[AdminController] Using legacy category system: ${category}`);
      
      const allowedExtensions = {
        drone_photos_jpg: ['.jpg', '.jpeg', '.png'],
        drone_photos_zip: ['.zip', '.rar'],
        floor_plans_jpeg: ['.jpg', '.jpeg', '.png'],
        floor_plans_dwg: ['.dwg', '.dxf'],
        orthophoto_jpeg: ['.jpg', '.jpeg', '.png'],
        orthophoto_tiff: ['.tiff', '.tif'],
        view_360: ['.jpg', '.jpeg', '.png'],
        models_fbx: ['.fbx', '.obj', '.3ds'],
        documents_pdf: ['.pdf', '.doc', '.docx'],
        files_zip: ['.zip', '.rar', '.7z'],
        other: [],
        contractor_depot: [
          '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
          '.dwg', '.dxf', '.zip', '.rar', '.7z',
          '.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif',
          '.txt', '.rtf', '.csv'
        ]
      };
      
      const galleryImages = [];
      for (const file of req.files) {
        const fileExt = path.extname(file.originalname).toLowerCase();

        if (category !== 'other' && allowedExtensions[category] && allowedExtensions[category].length > 0 &&
            !allowedExtensions[category].includes(fileExt)) {
          return res.status(400).json(formatErrorResponse(
            `File ${file.originalname} has invalid extension for category ${category}. Allowed: ${allowedExtensions[category].join(', ')}`
          ));
        }

        const timestamp = Date.now();
        const filename = `${timestamp}_${file.originalname}`;
        const categoryPath = path.join(__dirname, '..', 'uploads', 'projects', project.project_code, category);

        await fs.mkdir(categoryPath, { recursive: true });

        const filePath = path.join(categoryPath, filename);
        await fs.writeFile(filePath, file.buffer);

        uploadedFiles.push({
          name: filename,
          originalName: file.originalname,
          size: file.size,
          path: `projects/${project.project_code}/${category}/${filename}`,
          category: category,
          legacy: true
        });

        // Create gallery image record for legacy system too
        galleryImages.push({
          album: category,
          filename: filename,
          url: `/upload/projects/${project.project_code}/${category}/${filename}`,
          title: file.originalname,
          projectId: String(project.project_code)
        });
      }

      // Store gallery images in database for legacy system
      if (galleryImages.length > 0) {
        try {
          console.log(`[AdminController] Storing ${galleryImages.length} legacy gallery images in database`);
          await GalleryService.createGalleryImages(galleryImages);
          console.log(`[AdminController] Successfully stored legacy gallery images in database`);
        } catch (dbError) {
          console.error('[AdminController] Failed to store legacy gallery images in database:', dbError);
          // Don't fail the entire operation for database issues
        }
      }
    }
    
    const responseMessage = uploadedFiles.some(f => f.extracted) 
      ? `${uploadedFiles.length} file(s) uploaded and processed successfully`
      : `${uploadedFiles.length} file(s) uploaded successfully`;
    
    res.json(formatSuccessResponse({
      message: responseMessage,
      files: uploadedFiles,
      projectCode: project.project_code
    }));
    
  } catch (error) {
    console.error('Upload project files error:', error);
    res.status(500).json(formatErrorResponse('Failed to upload files: ' + error.message));
  }
});

/**
 * Rename project file
 */
const renameProjectFile = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  let { category, oldName, newName, filePath } = req.body;

  if ((!filePath && (!category || !oldName)) || !newName) {
    return res.status(400).json(formatErrorResponse('Missing required fields'));
  }

  try {
    const project = await ProjectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json(formatErrorResponse('Project not found'));
    }

    // Ensure newName is a filename only and preserve extension if omitted
    newName = path.basename(String(newName));
    if (newName.indexOf('.') === -1 && oldName) {
      const ext = path.extname(String(oldName));
      if (ext) newName = newName + ext;
    }

    const uploadsRoot = path.join(__dirname, '..', 'uploads');
    const projectRoot = path.join(uploadsRoot, 'projects', project.project_code);

    let fromPath;
    let toPath;

    if (filePath) {
      // filePath should be like "projects/<project_code>/<dir>/<file>"
      let rel = String(filePath).replace(/^\/*/, '');
      // Normalize separators
      rel = rel.split('/').join(path.sep);
      // Basic safety: prevent traversals
      if (rel.includes('..')) {
        return res.status(400).json(formatErrorResponse('Invalid file path'));
      }
      // Ensure it starts with expected project path
      const expectedPrefix = path.join('projects', project.project_code) + path.sep;
      if (!rel.startsWith(expectedPrefix)) {
        return res.status(400).json(formatErrorResponse('File path does not belong to this project'));
      }
      fromPath = path.join(uploadsRoot, rel);
      const dirPath = path.dirname(fromPath);
      toPath = path.join(dirPath, newName);
    } else {
      // Fallback: use category + oldName (category corresponds to actual directory name)
      const safeCategory = String(category).replace(/[^a-zA-Z0-9_\-]/g, '');
      fromPath = path.join(projectRoot, safeCategory, oldName);
      toPath = path.join(projectRoot, safeCategory, newName);
    }

    try {
      await fs.access(fromPath);
    } catch (e) {
      return res.status(404).json(formatErrorResponse('Source file not found'));
    }

    try {
      // If destination exists, reject to avoid overwrite
      await fs.access(toPath);
      return res.status(409).json(formatErrorResponse('Target filename already exists'));
    } catch (e) {
      // ok if not exists
    }

    await fs.rename(fromPath, toPath);

    res.json(formatSuccessResponse({ oldName: oldName || path.basename(fromPath), newName } , 'File renamed successfully'));
  } catch (error) {
    console.error('Rename project file error:', error);
    res.status(500).json(formatErrorResponse('Failed to rename file'));
  }
});

/**
 * Upload user logo
 */
const uploadUserLogo = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!req.file) {
      return res.status(400).json(formatErrorResponse('No logo file provided'));
    }

    // Validate user exists
    const user = await UserService.getUserById(userId);
    if (!user) {
      return res.status(404).json(formatErrorResponse('User not found'));
    }

    // Create user logos directory if it doesn't exist
    const logosDir = path.join(__dirname, '..', 'uploads', 'user-logos');
    await fs.mkdir(logosDir, { recursive: true });

    // Remove old logo if exists
    if (user.logo_url) {
      const oldLogoPath = path.join(__dirname, '..', 'uploads', user.logo_url);
      try {
        await fs.unlink(oldLogoPath);
      } catch (err) {
        console.log('Old logo file not found or already deleted');
      }
    }

    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname);
    const logoFileName = `user_${userId}_logo_${Date.now()}${fileExtension}`;
    const logoPath = path.join(logosDir, logoFileName);

    // Move uploaded file to final location
    await fs.writeFile(logoPath, req.file.buffer);

    // Update user record with logo URL
    const logoUrl = `user-logos/${logoFileName}`;
    await UserService.updateUserLogo(userId, logoUrl);

    res.json(formatSuccessResponse({
      message: 'User logo uploaded successfully',
      logoUrl: logoUrl
    }));

  } catch (error) {
    console.error('Upload user logo error:', error);
    res.status(500).json(formatErrorResponse('Failed to upload user logo'));
  }
});

/**
 * Delete user logo
 */
const deleteUserLogo = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user exists
    const user = await UserService.getUserById(userId);
    if (!user) {
      return res.status(404).json(formatErrorResponse('User not found'));
    }

    if (!user.logo_url) {
      return res.status(400).json(formatErrorResponse('User has no logo to delete'));
    }

    // Delete logo file
    const logoPath = path.join(__dirname, '..', 'uploads', user.logo_url);
    try {
      await fs.unlink(logoPath);
    } catch (err) {
      console.log('Logo file not found or already deleted');
    }

    // Update user record to remove logo URL
    await UserService.updateUserLogo(userId, null);

    res.json(formatSuccessResponse({
      message: 'User logo deleted successfully'
    }));

  } catch (error) {
    console.error('Delete user logo error:', error);
    res.status(500).json(formatErrorResponse('Failed to delete user logo'));
  }
});

/**
 * Delete entire project and all related files
 */
const deleteProject = asyncHandler(async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json(formatErrorResponse('Project ID is required'));
    }

    console.log(`🗑️ DELETE PROJECT request - ProjectId: ${projectId}`);

    // Get project info before deletion
    const project = await ProjectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json(formatErrorResponse('Project not found'));
    }

    // Delete all project files from filesystem
    const projectUploadPath = path.join(__dirname, '../uploads', projectId.toString());
    
    if (fsSync.existsSync(projectUploadPath)) {
      console.log(`🗂️ Deleting project upload folder: ${projectUploadPath}`);
      await fs.rm(projectUploadPath, { recursive: true, force: true });
      console.log(`✅ Project upload folder deleted successfully`);
    } else {
      console.log(`📁 No upload folder found for project ${projectId}`);
    }

    // Delete project from database (this will also delete related records)
    const deleted = await ProjectService.deleteProject(projectId);
    
    if (!deleted) {
      return res.status(404).json(formatErrorResponse('Project not found or already deleted'));
    }

    console.log(`✅ Project ${projectId} (${project.project_name || project.name}) deleted successfully`);
    
    res.json(formatSuccessResponse(
      null,
      `Project "${project.project_name || project.name}" and all related files deleted successfully`
    ));

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json(formatErrorResponse('Failed to delete project'));
  }
});

module.exports = {
  getDashboardStats,
  getAllUsersWithProjects,
  getProjectFiles,
  uploadProjectFiles,
  deleteProjectFile,
  deleteProject,
  getSystemInfo,
  renameProjectFile,
  uploadUserLogo,
  deleteUserLogo
};