import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import KentasLogoWhite from '/KentasLogoWhite.png';
import { createApiUrl } from '../config/api';
import './Login.css';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('credentials'); // 'credentials' or 'otp'
  const [loading, setLoading] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [errors, setErrors] = useState({});
  const [checking, setChecking] = useState(true);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    async function checkExistingSession() {
      try {
        const res = await fetch(createApiUrl('session'), {
          credentials: 'include'
        });
        
        if (res.ok) {
          const data = await res.json();
          // If user is already logged in, redirect to profile
          if (data.success && data.data?.user) {
            navigate('/profile');
            return;
          }
        }
      } catch {
        console.log('No existing session');
      } finally {
        setChecking(false);
      }
    }
    
    checkExistingSession();
  }, [navigate]);

  function validateCredentials() {
    const e = {};
    const digits = phone.replace(/\D/g, '');
    if (!digits) e.phone = 'Telefon numarası gerekli';
    else if (digits.length < 7) e.phone = 'Geçerli bir telefon girin';
    if (!password) e.password = 'Parola gerekli';
    else if (password.length < 6) e.password = 'Parola en az 6 karakter olmalı';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateOTP() {
    const e = {};
    if (!otp || otp.length !== 6) e.otp = '6 haneli doğrulama kodu girin';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmitCredentials(e) {
    e.preventDefault();
    if (!validateCredentials()) return;

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch(createApiUrl('validate-credentials'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, password })
      });

      const js = await res.json();

      if (res.ok) {
        setStep('otp');
        setRemainingTime(300); // 5 minutes
      } else {
        setErrors({ form: js.error || 'Doğrulama başarısız' });
      }
    } catch (err) {
      setErrors({ form: 'Bağlantı hatası: ' + err.message });
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitOTP(e) {
    e.preventDefault();
    if (!validateOTP()) return;

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch(createApiUrl('verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, otp })
      });

      const js = await res.json();

      if (res.ok) {
        // Navigate to profile page after successful login
        navigate('/profile');
      } else {
        setErrors({ form: js.error || 'Doğrulama başarısız' });
      }
    } catch (err) {
      setErrors({ form: 'Bağlantı hatası: ' + err.message });
    } finally {
      setLoading(false);
    }
  }

  // Timer for OTP expiration
  useEffect(() => {
    if (step === 'otp' && remainingTime > 0) {
      const timer = setTimeout(() => {
        setRemainingTime(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (remainingTime === 0 && step === 'otp') {
      setStep('credentials');
      setErrors({ form: 'Doğrulama kodu süresi doldu. Tekrar deneyin.' });
    }
  }, [step, remainingTime]);

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function resetToCredentials() {
    setStep('credentials');
    setOtp('');
    setRemainingTime(0);
    setErrors({});
  }

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

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const vertexShaderSource = `attribute vec2 a_position; void main(){ gl_Position = vec4(a_position,0.0,1.0); }`;

    const fragmentShaderSource = `precision mediump float; uniform float u_time; uniform vec2 u_resolution;

        vec3 aurora(vec2 uv, float time) {
          vec2 p = uv - 0.5;
          p.y += 0.3;

          float wave1 = sin(p.x * 3.0 + time * 0.5) * 0.08;
          float wave2 = sin(p.x * 5.0 + time * 0.7 + sin(time * 0.3) * 2.0) * 0.04;
          float wave3 = sin(p.x * 7.0 + time * 1.1 + cos(time * 0.4) * 1.5) * 0.025;
          float wave4 = sin(p.x * 2.0 + time * 0.3 + sin(time * 0.6) * 3.0) * 0.06;

          float y = p.y - wave1 - wave2 - wave3 - wave4;

          float intensity1 = exp(-abs(y) * 16.0) * 0.375;
          float intensity2 = exp(-abs(y + 0.1) * 24.0) * 0.3;
          float intensity3 = exp(-abs(y - 0.05) * 30.0) * 0.225;

          vec3 color1 = vec3(0.2, 0.8, 0.9) * intensity1;
          vec3 color2 = vec3(0.5, 0.3, 0.9) * intensity2;
          vec3 color3 = vec3(0.1, 0.9, 0.6) * intensity3;

          return color1 + color2 + color3;
        }

        vec3 secondaryAurora(vec2 uv, float time) {
          vec2 p = uv - 0.5;
          p.y += 0.1;

          float wave1 = sin(p.x * 2.0 + time * 0.3 + sin(time * 0.2) * 2.5) * 0.06;
          float wave2 = cos(p.x * 4.0 + time * 0.5 + cos(time * 0.35) * 1.8) * 0.03;
          float y = p.y - wave1 - wave2;

          float intensity = exp(-abs(y) * 12.0) * 0.225;
          return vec3(0.8, 0.2, 0.7) * intensity;
        }

        vec3 tertiaryAurora(vec2 uv, float time) {
          vec2 p = uv - 0.5;
          p.y -= 0.2;

          float wave1 = sin(p.x * 1.5 + time * 0.4 + sin(time * 0.25) * 3.0) * 0.07;
          float wave2 = cos(p.x * 3.5 + time * 0.6 + cos(time * 0.45) * 2.2) * 0.035;
          float y = p.y - wave1 - wave2;

          float intensity = exp(-abs(y) * 18.0) * 0.18;
          return vec3(0.3, 0.9, 0.5) * intensity;
        }

        float noise(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution.xy;

          vec3 color = vec3(0.03, 0.03, 0.075);

          color += aurora(uv, u_time);
          color += secondaryAurora(uv, u_time + 3.0);
          color += tertiaryAurora(uv, u_time + 1.5);

          vec2 starUv = uv * 120.0;
          vec2 starId = floor(starUv);
          vec2 starFract = fract(starUv);

          float star = noise(starId);
          if (star > 0.985) {
            float starBrightness = (sin(u_time * 1.5 + star * 8.0) * 0.3 + 0.4) * 0.75;
            float starDist = length(starFract - 0.5);
            if (starDist < 0.03) {
              color += vec3(0.8, 0.9, 1.0) * (1.0 - starDist * 30.0) * starBrightness;
            }
          }

          float glow = 1.0 - length(uv - 0.5) * 0.6;
          color += vec3(0.075, 0.15, 0.225) * glow * 0.225;

          gl_FragColor = vec4(color, 1.0);
        }
  `;

    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
      if (!ok) {
        const log = gl.getShaderInfoLog(shader);
        console.error('Shader compile failed:', log);
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }


    const vShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vShader || !fShader) {
      console.error('Failed to create shaders', { vShader: !!vShader, fShader: !!fShader });
      return;
    }
    const program = gl.createProgram();
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
      console.error('Program link failed:', gl.getProgramInfoLog(program));
      return;
    }


    const positionLoc = gl.getAttribLocation(program, 'a_position');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const resLoc = gl.getUniformLocation(program, 'u_resolution');

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    let rafId = null;
    function render(time) {
      time *= 0.001;
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.enableVertexAttribArray(positionLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(timeLoc, time);
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafId = requestAnimationFrame(render);
    }
    rafId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (rafId) cancelAnimationFrame(rafId);
      try { if (vShader) gl.deleteShader(vShader); if (fShader) gl.deleteShader(fShader); if (program) gl.deleteProgram(program); } catch {
        // WebGL cleanup errors are expected during page unload
      }
    };
  }, []);

  // Show loading while checking existing session
  if (checking) {
    return (
      <div className="relative min-h-screen text-white overflow-hidden font-geist">
        <canvas
          ref={canvasRef}
          id="aurora-canvas"
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -10, pointerEvents: 'none' }}
        />
        <div className="fixed inset-0 flex items-center justify-center z-10">
          <div className="card-border rounded-2xl p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-white">Kontrol ediliyor...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-white overflow-hidden font-geist">
      <canvas
        ref={canvasRef}
        id="aurora-canvas"
        // explicit inline style to avoid Tailwind config/z-index edge cases
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -10, pointerEvents: 'none' }}
      />

      <div className="fixed inset-0 flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-sm">       

          <div className="relative card-border overflow-hidden rounded-2xl flex flex-col animate-float bg-black/20">
            <div className="p-6 pb-0 flex justify-center relative">
              <div className="w-full h-32 rounded-xl gradient-border overflow-hidden relative animate-login-pulse">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="flex flex-col items-center mb-0">
                      <img src={KentasLogoWhite} alt="Kentaş" className="h-20 w-auto" />
                    </div>
                  </div>
                </div>
                
              </div>
            </div>

            <div className="p-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Müteahhit Bilgi Portalı'na Hoşgeldiniz</h3>
                <p className="text-white/60 text-sm">
                  {step === 'credentials' ? 'Hesabınıza telefon ve parola ile erişin' : 'SMS ile gönderilen doğrulama kodunu girin'}
                </p>
              </div>

              {step === 'credentials' && (
                <form onSubmit={onSubmitCredentials} className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-white/80 mb-2">Telefon numarası</label>
                  <div className="relative">
                    <input
                      id="login-phone"
                      name="username"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="örn. 05xx xxx xxxx"
                      className={`input-field w-full px-4 py-3 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-0 ${errors.phone ? 'border-red-500' : ''}`}
                      aria-invalid={errors.phone ? 'true' : 'false'}
                      aria-label="Telefon numarası"
                      autoComplete="username"
                      onFocus={e => e.currentTarget.classList.add('animate-field-glow')}
                      onBlur={e => e.currentTarget.classList.remove('animate-field-glow')}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <svg className="w-4 h-4 text-white/40" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </div>
                  </div>
                  {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-white/80 mb-2">Parola</label>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Parolanızı girin"
                      className={`input-field w-full px-4 py-3 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-0 ${errors.password ? 'border-red-500' : ''}`}
                      aria-invalid={errors.password ? 'true' : 'false'}
                      aria-label="Parola"
                      autoComplete="current-password"
                      onFocus={e => e.currentTarget.classList.add('animate-field-glow')}
                      onBlur={e => e.currentTarget.classList.remove('animate-field-glow')}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <svg className="w-4 h-4 text-white/40" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
                </div>

                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center">
                      <input type="checkbox" className="sr-only" />
                      <div className="w-4 h-4 border-2 border-indigo-400/50 rounded glass flex items-center justify-center">
                        <svg className="w-3 h-3 text-indigo-400 hidden" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="ml-2 text-white/60">Beni hatırla</span>
                    </label>
                    <a href="#" className="text-indigo-400 hover:text-indigo-300 transition">Şifremi unuttum?</a>
                  </div>

                  {errors.form && <p className="text-xs text-red-400">{errors.form}</p>}
                  <button type="submit" disabled={loading} className="w-full login-button text-white font-medium py-3 px-4 rounded-lg transition hover:shadow-lg hover:shadow-purple-500/25 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50">
                    {loading ? 'Doğrulanıyor...' : 'SMS Gönder'}
                  </button>
                </form>
              )}

              {step === 'otp' && (
                <form onSubmit={onSubmitOTP} className="space-y-4">
                  <div className="text-center mb-4">
                    <p className="text-white/80 text-sm mb-2">SMS kodunu telefonunuza gönderdik</p>
                    <p className="text-indigo-400 font-mono text-lg">{formatTime(remainingTime)}</p>
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium text-white/80 mb-2">Doğrulama Kodu</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className={`input-field w-full px-4 py-3 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-0 text-center text-2xl font-mono tracking-widest ${errors.otp ? 'border-red-500' : ''}`}
                        maxLength="6"
                        autoComplete="one-time-code"
                        onFocus={e => e.currentTarget.classList.add('animate-field-glow')}
                        onBlur={e => e.currentTarget.classList.remove('animate-field-glow')}
                      />
                    </div>
                    {errors.otp && <p className="mt-1 text-xs text-red-400">{errors.otp}</p>}
                  </div>

                  {errors.form && <p className="text-xs text-red-400">{errors.form}</p>}

                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={resetToCredentials}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition"
                    >
                      Geri
                    </button>
                    <button
                      type="submit"
                      disabled={loading || remainingTime === 0}
                      className="flex-1 login-button text-white font-medium py-3 px-4 rounded-lg transition hover:shadow-lg hover:shadow-purple-500/25 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    >
                      {loading ? 'Doğrulanıyor...' : 'Giriş Yap'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
