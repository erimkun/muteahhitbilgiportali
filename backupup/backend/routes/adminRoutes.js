const express = require('express');
const { requireAdmin } = require('../middlewares/authMiddleware');
const { uploadFiles } = require('../middlewares/uploadMiddleware');
const { apiLimiter, uploadLimiter } = require('../middlewares/rateLimiter');
const adminController = require('../controllers/adminController');
const multer = require('multer');

// Create multer instance for logo uploads
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const router = express.Router();

/**
 * Admin Management Routes (All require admin authentication)
 */

// Dashboard
router.get('/admin/dashboard/stats', apiLimiter, requireAdmin, adminController.getDashboardStats);
router.get('/admin/system/info', apiLimiter, requireAdmin, adminController.getSystemInfo);

// User Management with Projects
router.get('/admin/users/complete', apiLimiter, requireAdmin, adminController.getAllUsersWithProjects);

// User Logo Management
router.post('/admin/users/:userId/logo', uploadLimiter, requireAdmin, logoUpload.single('logo'), adminController.uploadUserLogo);
router.delete('/admin/users/:userId/logo', apiLimiter, requireAdmin, adminController.deleteUserLogo);

// File Management
router.get('/admin/projects/:projectId/files', apiLimiter, requireAdmin, adminController.getProjectFiles);
router.post('/admin/projects/upload', uploadLimiter, requireAdmin, uploadFiles.array('files', 10), adminController.uploadProjectFiles);
router.delete('/admin/projects/:projectId/files', apiLimiter, requireAdmin, adminController.deleteProjectFile);
router.put('/admin/projects/:projectId/files/rename', apiLimiter, requireAdmin, adminController.renameProjectFile);

// Project Management
router.delete('/admin/projects/:projectId', apiLimiter, requireAdmin, adminController.deleteProject);

module.exports = router;