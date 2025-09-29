const express = require('express');
const { requireAdmin, requireUser } = require('../middlewares/authMiddleware');
const userController = require('../controllers/userController');
const projectController = require('../controllers/projectController');
const { createUserValidators, updateUserValidators, assignProjectValidators } = require('../validators/user');
const { handleValidationErrors } = require('../middlewares/requestValidation');

const router = express.Router();

/**
 * User Routes (for authenticated users)
 */
// User can get their own projects
router.get('/user/projects', requireUser, userController.getCurrentUserProjects);

/**
 * User Management Routes (Admin Only)
 */

router.get('/admin/users', requireAdmin, userController.getAllUsers);
router.post('/admin/users', requireAdmin, createUserValidators, handleValidationErrors, userController.createUser);
router.put('/admin/users/:id', requireAdmin, updateUserValidators, handleValidationErrors, userController.updateUser);
router.delete('/admin/users/:id', requireAdmin, userController.deleteUser);

// User-Project assignment routes
router.get('/admin/users/:id/projects', requireAdmin, userController.getUserProjects);
router.post('/admin/users/:id/projects', requireAdmin, assignProjectValidators, handleValidationErrors, userController.assignUserToProject);
router.delete('/admin/users/:id/projects/:projectId', requireAdmin, userController.removeUserFromProject);
router.put('/admin/users/:id/projects', requireAdmin, userController.updateUserProjects);

// Admin projects endpoint for user management dropdowns
router.get('/admin/projects', requireAdmin, projectController.getAllProjects);

module.exports = router;