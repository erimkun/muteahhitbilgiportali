# Üretime Hazırlık Rehberi

Bu doküman, uygulamanın production ortamına alınmadan önce yapılması gereken kontrolleri, eksiklikleri ve dikkat edilmesi gereken önemli noktaları içermektedir. Aşağıdaki maddeleri proje dosyaları incelendiğinde elde edilen bilgiler doğrultusunda hazırladım.

## Genel Kontroller

- **Kod Kalitesi:**
  - Kod formatlaması, yorumlar ve dokümantasyon düzenli mi?
  - Codacy üzerinden yapılan analizlerde tespit edilen hatalar, uyarılar ve güvenlik açıkları gözden geçirilmeli, düzeltilmelidir.

- **Güvenlik:**
  - Veritabanı ve API bağlantılarında uygun güvenlik önlemleri alınmış mı? (SQL injection, XSS, CSRF vs.)
  - Dosya ve dizin izinleri kontrol edilmeli.
  - Hata mesajları ve debug bilgileri production ortamında gösterilmemeli.
  - Ortam değişkenleri (environment variables) kullanılmalı; `config/env.js` dosyasındaki ayarlar production için uygun şekilde yapılandırılmalıdır.
  - Rate limiting ve istek doğrulama (middlewares olarak `advancedRateLimit.js`, `rateLimiter.js`, `requestValidation.js`) gibi güvenlik önlemleri aktif olduğu kontrol edilmeli.

## Backend Hazırlıkları

- **Veritabanı:**
  - `db.sqlite` gibi dosya tabanlı veritabanı kullanılıyorsa, üretim ortamında ölçeklenebilir bir veritabanı tercih edilmeli (örn. PostgreSQL, MySQL).
  - Veritabanı yedekleme ve restore süreçleri değerlendirilmelidir.
  - **Default Admin Kullanıcısı:** İlk kurulumda otomatik olarak şu admin kullanıcısı oluşturulur:
    - Telefon: `05326225500`
    - Şifre: `admin123`
    - Rol: `superadmin`
    - **ÖNEMLİ:** Bu şifreyi production ortamında ilk girişten sonra mutlaka değiştirin!

- **API ve Controller:**
  - Tüm API uç noktaları (örn. `authController.js`, `userController.js`, `projectController.js`) test edilmeli ve olası hatalar için gerekli hata yönetimi (errorHandler.js) yapılmalıdır.
  - Legacy dosyalar (`legacy/` klasörü) üretim kodlarıyla karışmış olabilir; gereksiz veya eski dosyalar temizlenmelidir.

- **Ortam Ayarları:**
  - **Backend:** `.env.production` dosyası oluşturuldu - şu değerleri mutlaka güncelleyin:
    - `SESSION_SECRET` - Güçlü rastgele secret oluşturun
    - `COOKIE_DOMAIN` - Domain adınızı yazın
    - `CORS_ORIGIN` - Frontend URL'inizi yazın  
    - `API_BASE_URL` - Backend API URL'inizi yazın
    - `ADMIN_PHONE` - Default telefon numarasını değiştirin
    - `ADMIN_PASSWORD` - Default şifreyi değiştirin
    - `SMS_API_*` - Production SMS API bilgilerini yazın
    - `SMS_TEST_MODE=false` - Test modu kapatın
  - **Frontend:** `.env.production` dosyası oluşturuldu - şu değerleri güncelleyin:
    - `VITE_API_BASE_URL` - Backend API URL'inizi yazın
    - `VITE_CESIUM_ION_TOKEN` - Cesium Ion token'ınızı yazın
  - Gizli anahtarlar ve API tokenları güvenli bir şekilde saklanmalı.

## Frontend Hazırlıkları

- **Build ve Optimizasyon:**
  - Vite yapılandırması (`vite.config.js`) production build moduna uygun şekilde optimize edilmeli.
  - CSS/JS minification, code splitting ve lazy-loading gibi performans artırıcı teknikler uygulanmalı.
  - `index.html` ve diğer statik dosyalar doğru yapılandırılmış mı kontrol edilmeli.

- **Güvenlik:**
  - XSS koruması, içerik güvenliği politikaları (CSP) uygulanmalı.
  - Gerekli üçüncü parti kütüphane ve bağımlılıkların güncel ve güvenli versiyonları kullanılıyor mu kontrol edilmelidir.

## Nginx ile Dağıtım

- **Reverse Proxy:**
  - Nginx, uygulamanın önünde reverse proxy olarak çalıştırılmalı. Uygulama portu ve sunucu konfigürasyonu doğru yönlendirilmeli.

- **SSL/TLS:**
  - HTTPS kullanımını sağlamak için SSL/TLS sertifikaları yüklenmeli. Let’s Encrypt gibi sağlayıcılar kullanılabilir.

- **Cache ve Performans:**
  - Statik dosyalar için cache ayarları yapılmalı.
  - Gzip veya Brotli sıkıştırma etkinleştirilmeli.

- **Güvenlik Başlıkları:**
  - Güvenlik için gerekli HTTP başlıkları (ör. Strict-Transport-Security, X-Content-Type-Options vb.) eklenmeli.

- **Rate Limiting ve Firewall:**
  - Nginx üzerinden ek rate limiting ve IP filtreleme yapılabilir.

## Diğer Dikkat Edilmesi Gerekenler

- **Loglama ve İzleme:**
  - Hata loglarının ve erişim loglarının izlenmesi için uygun araçlar (örn. ELK stack, Prometheus) kurulmalı.

- **Yedekleme:**
  - Veritabanı, dosyalar ve önemli konfigürasyonlar için yedekleme çözümleri uygulanmalı.

- **Test Süreçleri:**
  - Uygulamanın tüm uç noktaları ve işlevleri üretim ortamında test edilmeli, gerekli otomasyon testleri çalıştırılmalıdır.
  - Codacy ve diğer kalite analiz araçları üzerinden düzenli kontroller sağlanmalıdır.

- **Dokümantasyon:**
  - Tüm kurulum, konfigürasyon ve hata giderme adımları dokümante edilmeli.

---

Bu rehber genel öneriler içermektedir. Uygulamanın özel ihtiyaçlarına göre ek önlemler alınması gerekebilir. Lütfen uygulamayı production ortamına almadan önce kapsamlı testler ve güvenlik taramaları yapın.
