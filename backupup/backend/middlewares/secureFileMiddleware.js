const { requireUser, requireAdmin, requireProjectAccess } = require('../middlewares/authMiddleware');
const path = require('path');
const fs = require('fs');

/**
 * Secure file serving middleware
 * Only authenticated users can access files from their assigned projects
 */
function secureFileServing(req, res, next) {
  // Parse the request path to determine project access
  const urlPath = req.path;
  
  // Debug log for URL analysis
  console.log('secureFileServing - URL:', urlPath);
  
  // All files are now project-based: /projects/PROJECT_ID/... or /upload/projects/PROJECT_ID/...
  const projectMatch = urlPath.match(/\/(?:upload\/)?projects\/([^\/]+)/);
  if (projectMatch) {
    const requestedProjectId = projectMatch[1];
    console.log('Matched project ID:', requestedProjectId);
    req.requestedProjectId = requestedProjectId;
    
    // Superuser (admin) can access all projects
    if (req.session?.admin) {
      console.log('Admin access granted for:', requestedProjectId);
      return next();
    }
    
    // Regular users can only access their assigned projects
    if (req.session?.user) {
      return validateProjectAccess(req, res, next);
    }
    
    // If no authentication, deny access
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Handle nested project folders: /projects/PROJECT_CODE/project_ID/ -> /projects/PROJECT_CODE/
  const nestedProjectMatch = urlPath.match(/\/(?:upload\/)?projects\/([^\/]+)\/project_\d+\/(.*)/);
  if (nestedProjectMatch) {
    const projectCode = nestedProjectMatch[1];
    const remainingPath = nestedProjectMatch[2];
    
    // For nested project folders, we keep the project code and validate access
    req.requestedProjectId = projectCode;
    
    if (req.session?.admin) {
      return next();
    }
    if (req.session?.user) {
      return validateProjectAccess(req, res, next);
    }
    
    // If no authentication, deny access
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Backwards compatibility: old /project_ID/ paths (redirect to new structure)
  const oldProjectMatch = urlPath.match(/\/project_([^\/]+)/);
  if (oldProjectMatch) {
    const projectId = oldProjectMatch[1];
    const newPath = urlPath.replace(`/project_${projectId}`, `/projects/${projectId}`);
    return res.redirect(301, newPath);
  }
  
  // Legacy paths without project (old direct album access) - deny access
  if (urlPath.match(/^\/(drone_photos|files|floor_plans|orthophoto|view_360|other|drone_photos_file|floor_plans_file|fbx_model_file|muteahhit)\//)) {
    return res.status(403).json({ 
      error: 'Direct album access denied. Files are now organized by project.',
      hint: 'Use /projects/PROJECT_ID/ALBUM/ instead'
    });
  }
  
  return res.status(401).json({ error: 'Authentication required' });
}

/**
 * Project access validation for file serving
 */
async function validateProjectAccess(req, res, next) {
  if (req.session?.admin) {
    return next(); // Admin has access to all projects
  }
  
  if (req.session?.user && req.requestedProjectId) {
    const { UserService } = require('../services/dbService');
    
    try {
      const userProjects = await UserService.getUserProjects(req.session.user.id);
      
      const hasAccess = userProjects.some(project => 
        project.project_code === req.requestedProjectId ||
        project.id.toString() === req.requestedProjectId
      );
      
      if (hasAccess) {
        return next();
      }
    } catch (error) {
      console.error('Error checking project access:', error);
    }
  }
  
  return res.status(403).json({ error: 'Project access denied' });
}

module.exports = {
  secureFileServing,
  validateProjectAccess
};