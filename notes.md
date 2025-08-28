# Instructions for Authentication Implementation

Bu doküman, projede görev alacak **Developer**, **QA**, ve **DevOps** ajanları için detaylı talimatları içerir. Her ajan kendi bölümünü takip etmelidir.

---

## 👨‍💻 Developer Ajan Talimatları

1. **Branch Strategy**
   - `feature/authentication-system` branch’inde çalışın
   - Her modül için küçük PR’lar açın (max ~400 LOC)
2. **Coding Standards**
   - ES2022 syntax, Prettier kuralları
   - Error handling: `try/catch` + `next(err)` patterni
3. **Backend**
   - Express route’ları `routes/` dizininde gruplayın
   - Middleware’leri `middleware/` dizininde tutun (`authenticateToken`, `checkProjectAccess`)
   - `services/` katmanında business logic, `models/` katmanında DB erişimi
4. **Database**
   - Migration scriptleri `db/migrations/` altında, knex.js kullanılabilir
   - Seed scriptleri `db/seeds/`
5. **Logging**
   - `user_logs` insert işlemi `logService.logAction(userId, action, details, req)`
6. **Testing**
   - Jest + Supertest: auth ve project route’ları için unit & integration testleri
   - Coverage ≥ 80%
7. **Commit mesaj formatı**
   - `feat(auth): add login endpoint`
   - `fix(auth): rate limit bug`

## 🧪 QA Ajan Talimatları

1. **Test Planı**
   - `authentication.md` ve `authentication-todo.md`’deki test senaryolarını referans alın
2. **Manual Testing**
   - Postman koleksiyonu oluşturun
   - Her endpoint için success & failure case test edin
3. **Automated Testing**
   - Cypress ile frontend e2e: login, logout, unauthorized, admin flows
4. **Bug Tracking**
   - Jira ticket formatı: `[AUTH] <short description>`
5. **Regression**
   - Mevcut model/asset endpoints’in auth eklenince kırılmadığını kontrol edin

## ⚙️ DevOps Ajan Talimatları

1. **CI/CD Pipeline**
   - GitHub Actions: `npm ci`, `npm run lint`, `npm test`, `docker build`
2. **Environment Variables**
   - `JWT_SECRET`, `PORT`, `DATABASE_PATH`, `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX`
3. **Docker**
   - Çok aşamalı build: node:18-alpine → production image
4. **Deploy**
   - Staging & Production environment ayrımı (Heroku, Render, AWS veya tercih edilen provider)
   - Sqlite yedeklemesi için volume mount veya dışa aktarma
5. **Monitoring**
   - `morgan` combined log format → Log aggregator (Datadog, ELK)
   - 5xx error alarmı (>5/5min)
6. **Backup Strategy**
   - Günlük sqlite dump → S3 bucket
   - Retention: 7 gün

---

**Tüm ajanlar**, görevler tamamlandıkça `authentication-todo.md` dosyasındaki checkbox’ları güncelleyin ve PR referansı ekleyin. Herhangi bir belirsizlikte proje yöneticisine danışın.
# Instructions for Authentication Implementation

Bu doküman, projede görev alacak **Developer**, **QA**, ve **DevOps** ajanları için detaylı talimatları içerir. Her ajan kendi bölümünü takip etmelidir.

---

## 👨‍💻 Developer Ajan Talimatları

1. **Branch Strategy**
   - `feature/authentication-system` branch’inde çalışın
   - Her modül için küçük PR’lar açın (max ~400 LOC)
2. **Coding Standards**
   - ES2022 syntax, Prettier kuralları
   - Error handling: `try/catch` + `next(err)` patterni
3. **Backend**
   - Express route’ları `routes/` dizininde gruplayın
   - Middleware’leri `middleware/` dizininde tutun (`authenticateToken`, `checkProjectAccess`)
   - `services/` katmanında business logic, `models/` katmanında DB erişimi
