# Production Backup Scripti
# Bu script production'a geçmeden önce tam backup alır

# Backup klasörü ve dosya adı
$backupDate = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFolder = "backup_$backupDate"
$zipFileName = "muteahhitbilgiportali_backup_$backupDate.zip"

Write-Host "💾 Production öncesi backup alınıyor..." -ForegroundColor Yellow
Write-Host "📅 Tarih: $backupDate" -ForegroundColor Gray
Write-Host ""

# Geçici backup klasörü oluştur
Write-Host "📁 Backup klasörü oluşturuluyor: $backupFolder" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null

# Ana proje dosyalarını kopyala
Write-Host "📂 Ana proje dosyaları kopyalanıyor..." -ForegroundColor Cyan

# Frontend backup
Write-Host "  └─ Frontend dosyaları..." -ForegroundColor Gray
Copy-Item -Path "frontend" -Destination "$backupFolder/frontend" -Recurse -Force

# Backend backup
Write-Host "  └─ Backend dosyaları..." -ForegroundColor Gray
Copy-Item -Path "backend" -Destination "$backupFolder/backend" -Recurse -Force

# Kök dizin dosyaları
Write-Host "  └─ Kök dizin dosyaları..." -ForegroundColor Gray
$rootFiles = @(
    "README.md",
    "DEPLOYMENT.md", 
    "AUTHENTICATION_SYSTEM.md",
    "notes.md",
    "clip.md",
    "instructions-auth.md",
    "tailwind.config.js",
    "vite.config.js",
    "index.html",
    "prod.md",
    "production-cleanup.md"
)

foreach ($file in $rootFiles) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination "$backupFolder/" -Force
        Write-Host "    ✓ $file" -ForegroundColor DarkGray
    }
}

# Git bilgilerini de backup'a ekle (eğer varsa)
if (Test-Path ".git") {
    Write-Host "  └─ Git repository bilgileri..." -ForegroundColor Gray
    Copy-Item -Path ".git" -Destination "$backupFolder/.git" -Recurse -Force
}

# Package.json dosyalarını öne çıkar
Write-Host "  └─ Package bilgileri..." -ForegroundColor Gray
if (Test-Path "frontend/package.json") {
    Copy-Item -Path "frontend/package.json" -Destination "$backupFolder/frontend_package.json" -Force
}
if (Test-Path "backend/package.json") {
    Copy-Item -Path "backend/package.json" -Destination "$backupFolder/backend_package.json" -Force
}

# Backup bilgi dosyası oluştur
Write-Host "📝 Backup bilgi dosyası oluşturuluyor..." -ForegroundColor Cyan
$backupInfo = @"
# Backup Bilgileri

**Backup Tarihi:** $(Get-Date -Format "dd.MM.yyyy HH:mm:ss")
**Backup Adı:** $zipFileName
**Proje:** MuteahhitHub (muteahhitbilgiportali)

## Backup İçeriği

### Frontend
- Tüm kaynak kodlar (src/, components/, pages/, utils/)
- Konfigürasyon dosyaları (vite.config.js, tailwind.config.js)
- Package.json ve bağımlılıklar
- Demo proje dosyaları (public/ altındaki tüm projeler)
- Environment dosyaları (.env, .env.example)

### Backend  
- Tüm kaynak kodlar (controllers/, services/, middlewares/, routes/)
- Veritabanı dosyası (db.sqlite)
- Upload dosyaları (uploads/ klasörü)
- Legacy scriptler (legacy/ klasörü)
- Test dosyaları (__tests__/ klasörü)
- Güvenlik scriptleri (security-scripts/ klasörü)
- Konfigürasyon dosyaları
- Package.json ve bağımlılıklar

### Kök Dizin
- Dokümantasyon dosyaları (README.md, DEPLOYMENT.md, etc.)
- Geliştirme notları (notes.md, clip.md, etc.)
- Konfigürasyon dosyaları
- Git repository bilgileri

## Geri Yükleme

Bu backup'ı geri yüklemek için:

1. Zip dosyasını açın
2. İçeriği istediğiniz klasöre çıkarın
3. Her iki klasörde bağımlılıkları yükleyin:
   ```
   cd frontend && npm install
   cd backend && npm install
   ```
4. Environment dosyalarını düzenleyin
5. Backend'i başlatın: `cd backend && npm start`
6. Frontend'i başlatın: `cd frontend && npm run dev`

## Notlar

- Bu backup production'a geçmeden önce alınmıştır
- Tüm geliştirme dosyaları ve demo veriler dahil edilmiştir
- Production temizliği sonrası bu backup'tan veri geri yüklenebilir
- Admin kullanıcısı: 05326225500 / admin123

---
Backup Scripti tarafından otomatik oluşturuldu.
"@

$backupInfo | Out-File -FilePath "$backupFolder/BACKUP_INFO.md" -Encoding UTF8

# ZIP dosyası oluştur
Write-Host "🗜️  ZIP dosyası oluşturuluyor: $zipFileName" -ForegroundColor Cyan
try {
    # Windows 10+ PowerShell ile zip oluştur
    Compress-Archive -Path "$backupFolder\*" -DestinationPath $zipFileName -Force
    Write-Host "✅ ZIP dosyası başarıyla oluşturuldu!" -ForegroundColor Green
} catch {
    Write-Host "❌ ZIP oluşturma hatası: $_" -ForegroundColor Red
    Write-Host "📁 Backup klasörü elle ziplenebilir: $backupFolder" -ForegroundColor Yellow
}

# Geçici klasörü sil
Write-Host "🧹 Geçici dosyalar temizleniyor..." -ForegroundColor Cyan
Remove-Item -Path $backupFolder -Recurse -Force -ErrorAction SilentlyContinue

# Dosya boyutunu göster
if (Test-Path $zipFileName) {
    $fileSize = [math]::Round((Get-Item $zipFileName).Length / 1MB, 2)
    Write-Host ""
    Write-Host "📊 Backup Özeti:" -ForegroundColor Green
    Write-Host "   📄 Dosya adı: $zipFileName" -ForegroundColor White
    Write-Host "   📏 Boyut: $fileSize MB" -ForegroundColor White
    Write-Host "   📍 Konum: $(Get-Location)\$zipFileName" -ForegroundColor White
    Write-Host ""
    Write-Host "🎉 Backup başarıyla tamamlandı!" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Şimdi production temizliğini başlatabilirsiniz:" -ForegroundColor Yellow
    Write-Host "   .\cleanup-production.ps1" -ForegroundColor White
} else {
    Write-Host "❌ Backup ZIP dosyası oluşturulamadı!" -ForegroundColor Red
}