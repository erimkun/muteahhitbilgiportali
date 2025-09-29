const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateSafeFilename, ensureDirectoryExists } = require('../utils/helpers');
const ZipHandler = require('../utils/zipHandler');
const FileNaming = require('../utils/fileNaming');

/**
 * Multer configuration for file uploads
 */

const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

// Upload kategorilerinin tanımları
const uploadCategories = {
  // Backend kategorileri (mevcut)
  drone_photos: {
    destination: (projectCode) => path.join(uploadsDir, 'projects', projectCode, 'drone_photos'),
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.tiff', '.tif'],
    maxFiles: 50,
    isFrontendAsset: false
  },
  floor_plans: {
    destination: (projectCode) => path.join(uploadsDir, 'projects', projectCode, 'floor_plans'),
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
    maxFiles: 30,
    isFrontendAsset: false
  },
  orthophoto: {
    destination: (projectCode) => path.join(uploadsDir, 'projects', projectCode, 'orthophoto'),
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.tiff', '.tif'],
    maxFiles: 20,
    isFrontendAsset: false
  },
  view_360: {
    destination: (projectCode) => path.join(uploadsDir, 'projects', projectCode, 'view_360'),
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    maxFiles: 20,
    isFrontendAsset: false
  },
  fbx_model_file: {
    destination: (projectCode) => path.join(uploadsDir, 'projects', projectCode, 'fbx_model_file'),
    allowedExtensions: ['.zip', '.rar', '.fbx', '.obj'],
    maxFiles: 10,
    isFrontendAsset: false
  },
  drone_photos_file: {
    destination: (projectCode) => path.join(uploadsDir, 'projects', projectCode, 'drone_photos_file'),
    allowedExtensions: ['.zip', '.rar', '.7z'],
    maxFiles: 20,
    isFrontendAsset: false
  },
  floor_plans_file: {
    destination: (projectCode) => path.join(uploadsDir, 'projects', projectCode, 'floor_plans_file'),
    allowedExtensions: ['.dwg', '.dxf', '.zip', '.rar'],
    maxFiles: 20,
    isFrontendAsset: false
  },
  other: {
    destination: (projectCode) => path.join(uploadsDir, 'projects', projectCode, 'other'),
    allowedExtensions: ['.pdf', '.doc', '.docx', '.dwg', '.dxf'],
    maxFiles: 20,
    isFrontendAsset: false
  },
  muteahhit: {
    destination: (projectCode) => path.join(uploadsDir, 'projects', projectCode, 'muteahhit'),
    allowedExtensions: ['.pdf', '.doc', '.docx', '.dwg', '.dxf', '.zip', '.rar'],
    maxFiles: 50,
    isFrontendAsset: false
  },
  contractor_depot: {
    destination: (projectCode) => path.join(uploadsDir, 'projects', projectCode, 'contractor_depot'),
    allowedExtensions: [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.dwg', '.dxf', '.zip', '.rar', '.7z',
      '.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif',
      '.txt', '.rtf', '.csv'
    ],
    maxFiles: 50,
    isFrontendAsset: false
  },

  // YENİ: Frontend kategorileri
  frontend_models: {
    destination: (projectCode) => path.join(__dirname, '../..', 'frontend', 'public', `${projectCode}_project`, 'models'),
    allowedExtensions: ['.gltf', '.glb', '.bin'],
    maxFiles: 10,
    isFrontendAsset: true,
    autoRename: true
  },
  frontend_tiles: {
    destination: (projectCode) => path.join(__dirname, '../..', 'frontend', 'public', `${projectCode}_project`, 'tiles'),
    allowedExtensions: ['.json', '.bin', '.b3dm', '.i3dm', '.pnts', '.cmpt'],
    maxFiles: 100,
    isFrontendAsset: true,
    autoRename: true
  },
  frontend_360views: {
    destination: (projectCode) => path.join(__dirname, '../..', 'frontend', 'public', `${projectCode}_project`, '360views'),
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    maxFiles: 20,
    isFrontendAsset: true,
    autoRename: true
  },

  // YENİ: ZIP klasör kategorileri
  frontend_tiles_zip: {
    destination: (projectCode) => path.join(__dirname, '../..', 'frontend', 'public', `${projectCode}_project`, 'tiles'),
    allowedExtensions: ['.zip', '.rar', '.7z'],
    maxFiles: 1,
    isFrontendAsset: true,
    extractZip: true,
    preserveStructure: true,
    autoRename: true
  }
};

