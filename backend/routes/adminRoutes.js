const express = require('express');
const { requireAdmin } = require('../middlewares/authMiddleware');
const { uploadFiles } = require('../middlewares/uploadMiddleware');
const { apiLimiter, uploadLimiter } = require('../middlewares/rateLimiter');
const adminController = require('../controllers/adminController');

const router = express.Router();

/**
 * Admin Management Routes (All require admin authentication)
 */

// Dashboard
router.get('/admin/dashboard/stats', apiLimiter, requireAdmin, adminController.getDashboardStats);
router.get('/admin/system/info', apiLimiter, requireAdmin, adminController.getSystemInfo);

// User Management with Projects
router.get('/admin/users/complete', apiLimiter, requireAdmin, adminController.getAllUsersWithProjects);

// File Management
router.get('/admin/projects/:projectId/files', apiLimiter, requireAdmin, adminController.getProjectFiles);
router.post('/admin/projects/upload', uploadLimiter, requireAdmin, uploadFiles.array('files', 10), adminController.uploadProjectFiles);
router.delete('/admin/projects/:projectId/files', apiLimiter, requireAdmin, adminController.deleteProjectFile);
router.put('/admin/projects/:projectId/files/rename', apiLimiter, requireAdmin, adminController.renameProjectFile);

module.exports = router;