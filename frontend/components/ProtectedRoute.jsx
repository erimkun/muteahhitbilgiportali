import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { checkAuthStatus } from '../utils/authUtils';

/**
 * ProtectedRoute component that checks authentication and redirects appropriately
 * This handles both authenticated and unauthenticated users for any route
 */
export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    async function verifyAuth() {
      try {
        setLoading(true);
        const { isAuthenticated, isAdmin } = await checkAuthStatus();
        
        // Determine if current path requires authentication or admin access
        const currentPath = location.pathname;
        const requiresAuth = ['/profile', '/app/', '/admin/'].some(path => 
          currentPath === path || currentPath.startsWith(path)
        );
        
        // For routes that require authentication
        if (requiresAuth) {
          if (!isAuthenticated) {
            navigate('/login', { replace: true });
            return;
          }
          
          // Check admin access for admin routes
          if (currentPath.startsWith('/admin/') && !isAdmin) {
            navigate('/profile', { replace: true });
            return;
          }
        }
        
        // For login pages when already authenticated
        if ((currentPath === '/login' || currentPath === '/admin/login') && isAuthenticated) {
          navigate('/profile', { replace: true });
          return;
        }
        
        setAuthChecked(true);
      } catch (error) {
        console.error('Auth verification error:', error);
        // On error, redirect to login for protected routes
        const currentPath = location.pathname;
        const requiresAuth = ['/profile', '/app/', '/admin/'].some(path => 
          currentPath === path || currentPath.startsWith(path)
        );
        
        if (requiresAuth) {
          navigate('/login', { replace: true });
        } else {
          setAuthChecked(true);
        }
      } finally {
        setLoading(false);
      }
    }

    verifyAuth();
  }, [location.pathname, navigate]);

  // Show loading spinner while checking auth
  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-white text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="mt-2 text-sm">Yetkilendirme kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  return children;
}