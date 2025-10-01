const express = require('express');
const { requireAdmin, requireProjectAccess } = require('../middlewares/authMiddleware');
const { upload, uploadFiles, uploadCategories } = require('../middlewares/uploadMiddleware');
const { validateAndSanitizeFiles } = require('../middlewares/fileValidation');
const { uploadLimiter } = require('../middlewares/rateLimiter');
const galleryController = require('../controllers/galleryController');
const adminController = require('../controllers/adminController');
const { uploadValidators, deleteByFilenameValidators, bulkDeleteValidators } = require('../validators/gallery');
const { handleValidationErrors } = require('../middlewares/requestValidation');

const router = express.Router();

/**
 * Gallery Routes
 */

// Legacy gallery endpoints (default to project 1) - ADMIN ONLY for security
router.get('/api/gallery/:album', requireAdmin, galleryController.getLegacyGalleryImages);
router.post('/api/gallery/:album', 
  requireAdmin, 
  uploadLimiter, 
  upload.fields([
    { name: 'images', maxCount: 50 },
    { name: 'files', maxCount: 50 }
  ]),
  validateAndSanitizeFiles,
  galleryController.uploadLegacyGalleryImages
);
router.delete('/api/gallery/:album/:id', requireAdmin, galleryController.deleteLegacyGalleryImage);
router.delete('/api/gallery/:album', requireAdmin, galleryController.bulkDeleteLegacyGalleryImages);

// Project-scoped gallery endpoints (proje erişim kontrolü ile)
router.get('/api/projects/:projectId/gallery/:album', requireProjectAccess, galleryController.getProjectGalleryImages);

// Enhanced upload endpoint - yeni kategoriler için adminController kullanır
router.post('/api/projects/:projectId/gallery/:album', 
  requireAdmin, 
  uploadLimiter, 
  uploadValidators, handleValidationErrors,
  (req, res, next) => {
    const category = req.params.album;
    
    // Yeni kategori sistemi için adminController kullan
    if (uploadCategories[category]) {
      console.log(`[GalleryRoute] Redirecting to adminController for category: ${category}`);
      
      // Dosyaları uploadFiles middleware ile işle
      return uploadFiles.array('files', 50)(req, res, (err) => {
        if (err) return next(err);
        
        // Sanitize + validate files
        validateAndSanitizeFiles(req, res, (err2) => {
          if (err2) return next(err2);

          // Request body'yi düzenle (middleware çalıştıktan sonra)
          if (!req.body) req.body = {};
          req.body.projectId = req.params.projectId;
          req.body.category = category;
          
          adminController.uploadProjectFiles(req, res, next);
        });
      });
    }
    
    // Eski kategoriler için galleryController kullan  
    console.log(`[GalleryRoute] Using galleryController for legacy category: ${category}`);
    upload.fields([
      { name: 'images', maxCount: 50 },
      { name: 'files', maxCount: 50 }
    ])(req, res, (err) => {
      if (err) return next(err);
      validateAndSanitizeFiles(req, res, (err2) => {
        if (err2) return next(err2);
        galleryController.uploadProjectGalleryImages(req, res, next);
      });
    });
  }
);

router.delete('/api/projects/:projectId/gallery/:album/:id', requireAdmin, deleteByFilenameValidators, handleValidationErrors, galleryController.deleteProjectGalleryImage);
router.delete('/api/projects/:projectId/gallery/:album/file/:filename', requireAdmin, deleteByFilenameValidators, handleValidationErrors, galleryController.deleteProjectGalleryImageByFilename);
router.delete('/api/projects/:projectId/gallery/:album', requireAdmin, bulkDeleteValidators, handleValidationErrors, galleryController.bulkDeleteProjectGalleryImages);

// Special endpoint for frontend file access (files album)
router.get('/api/projects/:projectId/gallery/files', requireProjectAccess, galleryController.getProjectGalleryImages);

module.exports = router;