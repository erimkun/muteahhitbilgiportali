const bcrypt = require('bcryptjs');
const { UserService } = require('../services/dbService');
const { normalizePhone, validateRequiredFields, formatErrorResponse, formatSuccessResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * User Controller
 * Handles user management operations (admin only)
 */

/**
 * Get all users (admin only)
 */
const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const users = await UserService.getAllUsers();
    res.json(formatSuccessResponse(users));
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve users'));
  }
});

/**
 * Create new user (admin only)
 */
const createUser = asyncHandler(async (req, res) => {
  const { phone, password, name, role, is_active } = req.body || {};
  
  const validation = validateRequiredFields(req.body, ['phone', 'password']);
  if (!validation.isValid) {
    return res.status(400).json(
      formatErrorResponse('Missing required fields', { missing: validation.missing })
    );
  }

  const normalizedPhone = normalizePhone(phone);
  const passwordHash = bcrypt.hashSync(password, 10);

  try {
    const userId = await UserService.createUser({
      phone: normalizedPhone,
      passwordHash,
      name: name && name.trim() ? name.trim() : normalizedPhone, // Use phone as fallback
      role: role || 'user',
      isActive: is_active === false ? 0 : 1
    });

    res.status(201).json(formatSuccessResponse(
      { id: userId },
      'User created successfully'
    ));
  } catch (error) {
    console.error('Create user error:', error);
    res.status(400).json(formatErrorResponse('Failed to create user', { detail: error.message }));
  }
});

/**
 * Update user (admin only)
 */
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { phone, password, name, is_active, role } = req.body || {};

  // Check if at least one field is provided for update
  if (!phone && !password && name === undefined && is_active === undefined && role === undefined) {
    return res.status(400).json(formatErrorResponse('No fields to update'));
  }

  const updateData = {};
  
  if (phone) updateData.phone = normalizePhone(phone);
  if (password) updateData.passwordHash = bcrypt.hashSync(password, 10);
  if (name !== undefined) updateData.name = name;
  if (is_active !== undefined) updateData.isActive = is_active ? 1 : 0;
  if (role !== undefined) updateData.role = role;

  try {
    const success = await UserService.updateUser(id, updateData);
    
    if (success) {
      res.json(formatSuccessResponse({}, 'User updated successfully'));
    } else {
      res.status(404).json(formatErrorResponse('User not found'));
    }
  } catch (error) {
    console.error('Update user error:', error);
    res.status(400).json(formatErrorResponse('Failed to update user'));
  }
});

/**
 * Delete user (admin only)
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const success = await UserService.deleteUser(id);
    
    if (success) {
      res.json(formatSuccessResponse({}, 'User deleted successfully'));
    } else {
      res.status(404).json(formatErrorResponse('User not found'));
    }
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json(formatErrorResponse('Failed to delete user'));
  }
});

/**
 * Get current user's own projects (for authenticated users)
 */
const getCurrentUserProjects = asyncHandler(async (req, res) => {
  try {
    // Get current user's ID from session
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json(formatErrorResponse('Not authenticated'));
    }

    const projects = await UserService.getUserProjects(userId);
    res.json(formatSuccessResponse(projects));
  } catch (error) {
    console.error('Get current user projects error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve your projects'));
  }
});

/**
 * Get user's assigned projects (admin only)
 */
const getUserProjects = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const projects = await UserService.getUserProjects(parseInt(id));
    res.json(formatSuccessResponse(projects));
  } catch (error) {
    console.error('Get user projects error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve user projects'));
  }
});

/**
 * Assign project to user
 */
const assignUserToProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { project_id } = req.body || {};

  if (!project_id) {
    return res.status(400).json(formatErrorResponse('Project ID is required'));
  }

  try {
    await UserService.assignUserToProject(parseInt(id), parseInt(project_id));
    res.json(formatSuccessResponse(null, 'User assigned to project successfully'));
  } catch (error) {
    console.error('Assign user to project error:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json(formatErrorResponse('User is already assigned to this project'));
    }
    res.status(500).json(formatErrorResponse('Failed to assign user to project'));
  }
});

/**
 * Remove user from project
 */
const removeUserFromProject = asyncHandler(async (req, res) => {
  const { id, projectId } = req.params;

  try {
    await UserService.removeUserFromProject(parseInt(id), parseInt(projectId));
    res.json(formatSuccessResponse(null, 'User removed from project successfully'));
  } catch (error) {
    console.error('Remove user from project error:', error);
    res.status(500).json(formatErrorResponse('Failed to remove user from project'));
  }
});

/**
 * Update user's project assignments (bulk operation)
 */
const updateUserProjects = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { project_ids } = req.body || {};

  if (!Array.isArray(project_ids)) {
    return res.status(400).json(formatErrorResponse('Project IDs must be an array'));
  }

  try {
    await UserService.updateUserProjects(parseInt(id), project_ids);
    res.json(formatSuccessResponse(null, 'User project assignments updated successfully'));
  } catch (error) {
    console.error('Update user projects error:', error);
    res.status(500).json(formatErrorResponse('Failed to update user project assignments'));
  }
});

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getCurrentUserProjects,
  getUserProjects,
  assignUserToProject,
  removeUserFromProject,
  updateUserProjects
};