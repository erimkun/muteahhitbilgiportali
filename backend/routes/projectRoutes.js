const express = require('express');
const projectController = require('../controllers/projectController');
const { requireAdmin, requireProjectAccess } = require('../middlewares/authMiddleware');
const { createProjectValidators, updateProjectValidators } = require('../validators/project');
const { handleValidationErrors } = require('../middlewares/requestValidation');

const router = express.Router();

/**
 * Project Routes
 */

// Legacy asset endpoints (default to project 1) - ADMIN ONLY for security
router.get('/api/assets', requireAdmin, projectController.getLegacyAssets);
router.put('/api/assets', requireAdmin, projectController.updateLegacyAssets);

// Project CRUD endpoints
router.get('/api/projects', requireAdmin, projectController.getAllProjects); // Sadece admin tüm projeleri görebilir
router.get('/api/projects/:id', requireProjectAccess, projectController.getProject);
router.post('/api/projects', requireAdmin, createProjectValidators, handleValidationErrors, projectController.createProject);
router.put('/api/projects/:id', requireAdmin, updateProjectValidators, handleValidationErrors, projectController.updateProject);
router.delete('/api/projects/:id', requireAdmin, projectController.deleteProject);
router.post('/api/projects/:id/toggle-status', requireAdmin, projectController.toggleProjectStatus);

// Project-scoped asset endpoints (proje erişim kontrolü ile)
router.get('/api/projects/:projectId/assets', requireProjectAccess, projectController.getProjectAssets);
router.put('/api/projects/:projectId/assets', requireAdmin, projectController.updateProjectAssets);

// Project settings endpoints (proje erişim kontrolü ile)
router.get('/api/projects/:projectId/settings', requireProjectAccess, projectController.getProjectSettings);
router.put('/api/projects/:projectId/settings', requireAdmin, projectController.updateProjectSettings);

module.exports = router;