4. **Database**
   - Migration scriptleri `db/migrations/` altında, knex.js kullanılabilir
   - Seed scriptleri `db/seeds/`
5. **Logging**
   - `user_logs` insert işlemi `logService.logAction(userId, action, details, req)`
6. **Testing**
   - Jest + Supertest: auth ve project route’ları için unit & integration testleri
   - Coverage ≥ 80%
7. **Commit mesaj formatı**
   - `feat(auth): add login endpoint`
   - `fix(auth): rate limit bug`

## 🧪 QA Ajan Talimatları

1. **Test Planı**
   - `authentication.md` ve `authentication-todo.md`’deki test senaryolarını referans alın
2. **Manual Testing**
   - Postman koleksiyonu oluşturun
   - Her endpoint için success & failure case test edin
3. **Automated Testing**
   - Cypress ile frontend e2e: login, logout, unauthorized, admin flows
4. **Bug Tracking**
   - Jira ticket formatı: `[AUTH] <short description>`
5. **Regression**
   - Mevcut model/asset endpoints’in auth eklenince kırılmadığını kontrol edin

## ⚙️ DevOps Ajan Talimatları

1. **CI/CD Pipeline**
   - GitHub Actions: `npm ci`, `npm run lint`, `npm test`, `docker build`
2. **Environment Variables**
   - `JWT_SECRET`, `PORT`, `DATABASE_PATH`, `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX`
3. **Docker**
   - Çok aşamalı build: node:18-alpine → production image
4. **Deploy**
   - Staging & Production environment ayrımı (Heroku, Render, AWS veya tercih edilen provider)
   - Sqlite yedeklemesi için volume mount veya dışa aktarma
5. **Monitoring**
   - `morgan` combined log format → Log aggregator (Datadog, ELK)
   - 5xx error alarmı (>5/5min)
6. **Backup Strategy**
   - Günlük sqlite dump → S3 bucket
   - Retention: 7 gün

---

**Tüm ajanlar**, görevler tamamlandıkça `authentication-todo.md` dosyasındaki checkbox’ları güncelleyin ve PR referansı ekleyin. Herhangi bir belirsizlikte proje yöneticisine danışın.
# Authentication Sistemi Tasarım Dokümanı

## 🎯 Sistem Genel Bakış

Bu doküman, sonduzluk projesi için güvenli ve ölçeklenebilir bir authentication sistemi tasarımını içerir. Sistem, kullanıcıların proje bazlı yetkilendirilmesini ve admin kontrolünü sağlar. **Kullanıcılar sadece admin tarafından oluşturulur, self-registration yoktur.**

## 📝 Önemli Notlar

- **Kullanıcı Kaydı**: Sadece admin tarafından yapılır
- **Şifre Politikası**: Admin tarafından belirlenen basit şifreler
- **Token Süresi**: 24 saat (refresh token yok)
- **Logging**: Tüm kullanıcı işlemleri kaydedilir
- **Rate Limiting**: Dakikada 5 login denemesi

## 🏗️ Sistem Mimarisi

### 1. Backend Yapısı
- **Express.js** tabanlı REST API
- **SQLite** veritabanı (production'da PostgreSQL'e geçiş planlanabilir)
- **JWT** tabanlı token sistemi
- **Middleware** tabanlı yetkilendirme
- **bcrypt** ile şifre hashleme

### 2. Frontend Yapısı
- **React** tabanlı SPA
- **Context API** ile state yönetimi
- **Protected Routes** ile sayfa koruması
- **Axios** ile API istekleri
- **LocalStorage** ile token saklama

## 🗄️ Veritabanı Şeması

### Users Tablosu
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user', -- 'admin' veya 'user'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

### User_Logs Tablosu
```sql
CREATE TABLE user_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'login', 'logout', 'project_access', 'admin_action'
    details TEXT, -- JSON formatında detay bilgileri
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Projects Tablosu
```sql
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_code TEXT UNIQUE NOT NULL, -- '400_111' gibi
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### User_Projects Tablosu (Many-to-Many)
```sql
CREATE TABLE user_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    permissions TEXT DEFAULT 'read', -- 'read', 'write', 'admin'
    granted_by INTEGER, -- admin user id
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (granted_by) REFERENCES users(id),
    UNIQUE(user_id, project_id)
);
```

