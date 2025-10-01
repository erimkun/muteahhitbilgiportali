const express = require('express');
const { requireAdmin, requireProjectAccess } = require('../middlewares/authMiddleware');
const { apiLimiter } = require('../middlewares/rateLimiter');
const modelController = require('../controllers/modelController');

const router = express.Router();

/**
 * Model Version Routes
 */

// Get published model version for project (proje erişim kontrolü ile)
router.get('/api/projects/:projectId/model/published', apiLimiter, requireProjectAccess, modelController.getPublishedModelVersion);

// Create new model version (admin only)
router.post('/api/projects/:projectId/model/versions', apiLimiter, requireAdmin, modelController.createModelVersion);

// Publish specific model version (admin only)
router.put('/api/projects/:projectId/model/versions/:id/publish', apiLimiter, requireAdmin, modelController.publishModelVersion);

// Get model version history (proje erişim kontrolü ile)
router.get('/api/projects/:projectId/model/versions', apiLimiter, requireProjectAccess, modelController.getModelVersionHistory);

// Alias routes for frontend compatibility
router.get('/api/projects/:projectId/model/history', apiLimiter, requireProjectAccess, modelController.getModelVersionHistory);
router.get('/api/projects/:projectId/model/latest', apiLimiter, requireProjectAccess, modelController.getPublishedModelVersion);
router.post('/api/projects/:projectId/model', apiLimiter, requireAdmin, modelController.createModelVersion);
router.put('/api/projects/:projectId/model/publish/:id', apiLimiter, requireAdmin, modelController.publishModelVersion);

module.exports = router;