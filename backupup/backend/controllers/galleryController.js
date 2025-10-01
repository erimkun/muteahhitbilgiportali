const path = require('path');
const fs = require('fs');
const { GalleryService, ProjectService } = require('../services/dbService');
const { parseProjectId, formatErrorResponse, formatSuccessResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * Gallery Controller
 * Handles gallery image operations
 */

/**
 * Get gallery images by album (legacy endpoint - defaults to project 1)
 */
const getLegacyGalleryImages = asyncHandler(async (req, res) => {
  const { album } = req.params;
  
  try {
    const images = await GalleryService.getGalleryImages(album, 1);
    res.json(formatSuccessResponse(images));
  } catch (error) {
    console.error('Get legacy gallery images error');
    res.status(500).json(formatErrorResponse('Failed to retrieve gallery images'));
  }
});

/**
 * Upload images to album (legacy endpoint - defaults to project 1)
 */
const uploadLegacyGalleryImages = asyncHandler(async (req, res) => {
  const { album } = req.params;
  
  // Handle both 'images' and 'files' field names
  const uploadedFiles = (req.files?.images || req.files?.files || req.files || []);
  
  if (!uploadedFiles || !uploadedFiles.length) {
    return res.status(400).json(formatErrorResponse('No files uploaded'));
  }

  const { sanitizeFilename } = require('../utils/sanitizeFilename');

  const images = uploadedFiles.map(file => {
    const safeName = sanitizeFilename(file.filename || file.originalname);
    const safeOriginal = sanitizeFilename(file.originalname || file.filename);
    return {
      album,
      filename: safeName,
      url: `/upload/projects/400_111/${album}/${safeName}`,
      title: safeOriginal,
      projectId: '400_111'  // Legacy uploads go to project 400_111
    };
  });

  try {
    const insertedCount = await GalleryService.createGalleryImages(images);
    res.json(formatSuccessResponse(
      { count: insertedCount },
      `${insertedCount} images uploaded successfully`
    ));
  } catch (error) {
    console.error('Upload legacy gallery images error');
    res.status(500).json(formatErrorResponse('Failed to upload images'));
  }
});

/**
 * Delete single gallery image by ID (legacy endpoint - defaults to project 1)
 */
const deleteLegacyGalleryImage = asyncHandler(async (req, res) => {
  const { album, id } = req.params;
  
  try {
    const image = await GalleryService.getGalleryImageById(id, album, 1);
    
    if (!image) {
      return res.status(404).json(formatErrorResponse('Image not found'));
    }

    // Delete file from filesystem
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const filePath = path.join(uploadsDir, album, image.filename);
    fs.unlink(filePath, () => {}); // Silent fail for file deletion

    // Delete from database
    const success = await GalleryService.deleteGalleryImage(id, 1);
    
    if (success) {
      res.json(formatSuccessResponse({ id: Number(id) }, 'Image deleted successfully'));
    } else {
      res.status(404).json(formatErrorResponse('Image not found'));
    }
  } catch (error) {
    console.error('Delete legacy gallery image error');
    res.status(500).json(formatErrorResponse('Failed to delete image'));
  }
});

/**
 * Bulk delete gallery images (legacy endpoint - defaults to project 1)
 */
const bulkDeleteLegacyGalleryImages = asyncHandler(async (req, res) => {
  const { album } = req.params;
  const ids = Array.isArray(req.body?.ids) ? 
    req.body.ids.filter(n => Number.isInteger(n) || /^\d+$/.test(n)) : [];
    
  if (!ids.length) {
    return res.status(400).json(formatErrorResponse('Provide ids array with numbers'));
  }

  try {
    // Get images to delete
    const images = await GalleryService.getGalleryImagesByIds(ids, album, 1);
    const foundIds = new Set(images.map(r => r.id));
    
    // Delete files from filesystem
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    for (const image of images) {
      const filePath = path.join(uploadsDir, album, image.filename);
      fs.unlink(filePath, () => {}); // Silent fail for file deletion
    }

    // Delete from database
    const deletedCount = await GalleryService.deleteGalleryImages(ids, album, 1);
    
    res.json(formatSuccessResponse({
      deletedCount,
      requested: ids.length,
      notFound: ids.filter(id => !foundIds.has(Number(id)))
    }, `${deletedCount} images deleted successfully`));
  } catch (error) {
    console.error('Bulk delete legacy gallery images error');
    res.status(500).json(formatErrorResponse('Failed to delete images'));
  }
});

/**
 * Get gallery images by album and project ID
 */
const getProjectGalleryImages = asyncHandler(async (req, res) => {
  const { album } = req.params;
  const projectKey = parseProjectId(req.params.projectId); // input key (code or numeric string)
  let canonicalKey = projectKey;
  if (typeof projectKey === 'string' && !/[a-zA-Z_]/.test(projectKey)) {
    try {
      const proj = await ProjectService.getProjectById(Number(projectKey));
      if (proj?.project_code) canonicalKey = proj.project_code;
    } catch (_) {}
  }
  
  try {
  let images = await GalleryService.getGalleryImages(album, canonicalKey);

    // Fallback: scan filesystem for well-known album/category folders when DB is empty
    if (!images || images.length === 0) {
      try {
        // Map frontend albums to one or more physical directories and extensions
        const map = {
          drone_photos: {
            dirs: ['drone_photos', 'drone_photos_jpg'],
            exts: ['.jpg', '.jpeg', '.png']
          },
          drone_photos_file: {
            dirs: ['drone_photos_file'],
            exts: ['.zip', '.rar', '.7z']
          },
          floor_plans: {
            dirs: ['floor_plans', 'floor_plans_jpeg'],
            exts: ['.jpg', '.jpeg', '.png']
          },
          floor_plans_file: {
            dirs: ['floor_plans_file', 'floor_plans_dwg'],
            exts: ['.dwg', '.dxf', '.zip']
          },
          orthophoto: {
            dirs: ['orthophoto', 'orthophoto_jpeg'],
            exts: ['.jpg', '.jpeg', '.png']
          },
          view_360: {
            dirs: ['view_360'],
            exts: ['.jpg', '.jpeg', '.png']
          },
          other: {
            dirs: ['other', 'documents_pdf'],
            exts: ['.pdf']
          },
          fbx_model_file: {
            dirs: ['fbx_model_file', 'models_fbx'],
            exts: ['.zip', '.rar']
          },
          // Support canonical contractor_depot and legacy muteahhit folders
          contractor_depot: {
            dirs: ['contractor_depot', 'muteahhit'],
            exts: null
          },
          muteahhit: {
            dirs: ['muteahhit'],
            exts: null
          }
        };

        const cfg = map[album];
        if (cfg) {
          const aggregated = [];
          for (const d of cfg.dirs) {
            const dirPath = path.join(__dirname, '..', 'uploads', 'projects', String(canonicalKey), d);
            if (!fs.existsSync(dirPath)) continue;
            const filenames = fs.readdirSync(dirPath).filter(n => n && n !== '.' && n !== '..');
            for (const name of filenames) {
              const ext = path.extname(name).toLowerCase();
              if (cfg.exts && !cfg.exts.includes(ext)) continue;
              aggregated.push({
                album,
                filename: name,
                url: `/upload/projects/${canonicalKey}/${d}/${name}`,
                title: name,
                created_at: new Date().toISOString()
              });
            }
          }
          if (aggregated.length) images = aggregated;
        }
      } catch (fsErr) {
        console.warn('Filesystem fallback failed:', fsErr.message);
      }
    }

    res.json(formatSuccessResponse(images));
  } catch (error) {
    console.error('Get project gallery images error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve gallery images'));
  }
});

