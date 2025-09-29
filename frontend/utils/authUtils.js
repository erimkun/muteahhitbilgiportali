/**
 * Authentication utilities for frontend routing
 */
import { createApiUrl } from '../config/api';

/**
 * Check if user is authenticated by calling the session endpoint
 * @returns {Promise<{isAuthenticated: boolean, user: Object|null, isAdmin: boolean}>}
 */
export async function checkAuthStatus() {
  try {
    const response = await fetch(createApiUrl('session'), {
      credentials: 'include'
    });
    
    if (!response.ok) {
      return { isAuthenticated: false, user: null, isAdmin: false };
    }
    
    const data = await response.json();
    
    if (data.success && data.data?.user) {
      const user = data.data.user;
      const isAdmin = user.role === 'admin' || user.role === 'superadmin';
      return { isAuthenticated: true, user, isAdmin };
    }
    
    if (data.success && data.data?.admin) {
      return { isAuthenticated: true, user: data.data.admin, isAdmin: true };
    }
    
    return { isAuthenticated: false, user: null, isAdmin: false };
  } catch (error) {
    console.error('Error checking auth status:', error);
    return { isAuthenticated: false, user: null, isAdmin: false };
  }
}

/**
 * Get appropriate redirect path based on authentication status
 * @param {string} currentPath - The current path user tried to access
 * @param {boolean} isAuthenticated - Whether user is authenticated
 * @param {boolean} isAdmin - Whether user is admin
 * @returns {string} The path to redirect to
 */
export function getRedirectPath(currentPath, isAuthenticated, isAdmin) {
  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return '/login';
  }
  
  // If authenticated but trying to access admin route as regular user
  if (currentPath.startsWith('/admin/') && !isAdmin) {
    return '/profile';
  }
  
  // If authenticated but trying to access login pages
  if (currentPath === '/login' || currentPath === '/admin/login') {
    return '/profile';
  }
  
  // For any other unknown routes, redirect to profile
  return '/profile';
}