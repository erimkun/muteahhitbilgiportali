/**
 * API Configuration
 * Handles different base URLs for development and production environments
 */

const getApiBaseUrl = () => {
  // Check if we have a runtime environment variable (for production)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Fallback to localhost for development
  return 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Create complete API URL from endpoint
 * @param {string} endpoint - API endpoint (e.g., '/api/projects/1')
 * @returns {string} Complete URL
 */
export const createApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

/**
 * Create file URL for assets
 * @param {string} filePath - File path (e.g., '/uploads/projects/400_111/file.jpg')
 * @returns {string} Complete file URL
 */
export const createFileUrl = (filePath) => {
  if (!filePath) return filePath;
  
  // If it's already a complete URL, return as is
  if (filePath.startsWith('http')) return filePath;
  
  // If it's a relative path starting with /uploads or /upload, prepend API base
  if (filePath.startsWith('/uploads') || filePath.startsWith('/upload')) {
    return `${API_BASE_URL}${filePath}`;
  }
  
  return filePath;
};

export default {
  API_BASE_URL,
  createApiUrl,
  createFileUrl
};