const { ModelService } = require('../services/dbService');
const { parseProjectId, formatErrorResponse, formatSuccessResponse, parseJSONSafely } = require('../utils/helpers');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * Model Controller
 * Handles 3D model version operations
 */

/**
 * Get published model version for project
 */
const getPublishedModelVersion = asyncHandler(async (req, res) => {
  const projectId = parseProjectId(req.params.projectId);
  
  try {
    const modelVersion = await ModelService.getPublishedModelVersion(projectId);
    
    if (!modelVersion) {
      return res.json(formatSuccessResponse({
        tileset_clips: '[]',
        building_transform: '{}',
        model_clip_planes: '[]',
        logo_transform: '{}'
      }));
    }

    // Parse JSON fields safely
    const response = {
      ...modelVersion,
      tileset_clips: parseJSONSafely(modelVersion.tileset_clips, []),
      building_transform: parseJSONSafely(modelVersion.building_transform, {}),
      model_clip_planes: parseJSONSafely(modelVersion.model_clip_planes, []),
      logo_transform: parseJSONSafely(modelVersion.logo_transform, {})
    };

    res.json(formatSuccessResponse(response));
  } catch (error) {
    console.error('Get published model version error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve model version'));
  }
});

/**
 * Create new model version
 */
const createModelVersion = asyncHandler(async (req, res) => {
  const projectId = parseProjectId(req.params.projectId);
  const { tileset_clips, building_transform, model_clip_planes, logo_transform } = req.body;

  try {
    const modelId = await ModelService.createModelVersion({
      projectId,
      tilesetClips: JSON.stringify(tileset_clips || []),
      buildingTransform: JSON.stringify(building_transform || {}),
      modelClipPlanes: JSON.stringify(model_clip_planes || []),
      logoTransform: JSON.stringify(logo_transform || {})
    });

    res.status(201).json(formatSuccessResponse(
      { id: modelId },
      'Model version created successfully'
    ));
  } catch (error) {
    console.error('Create model version error:', error);
    res.status(500).json(formatErrorResponse('Failed to create model version'));
  }
});

/**
 * Publish model version
 */
const publishModelVersion = asyncHandler(async (req, res) => {
  const projectId = parseProjectId(req.params.projectId);
  const { id } = req.params;

  try {
    const success = await ModelService.publishModelVersion(id, projectId);
    
    if (success) {
      res.json(formatSuccessResponse({}, 'Model version published successfully'));
    } else {
      res.status(404).json(formatErrorResponse('Model version not found'));
    }
  } catch (error) {
    console.error('Publish model version error:', error);
    res.status(500).json(formatErrorResponse('Failed to publish model version'));
  }
});

/**
 * Get model version history for project
 */
const getModelVersionHistory = asyncHandler(async (req, res) => {
  const projectId = parseProjectId(req.params.projectId);
  
  try {
    const versions = await ModelService.getModelVersionHistory(projectId);
    
    // Parse JSON fields for each version
    const parsedVersions = versions.map(version => ({
      ...version,
      tileset_clips: parseJSONSafely(version.tileset_clips, []),
      building_transform: parseJSONSafely(version.building_transform, {}),
      model_clip_planes: parseJSONSafely(version.model_clip_planes, []),
      logo_transform: parseJSONSafely(version.logo_transform, {})
    }));

    res.json(formatSuccessResponse(parsedVersions));
  } catch (error) {
    console.error('Get model version history error:', error);
    res.status(500).json(formatErrorResponse('Failed to retrieve model version history'));
  }
});

module.exports = {
  getPublishedModelVersion,
  createModelVersion,
  publishModelVersion,
  getModelVersionHistory
};