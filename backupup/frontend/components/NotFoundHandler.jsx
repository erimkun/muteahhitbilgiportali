import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { checkAuthStatus, getRedirectPath } from '../utils/authUtils';

/**
 * NotFoundHandler component for catch-all 404 routes
 * Redirects based on authentication status:
 * - Unauthenticated: redirect to /login
 * - Authenticated regular user trying to access admin route: redirect to /profile
 * - Authenticated user accessing unknown route: redirect to /profile
 */
export default function NotFoundHandler() {
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    async function handleRedirect() {
      try {
        setLoading(true);
        const { isAuthenticated, isAdmin } = await checkAuthStatus();
        
        // Get appropriate redirect path
        const redirectPath = getRedirectPath(location.pathname, isAuthenticated, isAdmin);
        
        // Add a small delay to prevent flash
        setTimeout(() => {
          navigate(redirectPath, { replace: true });
        }, 500);
        
      } catch (error) {
        console.error('Error in 404 handler:', error);
        // On error, redirect to login as safe fallback
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 500);
      } finally {
        setLoading(false);
      }
    }

    handleRedirect();
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-white">
      <div className="text-center space-y-4">
        {loading ? (
          <>
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            <p className="text-lg">Yönlendiriliyor...</p>
            <p className="text-sm text-gray-400">Yetkilendirme durumunuz kontrol ediliyor</p>
          </>
        ) : (
          <>
            <h1 className="text-6xl font-bold text-red-400">404</h1>
            <p className="text-xl">Sayfa bulunamadı</p>
            <p className="text-gray-400">Uygun sayfaya yönlendiriliyorsunuz...</p>
          </>
        )}
      </div>
    </div>
  );
}