// Ensure uploads directory exists
ensureDirectoryExists(uploadsDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const album = req.params.album || 'misc';
    const rawProject = req.params.projectId;
    
    if (!rawProject) {
      return cb(new Error('Project ID is required for file uploads'), null);
    }
    
    // Resolve canonical project key (prefer project_code if available)
    const usePath = (key) => {
      const projectDir = path.join(uploadsDir, 'projects', key);
      const albumDir = path.join(projectDir, album);
      ensureDirectoryExists(albumDir);
      cb(null, albumDir);
    };

    const isCode = typeof rawProject === 'string' && /[a-zA-Z_]/.test(rawProject);
    if (isCode) return usePath(rawProject);
    const n = Number(rawProject);
    if (!Number.isFinite(n) || n <= 0) return cb(new Error('Invalid project id'), null);
    try {
      const { ProjectService } = require('../services/dbService');
      ProjectService.getProjectById(Math.floor(n))
        .then((proj) => usePath((proj && proj.project_code) ? proj.project_code : String(Math.floor(n))))
        .catch(() => usePath(String(Math.floor(n))));
    } catch (_) {
      usePath(String(Math.floor(n)));
    }
  },
  filename: function (req, file, cb) {
    const safeName = generateSafeFilename(file.originalname);
    cb(null, safeName);
  }
});

// File filter for security
const fileFilter = (req, file, cb) => {
  // Allow common image and document types
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf',
    'image/tiff',
    'application/octet-stream', // Generic binary files (DWG, CAD files often use this)
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    // Common CAD and 3D model types often come as octet-stream; also try vendor-specific
    'application/acad', // DWG
    'image/vnd.dwg', // DWG variant
    'application/dwg', // DWG
    'application/x-dwg', // DWG
    'model/fbx',
    // Microsoft Office files
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text files
    'text/plain',
    'text/csv',
    'application/rtf',
    // Additional formats
    'application/x-autocad',
    'application/acad',
    'image/vnd.dwg'
  ];

  // Also allow based on file extension for files that might have generic MIME types
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.dwg', '.dxf', '.zip', '.rar', '.7z',
    '.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif',
    '.txt', '.rtf', '.csv', '.fbx', '.obj', '.gltf', '.glb'
  ];

  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    console.log(`File rejected: ${file.originalname} (${file.mimetype})`);
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit (for large tileset ZIPs)
    files: 50 // Maximum 50 files per request
  }
});

// Memory storage for admin file uploads
const memoryStorage = multer.memoryStorage();

const uploadFiles = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit (for large tileset ZIPs)
    files: 10 // Maximum 10 files per request
  }
});

// Kategori bazlı dosya yükleme için dinamik storage
const createCategoryStorage = (category) => {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      const rawProject = req.params.projectId;
      
      if (!rawProject) {
        return cb(new Error('Project ID is required for file uploads'), null);
      }
      
      // Kategori konfigürasyonunu al
      const categoryConfig = uploadCategories[category];
      if (!categoryConfig) {
        return cb(new Error(`Unknown category: ${category}`), null);
      }
      
      // Proje kodunu çözümle
      const resolvePath = (projectCode) => {
        const destinationPath = categoryConfig.destination(projectCode);
        ensureDirectoryExists(destinationPath);
        req.categoryConfig = categoryConfig; // Controller için kaydet
        req.projectCode = projectCode; // Controller için kaydet
        cb(null, destinationPath);
      };

      const isCode = typeof rawProject === 'string' && /[a-zA-Z_]/.test(rawProject);
      if (isCode) return resolvePath(rawProject);
      
      const n = Number(rawProject);
      if (!Number.isFinite(n) || n <= 0) return cb(new Error('Invalid project id'), null);
      
      try {
        const { ProjectService } = require('../services/dbService');
        ProjectService.getProjectById(Math.floor(n))
          .then((proj) => resolvePath((proj && proj.project_code) ? proj.project_code : String(Math.floor(n))))
          .catch(() => resolvePath(String(Math.floor(n))));
      } catch (_) {
        resolvePath(String(Math.floor(n)));
      }
    },
    filename: function (req, file, cb) {
      const safeName = generateSafeFilename(file.originalname);
      cb(null, safeName);
    }
  });
};

// Kategori bazlı upload middleware oluşturucu
const createCategoryUpload = (category) => {
  const categoryConfig = uploadCategories[category];
  if (!categoryConfig) {
    throw new Error(`Unknown category: ${category}`);
  }
  
  const storage = createCategoryStorage(category);
  
  return multer({
    storage,
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      
      if (categoryConfig.allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${ext} not allowed for category ${category}`), false);
      }
    },
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit
      files: categoryConfig.maxFiles
    }
  });
};

module.exports = {
  upload,
  uploadFiles,
  uploadCategories,
  createCategoryUpload,
  uploadsDir
};