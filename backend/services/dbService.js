const db = require('../database');
const { handleDatabaseError } = require('../middlewares/errorHandler');
// Self-import guard: require the class after it's defined would be circular; instead, access static method via this class
const fs = require('fs').promises;
const path = require('path');

/**
 * Database service layer for user operations
 */
class UserService {
  /**
   * Get user by phone number
   * @param {string} phone - User phone number
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static getUserByPhone(phone) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, phone, password_hash, is_active, name, role, created_at, last_login FROM users WHERE phone = ?',
        [phone],
        (err, row) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }

  /**
   * Get all users (admin only)
   * @returns {Promise<Array>} Array of users
   */
  static getAllUsers() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT id, phone, name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<number>} User ID
   */
  static createUser(userData) {
    const { phone, passwordHash, name, isActive, role } = userData;
    console.log('Creating user with data:', { phone, passwordHash: passwordHash?.substring(0,10) + '...', name, isActive, role });
    return new Promise((resolve, reject) => {
      // First check if phone already exists
      db.get('SELECT id FROM users WHERE phone = ?', [phone], (err, row) => {
        if (err) {
          console.error('Database error checking phone:', err);
          reject(handleDatabaseError(err));
          return;
        }
        
        if (row) {
          console.error('Phone already exists:', phone);
          reject(new Error('Phone number already exists'));
          return;
        }
        
        // Insert new user with guaranteed name value
        const userName = name && name.trim() ? name.trim() : phone; // Use phone as fallback name
        const userRole = role || 'user';
        db.run(
          'INSERT INTO users (phone, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?)',
          [phone, passwordHash, userName, userRole, isActive !== undefined ? (isActive ? 1 : 0) : 1],
          function(err) {
            if (err) {
              console.error('Database error in createUser:', err);
              reject(handleDatabaseError(err));
            } else {
              console.log('User created successfully with ID:', this.lastID);
              resolve(this.lastID);
            }
          }
        );
      });
    });
  }

  /**
   * Update user
   * @param {number} id - User ID
   * @param {Object} userData - Updated user data
   * @returns {Promise<boolean>} Success status
   */
  static updateUser(id, userData) {
    const { phone, passwordHash, name, isActive, role } = userData;
    
    // Build dynamic query based on provided fields
    const updates = [];
    const params = [];
    
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (passwordHash !== undefined) {
      updates.push('password_hash = ?');
      params.push(passwordHash);
    }
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }
    
    if (updates.length === 0) {
      return Promise.resolve(false);
    }
    
    params.push(id);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    return new Promise((resolve, reject) => {
      console.log('UPDATE USER DEBUG:');
      console.log('- ID:', id);
      console.log('- UserData:', userData);
      console.log('- Query:', query);
      console.log('- Params:', params);

      db.run(query, params, function(err) {
        if (err) {
          console.error('UPDATE ERROR:', err);
          reject(handleDatabaseError(err));
        } else {
          console.log('UPDATE SUCCESS - Changes:', this.changes);
          resolve(this.changes > 0);
        }
      });
    });
  }

  /**
   * Delete user
   * @param {number} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  static deleteUser(id) {
    return new Promise((resolve, reject) => {
      // Delete user_projects relationships first (CASCADE should handle this but explicit cleanup)
      db.run('DELETE FROM user_projects WHERE user_id = ?', [id], (err) => {
        if (err) {
          console.error('Error deleting user project assignments:', err);
        }
        
        // Delete the user
        db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(this.changes > 0);
          }
        });
      });
    });
  }

  /**
   * Get user's assigned projects
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of projects assigned to user
   */
  static getUserProjects(userId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT p.id,
               p.project_code,
               p.name as project_name,
               p.description,
               up.granted_at as assigned_at
        FROM projects p
        INNER JOIN user_projects up ON p.id = up.project_id
        WHERE up.user_id = ?
        ORDER BY up.granted_at DESC
      `, [userId], (err, rows) => {
        if (err) {
          reject(handleDatabaseError(err));
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Assign user to project
   * @param {number} userId - User ID
   * @param {number} projectId - Project ID
   * @returns {Promise<boolean>} Success status
   */
  static assignUserToProject(userId, projectId) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO user_projects (user_id, project_id, permissions) VALUES (?, ?, ?)',
        [userId, projectId, 'read'],
        function(err) {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  /**
   * Remove user from project
   * @param {number} userId - User ID
   * @param {number} projectId - Project ID
   * @returns {Promise<boolean>} Success status
   */
  static removeUserFromProject(userId, projectId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM user_projects WHERE user_id = ? AND project_id = ?',
        [userId, projectId],
        function(err) {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(this.changes > 0);
          }
        }
      );
    });
  }

  /**
   * Update user's project assignments (bulk operation)
   * @param {number} userId - User ID
   * @param {Array<number>} projectIds - Array of project IDs to assign
   * @returns {Promise<boolean>} Success status
   */
  static updateUserProjects(userId, projectIds) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Remove all existing assignments
        db.run('DELETE FROM user_projects WHERE user_id = ?', [userId], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(handleDatabaseError(err));
          }
          
          // Insert new assignments
          if (projectIds.length === 0) {
            db.run('COMMIT');
            return resolve(true);
          }
          
          let completed = 0;
          let hasError = false;
          
          projectIds.forEach(projectId => {
            if (hasError) return;
            
            db.run(
              'INSERT INTO user_projects (user_id, project_id, permissions) VALUES (?, ?, ?)',
              [userId, projectId, 'read'],
              (err) => {
                if (err && !hasError) {
                  hasError = true;
                  db.run('ROLLBACK');
                  return reject(handleDatabaseError(err));
                }
                
                completed++;
                if (completed === projectIds.length) {
                  db.run('COMMIT');
                  resolve(true);
                }
              }
            );
          });
        });
      });
    });
  }
}

/**
 * Database service layer for admin operations
 */
class AdminService {
  /**
   * Get admin by phone number
   * @param {string} phone - Admin phone number
   * @returns {Promise<Object|null>} Admin object or null if not found
   */
  static getAdminByPhone(phone) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, phone, password_hash, role FROM admins WHERE phone = ?',
        [phone],
        (err, row) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }
}

/**
 * Database service layer for project operations
 */
class ProjectService {
  /**
   * Get project assets
   * @param {number} projectId - Project ID (defaults to 1)
   * @returns {Promise<Object|null>} Project assets or null if not found
   */
  static getProjectAssets(projectId = 1) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM project_assets WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
        [projectId],
        (err, row) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }

  /**
   * Update project assets
   * @param {number} projectId - Project ID
   * @param {Object} assets - Assets data
   * @returns {Promise<boolean>} Success status
   */
  static updateProjectAssets(projectId, assets) {
    return new Promise((resolve, reject) => {
      const {
        fbx_zip_url, drone_photos_gallery_url, drone_photos_zip_url,
        drone_video_url, view_360_url, orthophoto_url,
        floor_plans_gallery_url, floor_plans_autocad_url
      } = assets;

      db.run(
        `INSERT OR REPLACE INTO project_assets 
        (project_id, fbx_zip_url, drone_photos_gallery_url, drone_photos_zip_url, 
         drone_video_url, view_360_url, orthophoto_url, floor_plans_gallery_url, floor_plans_autocad_url) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectId, fbx_zip_url, drone_photos_gallery_url, drone_photos_zip_url,
         drone_video_url, view_360_url, orthophoto_url, floor_plans_gallery_url, floor_plans_autocad_url],
        function(err) {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  /**
   * Get project settings
   * @param {number} projectId - Project ID
   * @returns {Promise<Object|null>} Project settings or null if not found
   */
  static getProjectSettings(projectId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM project_settings WHERE project_id = ?',
        [projectId],
        (err, row) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }

  /**
   * Update project settings
   * @param {number} projectId - Project ID
   * @param {Object} settings - Settings data
   * @returns {Promise<boolean>} Success status
   */
  static updateProjectSettings(projectId, settings) {
    const { home_camera_view, panel_camera_view, corner_camera_view } = settings;
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO project_settings 
        (project_id, home_camera_view, panel_camera_view, corner_camera_view) 
        VALUES (?, ?, ?, ?)`,
        [projectId, home_camera_view, panel_camera_view, corner_camera_view],
        function(err) {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  /**
   * Get all projects
   * @returns {Promise<Array>} List of projects
   */
  static getAllProjects() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT id, project_code, name, description, is_active, created_at FROM projects ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Get project information by ID
   * @param {number} projectId - Project ID
   * @returns {Promise<Object|null>} Project information or null if not found
   */
  static getProjectById(projectId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, project_code, name, description, is_active, created_at FROM projects WHERE id = ?',
        [projectId],
        (err, row) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }

  /**
   * Get project information by project_code
   * @param {string} projectCode - Project code (e.g., "400_111")
   * @returns {Promise<Object|null>} Project information or null if not found
   */
  static getProjectByCode(projectCode) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, project_code, name, description, is_active, created_at FROM projects WHERE project_code = ?',
        [projectCode],
        (err, row) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }

  /**
   * Create new project
   * @param {Object} projectData - Project data
   * @returns {Promise<number>} New project ID
   */
  static createProject(projectData) {
    return new Promise((resolve, reject) => {
      const { project_code, name, description } = projectData;
      
      db.run(
        'INSERT INTO projects (project_code, name, description, is_active) VALUES (?, ?, ?, 1)',
        [project_code, name, description || null],
        function(err) {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * Update project
   * @param {number} projectId - Project ID
   * @param {Object} updateData - Update data
   * @returns {Promise<boolean>} Success status
   */
  static updateProject(projectId, updateData) {
    return new Promise((resolve, reject) => {
      const { project_code, name, description, is_active } = updateData;
      const updates = [];
      const params = [];
      
      if (project_code !== undefined) {
        updates.push('project_code = ?');
        params.push(project_code);
      }
      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active);
      }
      
      if (updates.length === 0) {
        resolve(false);
        return;
      }
      
      params.push(projectId);
      
      db.run(
        `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function(err) {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(this.changes > 0);
          }
        }
      );
    });
  }

  /**
   * Delete project (soft delete - set is_active to false)
   * Also cleans up related database records
   * @param {number} projectId - Project ID
   * @returns {Promise<boolean>} Success status
   */
  static deleteProject(projectId) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Clean up related records first
        const cleanupQueries = [
          // Remove user project assignments
          'DELETE FROM user_projects WHERE project_id = ?',
          // Remove project assets
          'DELETE FROM project_assets WHERE project_id = ?',
          // Remove project settings
          'DELETE FROM project_settings WHERE project_id = ?',
          // Remove model versions
          'DELETE FROM model_versions WHERE project_id = ?',
          // Remove gallery images
          'DELETE FROM gallery_images WHERE project_id = ?'
        ];

        let completed = 0;
        const totalQueries = cleanupQueries.length + 1; // +1 for the final project update

        // Execute cleanup queries
        for (const query of cleanupQueries) {
          db.run(query, [projectId], (err) => {
            if (err) {
              console.error('Error cleaning up related records:', err);
            }
            completed++;
            if (completed === cleanupQueries.length) {
              // Now soft delete the project
              db.run(
                'UPDATE projects SET is_active = 0 WHERE id = ?',
                [projectId],
                function(err) {
                  if (err) {
                    reject(handleDatabaseError(err));
                  } else {
                    console.log(`Project ${projectId} soft deleted and related records cleaned up`);
                    resolve(this.changes > 0);
                  }
                }
              );
            }
          });
        }
      });
    });
  }

  /**
   * Toggle project status
   * @param {number} projectId - Project ID
   * @returns {Promise<boolean>} Success status
   */
  static toggleProjectStatus(projectId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE projects SET is_active = NOT is_active WHERE id = ?',
        [projectId],
        function(err) {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(this.changes > 0);
          }
        }
      );
    });
  }

  /**
   * Create project directory structure
   * @param {number} projectId - Project ID
   * @returns {Promise<boolean>} Success status
   */
  static async createProjectDirectoryStructure(projectId) {
    try {
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      const frontendPublicDir = path.join(__dirname, '..', '..', 'frontend', 'public');
      
      // Fetch project to get its project_code for folder naming
      let projectCode = String(projectId);
      try {
        const project = await ProjectService.getProjectById(projectId);
        if (project && project.project_code) projectCode = project.project_code;
      } catch (_e) {}
      
      // Backend klasör yapısı (uploads/)
      const projectDir = path.join(uploadsDir, 'projects', projectCode);
      await fs.mkdir(projectDir, { recursive: true });
      const backendSubDirs = [
        'drone_photos',
        'drone_photos_file', 
        'floor_plans',
        'floor_plans_file',
        'orthophoto',
        'view_360',
        'fbx_model_file',
        'other',
        'muteahhit'
      ];
      for (const subDir of backendSubDirs) {
        await fs.mkdir(path.join(projectDir, subDir), { recursive: true });
      }
      
      // YENİ: Frontend klasör yapısı (frontend/public/)
      const frontendProjectDir = path.join(frontendPublicDir, `${projectCode}_project`);
      await fs.mkdir(frontendProjectDir, { recursive: true });
      const frontendSubDirs = [
        'models',    // 3D modeller (bina_model.gltf)
        'tiles',     // Tileset dosyaları (sezyum_{projectCode}.json)
        '360views'   // 360 görüntüler (panorama_{projectCode}.jpg)
      ];
      for (const subDir of frontendSubDirs) {
        await fs.mkdir(path.join(frontendProjectDir, subDir), { recursive: true });
      }
      
      console.log(`Project directory structure created for project ${projectId} (${projectCode})`);
      console.log(`Backend: ${projectDir}`);
      console.log(`Frontend: ${frontendProjectDir}`);
      return true;
    } catch (error) {
      console.error('Error creating project directory structure:', error);
      throw error;
    }
  }

  /**
   * Remove project directory and files
   * @param {number} projectId - Project ID
   * @returns {Promise<boolean>} Success status
   */
  static async removeProjectDirectory(projectId) {
    try {
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      const projectDir = path.join(uploadsDir, `project_${projectId}`);
      
      // Klasör varsa sil
      try {
        await fs.access(projectDir);
        await fs.rm(projectDir, { recursive: true, force: true });
        console.log(`Project directory removed for project ${projectId}`);
      } catch (err) {
        // Klasör yoksa hata verme
        console.log(`Project directory not found for project ${projectId}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error removing project directory:', error);
      throw error;
    }
  }
}

/**
 * Database service layer for model version operations
 */
class ModelService {
  /**
   * Get published model version for project
   * @param {number} projectId - Project ID
   * @returns {Promise<Object|null>} Model version or null if not found
   */
  static getPublishedModelVersion(projectId = 1) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM model_versions WHERE project_id = ? AND is_published = 1 ORDER BY created_at DESC LIMIT 1',
        [projectId],
        (err, row) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }

  /**
   * Create new model version
   * @param {Object} modelData - Model version data
   * @returns {Promise<number>} Model version ID
   */
  static createModelVersion(modelData) {
    const { projectId, tilesetClips, buildingTransform, modelClipPlanes, logoTransform } = modelData;
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO model_versions (project_id, tileset_clips, building_transform, model_clip_planes, logo_transform) VALUES (?, ?, ?, ?, ?)',
        [projectId, tilesetClips, buildingTransform, modelClipPlanes, logoTransform],
        function(err) {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * Publish model version
   * @param {number} id - Model version ID
   * @param {number} projectId - Project ID
   * @returns {Promise<boolean>} Success status
   */
  static publishModelVersion(id, projectId) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // First unpublish all versions for this project
        db.run('UPDATE model_versions SET is_published = 0 WHERE project_id = ?', [projectId]);
        // Then publish the specified version
        db.run('UPDATE model_versions SET is_published = 1 WHERE id = ?', [id], function(err) {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(this.changes > 0);
          }
        });
      });
    });
  }

  /**
   * Get model version history for project
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Array of model versions
   */
  static getModelVersionHistory(projectId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM model_versions WHERE project_id = ? ORDER BY created_at DESC',
        [projectId],
        (err, rows) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }
}

/**
 * Database service layer for gallery operations
 */
class GalleryService {
  /**
   * Get gallery images by album and project
   * @param {string} album - Album name
   * @param {string|number} projectKey - Canonical project key (project_code like "400_111" or numeric id as string)
   * @returns {Promise<Array>} Array of gallery images
   */
  static getGalleryImages(album, projectKey) {
    return new Promise((resolve, reject) => {
      const query = `SELECT id, album, filename, url, title, created_at FROM gallery_images WHERE album = ? AND project_id = ? ORDER BY created_at DESC`;
      const params = [album, String(projectKey)];
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(handleDatabaseError(err));
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Create gallery images batch
   * @param {Array} images - Array of image data
   * @returns {Promise<number>} Number of inserted images
   */
  static createGalleryImages(images) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare('INSERT INTO gallery_images (album, filename, url, title, project_id) VALUES (?,?,?,?,?)');
      let insertedCount = 0;
      
      for (const image of images) {
        const { album, filename, url, title, projectId } = image;
        stmt.run([album, filename, url, title, projectId], function(err) {
          if (err) {
            stmt.finalize();
            reject(handleDatabaseError(err));
            return;
          }
          insertedCount++;
        });
      }
      
      stmt.finalize((err) => {
        if (err) {
          reject(handleDatabaseError(err));
        } else {
          resolve(insertedCount);
        }
      });
    });
  }

  /**
   * Get gallery image by ID, album and project
   * @param {number} id - Image ID
   * @param {string} album - Album name
   * @param {number} projectId - Project ID
   * @returns {Promise<Object|null>} Gallery image or null if not found
   */
  static getGalleryImageById(id, album, projectId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, album, filename, url, title, created_at FROM gallery_images WHERE id = ? AND album = ? AND project_id = ?',
        [id, album, projectId],
        (err, row) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }

  /**
   * Delete gallery image by ID and project
   * @param {number} id - Image ID
   * @param {number} projectId - Project ID
   * @returns {Promise<boolean>} Success status
   */
  static deleteGalleryImage(id, projectId) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM gallery_images WHERE id = ? AND project_id = ?', [id, projectId], function(err) {
        if (err) {
          reject(handleDatabaseError(err));
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  /**
   * Get gallery images by IDs, album and project for bulk operations
   * @param {Array<number>} ids - Array of image IDs
   * @param {string} album - Album name
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Array of gallery images
   */
  static getGalleryImagesByIds(ids, album, projectId) {
    return new Promise((resolve, reject) => {
      const placeholders = ids.map(() => '?').join(',');
      db.all(
        `SELECT id, filename FROM gallery_images WHERE album = ? AND project_id = ? AND id IN (${placeholders})`,
        [album, projectId, ...ids],
        (err, rows) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Delete gallery images by IDs, album and project
   * @param {Array<number>} ids - Array of image IDs
   * @param {string} album - Album name
   * @param {number} projectId - Project ID
   * @returns {Promise<number>} Number of deleted images
   */
  static deleteGalleryImages(ids, album, projectId) {
    return new Promise((resolve, reject) => {
      const placeholders = ids.map(() => '?').join(',');
      db.run(
        `DELETE FROM gallery_images WHERE album = ? AND project_id = ? AND id IN (${placeholders})`,
        [album, projectId, ...ids],
        function(err) {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  }

  /**
   * Delete gallery image by filename
   * @param {string} filename - Filename to delete
   * @param {string} album - Album name
   * @param {number} projectId - Project ID
   * @returns {Promise<number>} Number of deleted images
   */
  static deleteGalleryImageByFilename(filename, album, projectId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM gallery_images WHERE filename = ? AND album = ? AND project_id = ?',
        [filename, album, projectId],
        function(err) {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  }

  /**
   * Get all gallery images for a project (all albums)
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Array of gallery images
   */
  static getAllProjectGalleryImages(projectId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT id, album, filename, url, title, created_at FROM gallery_images WHERE project_id = ? ORDER BY album, created_at DESC',
        [projectId],
        (err, rows) => {
          if (err) {
            reject(handleDatabaseError(err));
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }
}

module.exports = {
  UserService,
  AdminService,
  ProjectService,
  ModelService,
  GalleryService
};