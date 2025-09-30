# Production Temizlik Rehberi

Bu doküman production'a geçmeden önce silinmesi gereken dosya ve klasörleri listeler.

## Silinecek Klasörler ve Dosyalar

### Frontend (c:/path/to/frontend/)
```
# Demo proje dosyalarını sil
public/400_111_project/          # Demo proje 1
public/917_68_project/           # Demo proje 2  
public/1094_5_project/           # Demo proje 3

# Geliştirme dosyaları (opsiyonel)
node_modules/                    # Tekrar npm install ile oluşur
.env                            # Geliştirme ortamı değişkenleri
```

### Backend (c:/path/to/backend/)
```
# Legacy ve debug dosyaları
legacy/                         # Tüm legacy scripsleri sil
scripts/                        # Development scripsleri sil
security-scripts/               # Test güvenlik scriptleri sil

# Geliştirme ve test dosyaları
__tests__/                      # Jest test dosyaları sil
check_db_columns.js             # Debug scripti sil
HOW_TO_IMPROVE.md              # Geliştirme notları sil

# Demo veritabanı ve uploads
db.sqlite                       # Demo veritabanı sil (production'da yeni oluşur)
uploads/projects/               # Demo upload dosyaları sil
uploads/projects_backup_*/      # Backup klasörleri sil

# Development dosyaları
.env                           # Geliştirme ortamı değişkenleri sil
node_modules/                  # Tekrar npm install ile oluşur

# Development config dosyaları (opsiyonel)
.env.example                   # Geliştirme örneği (silebilirsin)
jest.config.js                 # Test konfigürasyonu (test yoksa sil)
```

### Kök dizin (c:/path/to/project/)
```
# Development notları
notes.md                       # Geliştirme notları
clip.md                        # Geliştirme notları
instructions-auth.md           # Auth geliştirme notları

# Geliştirme dosyaları
.vscode/                       # VS Code ayarları (opsiyonel)
.git/                         # Git history (opsiyonel - deploy metoduna bağlı)
```

## Korunacak Dosyalar

### Frontend
```
✅ src/                        # Kaynak kodlar
✅ package.json               # Bağımlılıklar
✅ vite.config.js            # Build konfigürasyonu
✅ tailwind.config.js        # Stil konfigürasyonu
✅ index.html               # Ana HTML
✅ .env.example             # Production env örneği
✅ public/favicon.ico       # Site ikonu
✅ public/KentasLogoWhite.png # Logo
```

### Backend
```
✅ controllers/              # API kontrolcüleri
✅ middlewares/             # Güvenlik middleware'leri
✅ routes/                  # API rotaları
✅ services/                # Veritabanı servisleri
✅ utils/                   # Yardımcı fonksiyonlar
✅ validators/              # Giriş doğrulayıcıları
✅ config/                  # Konfigürasyon
✅ public/                  # Admin HTML dosyaları
✅ bin/                     # Production validation scripti
✅ package.json            # Bağımlılıklar
✅ index.js                # Ana uygulama
✅ database.js             # Veritabanı kurulumu
✅ .env.example.production # Production env örneği
✅ README.md               # Kurulum talimatları
```

## Otomatik Temizlik Scripti

PowerShell komutu (Windows):
```powershell
# Frontend temizlik
Remove-Item -Recurse -Force "frontend/public/400_111_project" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "frontend/public/917_68_project" -ErrorAction SilentlyContinue  
Remove-Item -Recurse -Force "frontend/public/1094_5_project" -ErrorAction SilentlyContinue
Remove-Item -Force "frontend/.env" -ErrorAction SilentlyContinue

# Backend temizlik
Remove-Item -Recurse -Force "backend/legacy" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "backend/scripts" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "backend/security-scripts" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "backend/__tests__" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "backend/uploads" -ErrorAction SilentlyContinue
Remove-Item -Force "backend/check_db_columns.js" -ErrorAction SilentlyContinue
Remove-Item -Force "backend/HOW_TO_IMPROVE.md" -ErrorAction SilentlyContinue
Remove-Item -Force "backend/db.sqlite" -ErrorAction SilentlyContinue
Remove-Item -Force "backend/.env" -ErrorAction SilentlyContinue
Remove-Item -Force "backend/jest.config.js" -ErrorAction SilentlyContinue

# Kök dizin temizlik
Remove-Item -Force "notes.md" -ErrorAction SilentlyContinue
Remove-Item -Force "clip.md" -ErrorAction SilentlyContinue
Remove-Item -Force "instructions-auth.md" -ErrorAction SilentlyContinue

Write-Host "Production temizlik tamamlandı!" -ForegroundColor Green
```

## Production Sonrası Yapılacaklar

1. **Environment dosyalarını oluştur:**
   - `frontend/.env` → Production API URL'i ile
   - `backend/.env` → Production ayarları ile

2. **Klasörleri oluştur:**
   - `backend/uploads/` → Boş klasör oluştur

3. **Bağımlılıkları yükle:**
   ```bash
   cd frontend && npm install
   cd backend && npm install
   ```

4. **İlk admin kullanıcısı:** 
   - Telefon: `05326225500`
   - Şifre: `admin123` (değiştirmeyi unutma!)

5. **Build al:**
   ```bash
   cd frontend && npm run build
   ```

---

**UYARI:** Bu temizlik geri alınamaz! Backup aldığından emin ol.