## 🔐 Authentication Flow

### 1. Kullanıcı Girişi
```
Frontend → POST /api/auth/login
Body: { phone: "5551234567", password: "123456" }

Backend → JWT Token + User Info + Project Access List + Logging
Response: {
    success: true,
    token: "jwt_token_here",
    user: { id, name, phone, role },
    projects: [{ id, project_code, name, permissions }],
    expires_in: "24h"
}

Backend → User log kaydı: { action: "login", ip_address: "192.168.1.1", user_agent: "..." }
```

### 2. Token Doğrulama
```
Frontend → Her API isteğinde
Headers: { Authorization: "Bearer jwt_token_here" }

Backend → Middleware ile token doğrulama
- Token geçerli mi?
- Kullanıcı aktif mi?
- İstenen kaynağa erişim yetkisi var mı?
```

## 🛡️ Güvenlik Önlemleri

### 1. Backend Güvenlik
- **Rate Limiting**: Brute force saldırılarına karşı (dakikada 5 login denemesi)
- **Input Validation**: Telefon numarası formatı ve şifre kontrolü
- **SQL Injection Koruması**: Parameterized queries
- **CORS**: Sadece güvenilir domain'lerden erişim
- **Helmet**: HTTP header güvenliği

### 2. Frontend Güvenlik
- **Route Protection**: Yetkisiz sayfa erişimlerinin engellenmesi
- **Token Expiration**: Otomatik logout
- **XSS Koruması**: React'in built-in koruması
- **CSRF Koruması**: JWT token ile

## 🔑 Yetkilendirme Sistemi

### 1. Kullanıcı Rolleri
- **Admin**: Tüm projelere erişim, kullanıcı yönetimi
- **User**: Sadece yetkili olduğu projelere erişim

### 2. Proje Erişim Kontrolü
```javascript
// Middleware örneği
const checkProjectAccess = (projectId) => {
    return async (req, res, next) => {
        const userId = req.user.id;
        const hasAccess = await checkUserProjectAccess(userId, projectId);
        
        if (!hasAccess) {
            return res.status(403).json({ 
                error: 'Bu projeye erişim yetkiniz yok' 
            });
        }
        next();
    };
};
```

## 📱 API Endpoints

### Authentication
- `POST /api/auth/login` - Kullanıcı girişi
- `POST /api/auth/logout` - Çıkış
- `GET /api/auth/me` - Mevcut kullanıcı bilgileri

### Projects
- `GET /api/projects` - Kullanıcının erişebileceği projeler
- `GET /api/projects/:id` - Proje detayları
- `POST /api/projects` - Yeni proje oluşturma (Admin only)
- `PUT /api/projects/:id` - Proje güncelleme (Admin only)

### Admin
- `GET /api/admin/projects/:id/users` - Proje kullanıcıları
- `POST /api/admin/projects/:id/users` - Kullanıcı yetki verme
- `DELETE /api/admin/projects/:id/users/:userId` - Kullanıcı yetki kaldırma

## 🎨 Frontend Bileşenleri

### 1. Login Component
- Telefon numarası ve şifre girişi
- Form validation
- Error handling
- Loading states

### 2. Protected Route Component
```javascript
const ProtectedRoute = ({ children, requiredRole, requiredProject }) => {
    const { user, isAuthenticated } = useAuth();
    
    if (!isAuthenticated) {
        return <Navigate to="/login" />;
    }
    
    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to="/unauthorized" />;
    }
    
    if (requiredProject && !user.projects.includes(requiredProject)) {
        return <Navigate to="/unauthorized" />;
    }
    
    return children;
};
```

