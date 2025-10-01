import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import KentasLogoWhite from '/KentasLogoWhite.png';
import { createApiUrl } from '../config/api';
import './Login.css'; // Aynı CSS'i kullanacağız

export default function Profile() {
  const [user, setUser] = useState(null);
  const [userProjects, setUserProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  // Aurora background effect (Login sayfasından kopyalandı)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Shader sources
    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_resolution;
      
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      
      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        float time = u_time * 0.5;
        
        vec3 color1 = vec3(0.2, 0.1, 0.8);
        vec3 color2 = vec3(0.8, 0.2, 0.6);
        vec3 color3 = vec3(0.1, 0.8, 0.8);
        
        float wave1 = sin(uv.x * 3.0 + time) * 0.5 + 0.5;
        float wave2 = sin(uv.y * 2.0 + time * 1.2) * 0.5 + 0.5;
        float wave3 = sin((uv.x + uv.y) * 2.5 + time * 0.8) * 0.5 + 0.5;
        
        vec3 color = mix(color1, color2, wave1);
        color = mix(color, color3, wave2 * wave3);
        
        gl_FragColor = vec4(color * 0.3, 1.0);
      }
    `;

    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program));
      return;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const timeUniformLocation = gl.getUniformLocation(program, 'u_time');
    const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');

    function render(time) {
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionAttributeLocation);
      gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(timeUniformLocation, time * 0.001);
      gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Load user session and projects - authentication already verified by ProtectedRoute
  useEffect(() => {
    async function loadUserData() {
      try {
        setLoading(true);
        
        // Get session data - we can assume user is authenticated at this point
        const sessionRes = await fetch(createApiUrl('session'), {
          credentials: 'include'
        });
        
        if (!sessionRes.ok) {
          // ProtectedRoute should have caught this, but handle gracefully
          console.error('Unexpected session failure in Profile component');
          navigate('/login');
          return;
        }
        
        const sessionData = await sessionRes.json();
        
        // Handle both user and admin sessions
        let userData;
        if (sessionData.data?.user) {
          userData = sessionData.data.user;
        } else if (sessionData.data?.admin) {
          userData = { ...sessionData.data.admin, role: 'admin' };
        } else {
          console.error('No valid user/admin data in session');
          navigate('/login');
          return;
        }

        setUser(userData);
        
        // Load projects based on user role
        let projectsRes;
        if (userData.role === 'admin' || userData.role === 'superadmin') {
          // Admin users can see all projects
          projectsRes = await fetch(createApiUrl('admin/projects'), {
            credentials: 'include'
          });
        } else {
          // Regular users see only assigned projects
          projectsRes = await fetch(createApiUrl('user/projects'), {
            credentials: 'include'
          });
        }
        
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          const projects = projectsData.data || [];
          setUserProjects(Array.isArray(projects) ? projects : []);
        } else {
          console.log('Failed to fetch user projects:', projectsRes.status);
          setUserProjects([]);
        }
        
      } catch (error) {
        console.error('Error loading user data:', error);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    }
    
    loadUserData();
  }, [navigate]);

  const handleProjectClick = (projectId) => {
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      navigate(`/admin/${projectId}`);
    } else {
      navigate(`/app/${projectId}`);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(createApiUrl('logout'), {
        method: 'POST',
        credentials: 'include'
      });
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <canvas ref={canvasRef} className="aurora-canvas" />
        <div className="card-border rounded-2xl p-8">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p>Yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 text-white">
      <canvas ref={canvasRef} className="aurora-canvas" />
      
      {/* Header */}
      <div className="relative z-12 p-4 sm:p-8">
        <div className="relative flex items-center justify-between">
          <img src={KentasLogoWhite} alt="Kentas Logo" className="h-8 sm:h-12 w-auto" />
          <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-2xl font-bold pointer-events-none select-none text-center">
            <span className="hidden sm:inline">Müteahhit Bilgi Portalı</span>
            <span className="sm:hidden">Portal</span>
          </h1>
          <button
            onClick={handleLogout}
            className="px-3 py-2 sm:px-4 sm:py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200 text-sm sm:text-base"
          >
            Çıkış
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-4 sm:py-8 pb-20 min-h-screen">
        {/* Welcome Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* User Info with Logo */}
          <div className="card-border rounded-2xl p-6 sm:p-8">
            <div className="flex items-start gap-4 sm:gap-6">
              {/* Logo Section - Sol tarafta sabit */}
              <div className="flex-shrink-0">
                {user?.logo_url ? (
                  <img
                    src={createApiUrl(`uploads/${user.logo_url}`)}
                    alt="Firma Logosu"
                    className="w-24 h-24 sm:w-32 sm:h-32 lg:w-48 lg:h-48 object-contain rounded-lg border border-gray-600 bg-white/5 p-2"
                    onError={(e) => {
                      console.log('Logo URL hatası:', e.target.src);
                      console.log('user.logo_url:', user.logo_url);
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-32 sm:h-32 lg:w-48 lg:h-48 flex items-center justify-center bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="text-3xl sm:text-5xl lg:text-8xl text-gray-400">🏢</div>
                  </div>
                )}
                {user?.logo_url && (
                  <div style={{display: 'none'}} className="w-24 h-24 sm:w-32 sm:h-32 lg:w-48 lg:h-48 flex items-center justify-center bg-gray-700/50 rounded-lg border border-gray-600">
                    <div className="text-3xl sm:text-5xl lg:text-8xl text-gray-400">🏢</div>
                  </div>
                )}
              </div>
              
              {/* User Info - Sağ tarafta wrap */}
              <div className="flex-1 min-w-0">
                {/* Hoşgeldiniz ve kullanıcı bilgileri */}
                <div className="mb-4">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-tight mb-3 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Hoşgeldiniz, {user?.name || 'Kullanıcı'}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-300 mb-2">
                    📱 {user?.phone}
                  </p>
                  
                </div>
                
                {/* Açıklama metni */}
                <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                    <span className="font-medium text-white">Portal</span>'da projelerinize ait 
                    <span className="text-blue-400"> 3D modeller</span>, 
                    <span className="text-green-400"> drone fotoğrafları</span>, 
                    <span className="text-purple-400"> 360° görüntüler</span>, 
                    <span className="text-orange-400"> kat planları</span> ve 
                    <span className="text-cyan-400"> belgeler</span> bulunur.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Project Statistics */}
          <div className="card-border rounded-2xl p-6 sm:p-8">
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-bold mb-4">
                <span className="text-xl sm:text-2xl mr-2">📊</span>
                <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                  İstatistikler
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-2 sm:p-3 rounded-lg border border-blue-500/30">
                  <div className="text-lg sm:text-2xl font-bold text-blue-400">
                    {userProjects.reduce((sum, project) => sum + (parseFloat(project.toplam_insaat_alan) || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-300 mt-1">İnşaat Alanı (m²)</div>
                </div>
                <div className="bg-gradient-to-br from-green-500/20 to-teal-500/20 p-2 sm:p-3 rounded-lg border border-green-500/30">
                  <div className="text-lg sm:text-2xl font-bold text-green-400">
                    {userProjects.reduce((sum, project) => sum + (parseFloat(project.parsel_alan) || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-300 mt-1">Parsel Alanı (m²)</div>
                </div>
                <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 p-2 sm:p-3 rounded-lg border border-orange-500/30">
                  <div className="text-lg sm:text-2xl font-bold text-orange-400">
                    {userProjects.reduce((sum, project) => sum + (parseInt(project.bina_sayisi) || 0), 0)}
                  </div>
                  <div className="text-xs text-gray-300 mt-1">Bina Sayısı</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-2 sm:p-3 rounded-lg border border-purple-500/30">
                  <div className="text-lg sm:text-2xl font-bold text-purple-400">
                    {userProjects.reduce((sum, project) => sum + (parseInt(project.bagimsiz_birim_sayi) || 0), 0)}
                  </div>
                  <div className="text-xs text-gray-300 mt-1">Bağımsız Birim</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div className="card-border rounded-2xl p-6 sm:p-8">
          <h3 className="text-xl sm:text-2xl font-bold mb-6 text-center">
            📁 Projeleriniz ({userProjects.length})
          </h3>
          
          {userProjects.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <div className="text-4xl sm:text-6xl mb-4">📂</div>
              <p className="text-gray-400 text-base sm:text-lg">Henüz size atanmış proje bulunmamaktadır.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {userProjects.map((project) => (
                <div
                  key={project.id}
                  className="gradient-border rounded-xl p-4 sm:p-6 cursor-pointer transition-colors duration-200 hover:bg-gray-800/20"
                  onClick={() => handleProjectClick(project.id)}
                >
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h4 className="text-lg sm:text-xl font-semibold text-white">
                      {project.project_name || project.name || `Proje ${project.id}`}
                    </h4>
                    <div className="text-xl sm:text-2xl">🏗️</div>
                  </div>
                  
                  <div className="space-y-2 text-xs sm:text-sm text-gray-300 mb-3 sm:mb-4">
                    <p className="text-gray-300 leading-relaxed">
                      <span className="font-medium text-gray-200">Bilgi:</span> {project.description || 'Açıklama bulunmuyor.'}
                    </p>
                    
                    {/* Proje İstatistikleri */}
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                      {project.toplam_insaat_alan && (
                        <p>
                          <span className="font-medium text-gray-200">İnşaat:</span> {project.toplam_insaat_alan} m²
                        </p>
                      )}
                      {project.parsel_alan && (
                        <p>
                          <span className="font-medium text-gray-200">Parsel:</span> {project.parsel_alan} m²
                        </p>
                      )}
                      {project.bina_sayisi && (
                        <p>
                          <span className="font-medium text-gray-200">Bina:</span> {project.bina_sayisi}
                        </p>
                      )}
                      {project.bagimsiz_birim_sayi && (
                        <p>
                          <span className="font-medium text-gray-200">Birim:</span> {project.bagimsiz_birim_sayi}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-600">
                    <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-2 px-4 rounded-lg font-medium transition-colors duration-200 text-xs sm:text-sm">
                      Projeyi Görüntüle →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}