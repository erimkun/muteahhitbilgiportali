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
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
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
    <div className="min-h-screen bg-slate-900 text-white">
      <canvas ref={canvasRef} className="aurora-canvas" />
      
      {/* Header */}
      <div className="relative z-12 p-8">
        <div className="relative flex items-center justify-between">
          <img src={KentasLogoWhite} alt="Kentas Logo" className="h-12 w-auto" />
          <h1 className="absolute left-1/2 -translate-x-1/2 text-2xl font-bold pointer-events-none select-none">
            Müteahhit Bilgi Portalı
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="card-border rounded-2xl p-8 mb-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold leading-tight inline-block mb-6 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Hoşgeldiniz, {user?.name || 'Kullanıcı'}!
            </h2>
            <p className="text-lg text-gray-300 mb-2">
              📱 Telefon: {user?.phone}
            </p>
            {(user?.role === 'admin' || user?.role === 'superadmin') && (
              <p className="text-lg text-yellow-400">
                👑 {user.role === 'superadmin' ? 'Süper Yönetici' : 'Yönetici'}
              </p>
            )}
          </div>
        </div>

        {/* Projects Section */}
        <div className="card-border rounded-2xl p-8">
          <h3 className="text-2xl font-bold mb-6 text-center">
            📁 Projeleriniz ({userProjects.length})
          </h3>
          
          {userProjects.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📂</div>
              <p className="text-gray-400 text-lg">Henüz size atanmış proje bulunmamaktadır.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {userProjects.map((project) => (
                <div
                  key={project.id}
                  className="gradient-border rounded-xl p-6 cursor-pointer transition-colors duration-200 hover:bg-gray-800/20"
                  onClick={() => handleProjectClick(project.id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xl font-semibold text-white">
                      {project.project_name || project.name || `Proje ${project.id}`}
                    </h4>
                    <div className="text-2xl">🏗️</div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-300 mb-4">
                    <p className="text-gray-300 leading-relaxed">
                      <span className="font-medium text-gray-200">Bilgi:</span> {project.description || 'Açıklama bulunmuyor.'}
                    </p>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-2 px-4 rounded-lg font-medium transition-colors duration-200">
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