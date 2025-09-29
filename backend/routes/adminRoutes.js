const express = require('express');
const { requireAdmin } = require('../middlewares/authMiddleware');
const { uploadFiles } = require('../middlewares/uploadMiddleware');
const adminController = require('../controllers/adminController');

const router = express.Router();

/**
 * Admin Management Routes (All require admin authentication)
 */

// Dashboard
router.get('/admin/dashboard/stats', requireAdmin, adminController.getDashboardStats);
router.get('/admin/system/info', requireAdmin, adminController.getSystemInfo);

// User Management with Projects
router.get('/admin/users/complete', requireAdmin, adminController.getAllUsersWithProjects);

// File Management
router.get('/admin/projects/:projectId/files', requireAdmin, adminController.getProjectFiles);
router.post('/admin/projects/upload', requireAdmin, uploadFiles.array('files', 10), adminController.uploadProjectFiles);
router.delete('/admin/projects/:projectId/files', requireAdmin, adminController.deleteProjectFile);
router.put('/admin/projects/:projectId/files/rename', requireAdmin, adminController.renameProjectFile);

module.exports = router;