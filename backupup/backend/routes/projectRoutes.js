const express = require('express');
const projectController = require('../controllers/projectController');
const { requireAdmin, requireProjectAccess } = require('../middlewares/authMiddleware');
const { apiLimiter } = require('../middlewares/rateLimiter');
const { createProjectValidators, updateProjectValidators } = require('../validators/project');
const { handleValidationErrors } = require('../middlewares/requestValidation');

const router = express.Router();

/**
 * Project Routes
 */

// Legacy asset endpoints (default to project 1) - ADMIN ONLY for security
router.get('/api/assets', apiLimiter, requireAdmin, projectController.getLegacyAssets);
router.put('/api/assets', apiLimiter, requireAdmin, projectController.updateLegacyAssets);

// Project CRUD endpoints
router.get('/api/projects', apiLimiter, requireAdmin, projectController.getAllProjects); // Sadece admin tüm projeleri görebilir
router.get('/api/projects/:id', apiLimiter, requireProjectAccess, projectController.getProject);
router.post('/api/projects', apiLimiter, requireAdmin, createProjectValidators, handleValidationErrors, projectController.createProject);
router.put('/api/projects/:id', apiLimiter, requireAdmin, updateProjectValidators, handleValidationErrors, projectController.updateProject);
router.delete('/api/projects/:id', apiLimiter, requireAdmin, projectController.deleteProject);
router.post('/api/projects/:id/toggle-status', apiLimiter, requireAdmin, projectController.toggleProjectStatus);

// Project-scoped asset endpoints (proje erişim kontrolü ile)
router.get('/api/projects/:projectId/assets', apiLimiter, requireProjectAccess, projectController.getProjectAssets);
router.put('/api/projects/:projectId/assets', apiLimiter, requireAdmin, projectController.updateProjectAssets);

// Project settings endpoints (proje erişim kontrolü ile)
router.get('/api/projects/:projectId/settings', apiLimiter, requireProjectAccess, projectController.getProjectSettings);
router.put('/api/projects/:projectId/settings', requireAdmin, projectController.updateProjectSettings);

module.exports = router;