### 3. Admin Panel Component
- Proje listesi
- Kullanıcı yetki yönetimi
- Proje ekleme/düzenleme

## 🚀 Implementasyon Adımları

### Phase 1: Backend Temelleri
1. Veritabanı şeması oluşturma (users, projects, user_projects, user_logs)
2. User authentication endpoints (login, logout, me)
3. JWT middleware (24 saat geçerli)
4. Basic security middleware (rate limiting, input validation)
5. User logging sistemi

### Phase 2: Frontend Authentication
1. Login component güncelleme
2. Auth context oluşturma
3. Protected routes
4. Token management

### Phase 3: Proje Yetkilendirme
1. Project endpoints
2. User-project relationships
3. Access control middleware
4. Admin panel

### Phase 4: Güvenlik ve Test
1. Rate limiting
2. Input validation
3. Error handling
4. Testing

## 🔍 Test Senaryoları

### 1. Authentication Testleri
- Geçerli kullanıcı girişi
- Geçersiz kullanıcı girişi
- Token expiration (24 saat sonra)
- Logout functionality
- Rate limiting (5 deneme sonrası blok)
- User logging kontrolü

### 2. Authorization Testleri
- Yetkili kullanıcı proje erişimi
- Yetkisiz kullanıcı proje erişimi
- Admin yetkileri
- Proje bazlı erişim kontrolü

## 📋 Gereksinimler ve Bağımlılıklar

### Backend Dependencies
```json
{
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "express-rate-limit": "^6.0.0",
    "helmet": "^7.0.0",
    "express-validator": "^7.0.0"
}
```

### Frontend Dependencies
```json
{
    "axios": "^1.4.0"
}
```

## ❓ Açık Sorular

1. **JWT Token Expiration**: Token'lar 24 saat geçerli olacak
2. **Refresh Token**: Refresh token sistemi olmayacak
3. **Password Policy**: Şifre karmaşıklık kuralları yok (admin tarafından belirlenecek)
4. **Session Management**: Aynı kullanıcıdan birden fazla cihaz girişi olabilir
5. **Audit Log**: Kullanıcı işlemleri loglanacak
6. **Backup Strategy**: Veritabanı yedekleme stratejisi belirlenecek

## 🎯 Sonraki Adımlar

1. ✅ Bu dokümanı gözden geçirin ve onaylayın
2. ✅ Veritabanı şemasını onaylayın (users, projects, user_projects, user_logs)
3. ✅ API endpoint'lerini detaylandırın
4. ✅ Frontend component'lerini tasarlayın
5. ✅ Güvenlik test planını oluşturun
6. ✅ Implementasyon sırasını belirleyin

## 🚀 Hemen Başlayabiliriz!

Tüm gereksinimler netleşti. Şimdi implementasyona geçebiliriz:
1. **Backend dependencies ekleme**
2. **Veritabanı şeması oluşturma**
3. **Auth middleware'leri yazma**
4. **Login endpoint'i implementasyonu**

Hangi adımdan başlamak istersiniz?

---

**Not**: Bu doküman, sistemin genel çerçevesini çizer. Implementasyon sırasında detaylar güncellenebilir ve iyileştirilebilir.


917_68 küçüksu 
görüş hattı analizi
PUT http://localhost:3001/api/projects/2/settings
{
  "home_camera_view": "{\"destination\":{\"lon\":29.0123,\"lat\":41.0210,\"height\":220},\"orientation\":{\"headingDeg\":95,\"pitchDeg\":-28,\"roll\":0}}",
  "panel_camera_view": "{\"destination\":{\"lon\":29.013,\"lat\":41.022,\"height\":200},\"orientation\":{\"headingDeg\":170,\"pitchDeg\":-32,\"roll\":0}}",
  "corner_camera_view": "{\"destination\":{\"lon\":29.0145,\"lat\":41.019,\"height\":180},\"orientation\":{\"headingDeg\":300,\"pitchDeg\":-25,\"roll\":0}}"
}