/**
 * Upload images to project album
 */
const uploadProjectGalleryImages = asyncHandler(async (req, res) => {
  const { album } = req.params;
  const projectKey = parseProjectId(req.params.projectId);
  let canonicalKey = projectKey;
  if (typeof projectKey === 'string' && !/[a-zA-Z_]/.test(projectKey)) {
    try {
      const proj = await ProjectService.getProjectById(Number(projectKey));
      if (proj?.project_code) canonicalKey = proj.project_code;
    } catch (_) {}
  }
  
  // Handle both 'images' and 'files' field names
  const uploadedFiles = (req.files?.images || req.files?.files || req.files || []);
  
  if (!uploadedFiles || !uploadedFiles.length) {
    return res.status(400).json(formatErrorResponse('No files uploaded'));
  }

  const { sanitizeFilename } = require('../utils/sanitizeFilename');

  const images = uploadedFiles.map(file => {
    const safeName = sanitizeFilename(file.filename || file.originalname);
    const safeOriginal = sanitizeFilename(file.originalname || file.filename);
    return {
      album,
      filename: safeName,
      url: `/upload/projects/${canonicalKey}/${album}/${safeName}`,
      title: safeOriginal,
      projectId: String(canonicalKey)
    };
  });

  try {
    const insertedCount = await GalleryService.createGalleryImages(images);
    res.json(formatSuccessResponse(
      { count: insertedCount },
      `${insertedCount} images uploaded successfully`
    ));
  } catch (error) {
    console.error('Upload project gallery images error:', error);
    res.status(500).json(formatErrorResponse('Failed to upload images'));
  }
});

/**
 * Delete single project gallery image by ID
 */
