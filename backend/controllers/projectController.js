const { ProjectService } = require('../services/dbService');
const { parseProjectId, formatErrorResponse, formatSuccessResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * Project Controller
 * Handles project assets and settings operations
 */

/**
 * Get project assets (legacy endpoint - defaults to project 1)
 */
const getLegacyAssets = asyncHandler(async (req, res) => {
  try {
    const assets = await ProjectService.getProjectAssets(1);
    res.json(formatSuccessResponse(assets || {}));
  } catch (error) {
    console.error('Get legacy assets error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve assets'));
  }
});

/**
 * Update project assets (legacy endpoint - defaults to project 1)
 */
const updateLegacyAssets = asyncHandler(async (req, res) => {
  try {
    await ProjectService.updateProjectAssets(1, req.body);
    res.json(formatSuccessResponse({}, 'Assets updated successfully'));
  } catch (error) {
    console.error('Update legacy assets error:', error);
    res.status(500).json(formatErrorResponse('Failed to update assets'));
  }
});

/**
 * Get project assets by project ID
 */
const getProjectAssets = asyncHandler(async (req, res) => {
  const projectId = parseProjectId(req.params.projectId);
  
  try {
    const assets = await ProjectService.getProjectAssets(projectId);
    res.json(formatSuccessResponse(assets || {}));
  } catch (error) {
    console.error('Get project assets error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve project assets'));
  }
});

/**
 * Update project assets by project ID
 */
const updateProjectAssets = asyncHandler(async (req, res) => {
  const projectId = parseProjectId(req.params.projectId);
  
  try {
    await ProjectService.updateProjectAssets(projectId, req.body);
    res.json(formatSuccessResponse({}, 'Project assets updated successfully'));
  } catch (error) {
    console.error('Update project assets error:', error);
    res.status(500).json(formatErrorResponse('Failed to update project assets'));
  }
});

/**
 * Get project settings by project ID
 */
const getProjectSettings = asyncHandler(async (req, res) => {
  const projectId = parseProjectId(req.params.projectId);
  
  try {
    const settings = await ProjectService.getProjectSettings(projectId);
    res.json(formatSuccessResponse(settings || {}));
  } catch (error) {
    console.error('Get project settings error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve project settings'));
  }
});

/**
 * Update project settings by project ID
 */
const updateProjectSettings = asyncHandler(async (req, res) => {
  const projectId = parseProjectId(req.params.projectId);
  
  try {
    await ProjectService.updateProjectSettings(projectId, req.body);
    res.json(formatSuccessResponse({}, 'Project settings updated successfully'));
  } catch (error) {
    console.error('Update project settings error:', error);
    res.status(500).json(formatErrorResponse('Failed to update project settings'));
  }
});

/**
 * Get all projects
 */
const getAllProjects = asyncHandler(async (req, res) => {
  try {
    const projects = await ProjectService.getAllProjects();
    res.json(formatSuccessResponse(projects));
  } catch (error) {
    console.error('Get all projects error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve projects'));
  }
});

/**
 * Get project information by ID
 */
const getProject = asyncHandler(async (req, res) => {
  const projectId = parseProjectId(req.params.id);
  
  try {
    const project = await ProjectService.getProjectById(projectId);
    
    if (!project) {
      return res.status(404).json(formatErrorResponse('Project not found'));
    }
    
    res.json(formatSuccessResponse(project));
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve project'));
  }
});

/**
 * Create new project
 */
const createProject = asyncHandler(async (req, res) => {
  try {
    const { project_code, name, description } = req.body;
    
    if (!project_code || !name) {
      return res.status(400).json(formatErrorResponse('Project code and name are required'));
    }
    
    const projectId = await ProjectService.createProject({
      project_code,
      name,
      description
    });
    
    // Proje klasör yapısını oluştur
    await ProjectService.createProjectDirectoryStructure(projectId);
    
    res.status(201).json(formatSuccessResponse({ id: projectId }, 'Project created successfully'));
  } catch (error) {
    console.error('Create project error:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json(formatErrorResponse('Project code already exists'));
    } else {
      res.status(500).json(formatErrorResponse('Failed to create project'));
    }
  }
});

/**
 * Update project
 */
const updateProject = asyncHandler(async (req, res) => {
  const projectId = parseProjectId(req.params.id);
  
  try {
    const { project_code, name, description, is_active } = req.body;
    
    const updated = await ProjectService.updateProject(projectId, {
      project_code,
      name,
      description,
      is_active
    });
    
    if (!updated) {
      return res.status(404).json(formatErrorResponse('Project not found'));
    }
    
    res.json(formatSuccessResponse({}, 'Project updated successfully'));
  } catch (error) {
    console.error('Update project error:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json(formatErrorResponse('Project code already exists'));
    } else {
      res.status(500).json(formatErrorResponse('Failed to update project'));
    }
  }
});

/**
 * Delete project
 */
const deleteProject = asyncHandler(async (req, res) => {
  const projectId = parseProjectId(req.params.id);
  
  try {
    const deleted = await ProjectService.deleteProject(projectId);
    
    if (!deleted) {
      return res.status(404).json(formatErrorResponse('Project not found'));
    }
    
    // Proje dosyalarını sil
    await ProjectService.removeProjectDirectory(projectId);
    
    res.json(formatSuccessResponse({}, 'Project deleted successfully'));
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json(formatErrorResponse('Failed to delete project'));
  }
});

/**
 * Toggle project status
 */
const toggleProjectStatus = asyncHandler(async (req, res) => {
  const projectId = parseProjectId(req.params.id);
  
  try {
    const updated = await ProjectService.toggleProjectStatus(projectId);
    
    if (!updated) {
      return res.status(404).json(formatErrorResponse('Project not found'));
    }
    
    res.json(formatSuccessResponse({}, 'Project status updated successfully'));
  } catch (error) {
    console.error('Toggle project status error:', error);
    res.status(500).json(formatErrorResponse('Failed to update project status'));
  }
});

module.exports = {
  getLegacyAssets,
  updateLegacyAssets,
  getProjectAssets,
  updateProjectAssets,
  getProjectSettings,
  updateProjectSettings,
  getAllProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  toggleProjectStatus
};