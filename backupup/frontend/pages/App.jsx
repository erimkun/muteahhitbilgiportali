import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { CesiumProvider } from '../context/CesiumContext';
import CesiumViewer from '../components/CesiumViewer';
import CardContainer from '../components/ui/CardContainer';
import Card from '../components/ui/Card';
import KentasLogoWhite from '/KentasLogoWhite.png';
import { checkAuthStatus } from '../utils/authUtils';
import { createApiUrl } from '../config/api';
import './App.css';

function LogoIcon({ className = '' }) {
  return (
    <img src={KentasLogoWhite} alt="Kentaş Logo" className={className} />
  );
}

export default function App() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [authVerified, setAuthVerified] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [projectInfo, setProjectInfo] = useState(null);
  const [userProjects, setUserProjects] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const currentProjectId = Number(projectId) || null;

  // Additional authentication check specific to app access
  useEffect(() => {
    async function verifyAppAccess() {
      try {
        const { isAuthenticated } = await checkAuthStatus();
        
        if (!isAuthenticated) {
          navigate('/login', { replace: true });
          return;
        }
        
        // Regular users can access app routes, admins can access both app and admin routes
        setAuthVerified(true);
      } catch (error) {
        console.error('App access verification failed:', error);
        navigate('/login', { replace: true });
      }
    }

    verifyAppAccess();
  }, [navigate]);

  // Fetch user info
  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const response = await fetch(createApiUrl('session'), {
          credentials: 'include'
        });
        if (response.ok) {
          const sessionData = await response.json();
          // Handle both user and admin sessions like in Profile.jsx
          let userData;
          if (sessionData.data?.user) {
            userData = sessionData.data.user;
          } else if (sessionData.data?.admin) {
            userData = { ...sessionData.data.admin, role: 'admin' };
          }
          setUserInfo(userData);
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      }
    }

    if (authVerified) {
      fetchUserInfo();
    }
  }, [authVerified]);

  // Fetch project info
  useEffect(() => {
    async function fetchProjectInfo() {
      try {
        const response = await fetch(createApiUrl(`api/projects/${projectId}`), {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setProjectInfo(data.data || data);
        }
      } catch (error) {
        console.error('Failed to fetch project info:', error);
      }
    }

    if (authVerified && projectId) {
      fetchProjectInfo();
    }
  }, [authVerified, projectId]);

  useEffect(() => {
    if (!authVerified || !userInfo) return;
    let cancelled = false;

    async function fetchProjects() {
      try {
        const isAdminRole = userInfo?.role === 'admin' || userInfo?.role === 'superadmin';
        const endpoint = isAdminRole ? 'admin/projects' : 'user/projects';
        const response = await fetch(createApiUrl(endpoint), {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.status}`);
        }
        const data = await response.json();
        const projects = Array.isArray(data.data) ? data.data : [];
        if (!cancelled) {
          setUserProjects(projects);
        }
      } catch (error) {
        console.error('Failed to fetch user projects:', error);
        if (!cancelled) {
          setUserProjects([]);
        }
      }
    }

    fetchProjects();

    return () => {
      cancelled = true;
    };
  }, [authVerified, userInfo]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointer = (event) => {
      if (!menuRef.current || menuRef.current.contains(event.target)) {
        return;
      }
      setMenuOpen(false);
    };

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [projectId]);

  const handleProfileClick = () => {
    setMenuOpen(false);
    navigate('/profile');
  };

  const handleLogout = async () => {
    try {
      await fetch(createApiUrl('logout'), {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setMenuOpen(false);
      navigate('/login', { replace: true });
    }
  };

  const handleProjectNavigate = (targetId) => {
    if (!targetId || Number(targetId) === currentProjectId) {
      setMenuOpen(false);
      return;
    }
    setMenuOpen(false);
    navigate(`/app/${targetId}`);
  };

  const otherProjects = (userProjects || []).filter((project) => project.id !== currentProjectId);

  if (!authVerified) {
    return (
      <div className="w-full h-screen bg-gray-900 dark overflow-hidden relative flex items-center justify-center">
        <div className="text-white text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="mt-2 text-sm">Yetkilendirme kontrol ediliyor...</p>
        </div>
      </div>
    );
  }
  return (
    <CesiumProvider projectId={Number(projectId) || 1}>
      <div className="w-full h-screen bg-gray-900 dark overflow-hidden relative">
        <header className="pointer-events-none fixed top-3 inset-x-3 z-30">
          <div className="pointer-events-auto mx-auto w-[min(92vw,1120px)] rounded-2xl border border-slate-800/70 bg-black/30 backdrop-blur-md ring-1 ring-inset ring-white/10 shadow-xl px-5 py-3">
            {/* Mobile: Centered logo */}
            <div className="flex justify-center sm:hidden">
              <LogoIcon className="h-10 w-auto object-contain" />
            </div>
            
            {/* Desktop: Three column layout */}
            <div className="hidden sm:grid grid-cols-[auto_1fr_auto] items-center gap-4">
              <LogoIcon className="h-10 w-auto object-contain" />
              
              {/* Project Name */}
              <div className="flex justify-center">
                {projectInfo?.name && (
                  <div className="text-sm font-medium text-slate-200 text-center truncate max-w-md">
                    {projectInfo.name}
                  </div>
                )}
              </div>
              
              {/* User Menu */}
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                  aria-haspopup="dialog"
                  aria-expanded={menuOpen}
                >
                  <span className="max-w-[110px] truncate sm:max-w-[160px]">
                    {userInfo?.name || 'Kullanıcı'}
                  </span>
                  <span className={`text-slate-300 transition-transform ${menuOpen ? 'rotate-180' : ''}`}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl ring-1 ring-white/15 z-50">
                    <div className="px-4 py-3 border-b border-white/5">
                      <p className="text-sm font-semibold text-white">
                        {userInfo?.name || 'Kullanıcı'}
                      </p>
                      {userInfo?.phone && (
                        <p className="mt-1 text-xs text-slate-400">{userInfo.phone}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-400">
                        {projectInfo?.name
                          ? `Aktif Proje: ${projectInfo.name}`
                          : currentProjectId
                            ? `Aktif Proje ID: ${currentProjectId}`
                            : 'Aktif proje bilgisi yükleniyor...'}
                      </p>
                    </div>

                    <div className="max-h-60 overflow-y-auto py-2">
                      {userProjects === null ? (
                        <div className="px-4 py-3 text-xs text-slate-400">
                          Proje listeniz yükleniyor...
                        </div>
                      ) : otherProjects.length > 0 ? (
                        otherProjects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => handleProjectNavigate(project.id)}
                            className="w-full px-4 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/60"
                          >
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 text-lg">📁</span>
                              <span className="flex-1 min-w-0">
                                <span className="block font-medium truncate">
                                  {project.project_name || project.name || `Proje ${project.id}`}
                                </span>
                                {project.project_code && (
                                  <span className="block text-xs text-slate-400 truncate">
                                    {project.project_code}
                                  </span>
                                )}
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-xs text-slate-400">
                          Başka atandığınız proje bulunmuyor.
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/5 bg-white/5 px-4 py-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleProfileClick}
                        className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                      >
                        Profili Görüntüle
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full rounded-lg bg-red-500/80 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
                      >
                        Çıkış Yap
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="relative w-full h-full">
          <CesiumViewer projectId={Number(projectId) || 1} />
          <CardContainer projectId={Number(projectId) || 1} />
        </main>
      </div>
    </CesiumProvider>
  );
}