const deleteProjectGalleryImage = asyncHandler(async (req, res) => {
  const { album, id } = req.params;
  const projectKey = parseProjectId(req.params.projectId);
  let canonicalKey = projectKey;
  if (typeof projectKey === 'string' && !/[a-zA-Z_]/.test(projectKey)) {
    try {
      const proj = await ProjectService.getProjectById(Number(projectKey));
      if (proj?.project_code) canonicalKey = proj.project_code;
    } catch (_) {}
  }
  
  try {
  const image = await GalleryService.getGalleryImageById(id, album, canonicalKey);
    
    if (!image) {
      return res.status(404).json(formatErrorResponse('Image not found'));
    }

    // Delete file from filesystem
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const filePath = path.join(uploadsDir, 'projects', String(canonicalKey), album, image.filename);
    fs.unlink(filePath, () => {}); // Silent fail for file deletion

    // Delete from database
  const success = await GalleryService.deleteGalleryImage(id, canonicalKey);
    
    if (success) {
      res.json(formatSuccessResponse({ id: Number(id) }, 'Image deleted successfully'));
    } else {
      res.status(404).json(formatErrorResponse('Image not found'));
    }
  } catch (error) {
    console.error('Delete project gallery image error:', error);
    res.status(500).json(formatErrorResponse('Failed to delete image'));
  }
});

/**
 * Bulk delete project gallery images
 */
const bulkDeleteProjectGalleryImages = asyncHandler(async (req, res) => {
  const { album } = req.params;
  const projectKey = parseProjectId(req.params.projectId);
  let canonicalKey = projectKey;
  if (typeof projectKey === 'string' && !/[a-zA-Z_]/.test(projectKey)) {
    try {
      const proj = await ProjectService.getProjectById(Number(projectKey));
      if (proj?.project_code) canonicalKey = proj.project_code;
    } catch (_) {}
  }
  const ids = Array.isArray(req.body?.ids) ? 
    req.body.ids.filter(n => Number.isInteger(n) || /^\d+$/.test(n)) : [];
    
  if (!ids.length) {
    return res.status(400).json(formatErrorResponse('Provide ids array with numbers'));
  }

  try {
    // Get images to delete
  const images = await GalleryService.getGalleryImagesByIds(ids, album, canonicalKey);
    const foundIds = new Set(images.map(r => r.id));
    
    // Delete files from filesystem
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    for (const image of images) {
  const filePath = path.join(uploadsDir, 'projects', String(canonicalKey), album, image.filename);
      fs.unlink(filePath, () => {}); // Silent fail for file deletion
    }

    // Delete from database
  const deletedCount = await GalleryService.deleteGalleryImages(ids, album, canonicalKey);
    
    res.json(formatSuccessResponse({
      deletedCount,
      requested: ids.length,
      notFound: ids.filter(id => !foundIds.has(Number(id)))
    }, `${deletedCount} images deleted successfully`));
  } catch (error) {
    console.error('Bulk delete project gallery images error:', error);
    res.status(500).json(formatErrorResponse('Failed to delete images'));
  }
});

/**
 * Delete project gallery image by filename
 */
const deleteProjectGalleryImageByFilename = asyncHandler(async (req, res) => {
  const { album, filename } = req.params;
  const projectKey = parseProjectId(req.params.projectId);
  let canonicalKey = projectKey;
  if (typeof projectKey === 'string' && !/[a-zA-Z_]/.test(projectKey)) {
    try {
      const proj = await ProjectService.getProjectById(Number(projectKey));
      if (proj?.project_code) canonicalKey = proj.project_code;
    } catch (_) {}
  }
  
  try {
    // Get image data from database
  const images = await GalleryService.getGalleryImages(album, canonicalKey);
    const image = images.find(img => img.filename === filename);
    
    if (!image) {
      return res.status(404).json(formatErrorResponse('Image not found'));
    }

    // Delete file from filesystem
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const filePath = path.join(uploadsDir, 'projects', String(canonicalKey), album, filename);
    
    fs.unlink(filePath, (err) => {
      if (err) {
        console.warn('Failed to delete file:', filePath);
      }
    });

    // Delete from database by filename
  const deletedCount = await GalleryService.deleteGalleryImageByFilename(filename, album, canonicalKey);
    
    res.json(formatSuccessResponse(
      { deletedCount },
      'Image deleted successfully'
    ));
  } catch (error) {
    console.error('Delete project gallery image by filename error:', error);
    res.status(500).json(formatErrorResponse('Failed to delete image'));
  }
});

module.exports = {
  getLegacyGalleryImages,
  uploadLegacyGalleryImages,
  deleteLegacyGalleryImage,
  bulkDeleteLegacyGalleryImages,
  getProjectGalleryImages,
  uploadProjectGalleryImages,
  deleteProjectGalleryImage,
  deleteProjectGalleryImageByFilename,
  bulkDeleteProjectGalleryImages
};