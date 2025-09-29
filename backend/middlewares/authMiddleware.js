/**
 * Authentication middleware for user and admin authentication
 */

/**
 * Middleware to require user authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireUser(req, res, next) {
  if (req.session?.user && !req.session.admin) {
    return next();
  }
  return res.status(401).json({ error: 'User auth required' });
}

/**
 * Middleware to require admin authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireAdmin(req, res, next) {
  if (req.session?.admin || (req.session?.user && ['admin', 'superadmin'].includes(req.session.user.role))) {
    return next();
  }
  return res.status(401).json({ error: 'Admin auth required' });
}

/**
 * Middleware to optionally check authentication (allows both user and admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function optionalAuth(req, res, next) {
  // This middleware doesn't block requests but provides auth info
  req.isAuthenticated = !!(req.session?.user || req.session?.admin);
  req.isAdmin = !!req.session?.admin;
  req.isUser = !!req.session?.user;
  next();
}

/**
 * Middleware to ensure users can only access their assigned project data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function requireProjectAccess(req, res, next) {
  let requestedProjectId = req.params.projectId || req.params.id;
  
  // If projectId looks like a project_code (e.g., contains underscore or letters), resolve to numeric ID
  if (requestedProjectId && /[a-zA-Z_]/.test(String(requestedProjectId))) {
    try {
      const { ProjectService } = require('../services/dbService');
      const project = await ProjectService.getProjectByCode(String(requestedProjectId));
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      requestedProjectId = project.id;
    } catch (e) {
      console.error('Error resolving project by code:', e);
      return res.status(500).json({ error: 'Error resolving project access' });
    }
  } else {
    requestedProjectId = parseInt(requestedProjectId);
  }
  
  // Admin'ler tüm projelere erişebilir (including superadmin role on user session)
  if (req.session?.admin || (req.session?.user && ['admin', 'superadmin'].includes(req.session.user.role))) {
    return next();
  }
  
  // Kullanıcı giriş yapmış mı kontrol et
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const userId = req.session.user.id;
  
  try {
    // Check user's project assignments from many-to-many table
    const { UserService } = require('../services/dbService');
    const userProjects = await UserService.getUserProjects(userId);
    
    if (!userProjects || userProjects.length === 0) {
      return res.status(403).json({ error: 'No projects assigned to user' });
    }
    
    const assignedProjectIds = userProjects.map(p => p.id);
    
    // If specific project requested, check if user has access
    if (requestedProjectId && !assignedProjectIds.includes(requestedProjectId)) {
      return res.status(403).json({ error: 'Access denied: You can only access your assigned project data' });
    }
    
    // Add user's project IDs to request for further use
    req.userProjectIds = assignedProjectIds;
    req.userProjects = userProjects;
    next();
    
  } catch (error) {
    console.error('Error checking project access:', error);
    return res.status(500).json({ error: 'Error verifying project access' });
  }
}

/**
 * Middleware to validate project access for user endpoints
 * For endpoints that don't have projectId in params but need project validation
 */
async function validateUserProject(req, res, next) {
  // Admin'ler tüm projelere erişebilir
  if (req.session?.admin) {
    return next();
  }
  
  // Kullanıcı giriş yapmış mı kontrol et
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const userId = req.session.user.id;
  
  try {
    // Check user's project assignments from many-to-many table
    const { UserService } = require('../services/dbService');
    const userProjects = await UserService.getUserProjects(userId);
    
    if (!userProjects || userProjects.length === 0) {
      return res.status(403).json({ error: 'No projects assigned to user' });
    }
    
    // Add user's project IDs to request for further use
    req.userProjectIds = userProjects.map(p => p.id);
    req.userProjects = userProjects;
    next();
    
  } catch (error) {
    console.error('Error validating project access:', error);
    return res.status(500).json({ error: 'Error validating project access' });
  }
}

module.exports = {
  requireUser,
  requireAdmin,
  optionalAuth,
  requireProjectAccess,
  validateUserProject
};