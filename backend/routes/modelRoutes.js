const express = require('express');
const { requireAdmin, requireProjectAccess } = require('../middlewares/authMiddleware');
const modelController = require('../controllers/modelController');

const router = express.Router();

/**
 * Model Version Routes
 */

// Get published model version for project (proje erişim kontrolü ile)
router.get('/api/projects/:projectId/model/published', requireProjectAccess, modelController.getPublishedModelVersion);

// Create new model version (admin only)
router.post('/api/projects/:projectId/model/versions', requireAdmin, modelController.createModelVersion);

// Publish specific model version (admin only)
router.put('/api/projects/:projectId/model/versions/:id/publish', requireAdmin, modelController.publishModelVersion);

// Get model version history (proje erişim kontrolü ile)
router.get('/api/projects/:projectId/model/versions', requireProjectAccess, modelController.getModelVersionHistory);

// Alias routes for frontend compatibility
router.get('/api/projects/:projectId/model/history', requireProjectAccess, modelController.getModelVersionHistory);
router.get('/api/projects/:projectId/model/latest', requireProjectAccess, modelController.getPublishedModelVersion);
router.post('/api/projects/:projectId/model', requireAdmin, modelController.createModelVersion);
router.put('/api/projects/:projectId/model/publish/:id', requireAdmin, modelController.publishModelVersion);

module.exports = router;