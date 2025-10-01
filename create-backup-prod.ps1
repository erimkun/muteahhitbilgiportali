# Production Odakli (Minimal) Backup Scripti
# Bu script production'a cikarken alinacak kod odakli bir backup olusturur.
# Amac: Gelistirme, test, demo ve gereksiz dosyalari HARIC tutmak.
# Ayrica tam backup icin mevcut create-backup.ps1 scriptini kullanmaya devam edin.

$backupDate   = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFolder = "backup_prod_$backupDate"
$zipFileName  = "muteahhitbilgiportali_prod_backup_$backupDate.zip"

Write-Host "[INFO] Production odakli (minimal) backup basliyor..." -ForegroundColor Yellow
Write-Host "[INFO] Tarih: $backupDate" -ForegroundColor Gray
Write-Host ""

Write-Host "Backup klasoru olusturuluyor: $backupFolder" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null

# 1) Tum frontend ve backend klasorlerini once kopyala (daha sonra gereksizleri silecegiz)
Write-Host "Klasorler kopyalaniyor..." -ForegroundColor Cyan
Copy-Item -Path "frontend" -Destination "$backupFolder/frontend" -Recurse -Force
Copy-Item -Path "backend"  -Destination "$backupFolder/backend"  -Recurse -Force

# 2) KOK dizindeki temel dosyalari al
$rootFiles = @(
  "README.md",
  "DEPLOYMENT.md",
  "AUTHENTICATION_SYSTEM.md",
  "tailwind.config.js",
  "vite.config.js",
  "index.html",
  "prod.md",
  "production-cleanup.ps1",
  "create-backup.ps1",
  "cleanup-production.ps1"
)
foreach ($f in $rootFiles) { if (Test-Path $f) { Copy-Item $f "$backupFolder/" -Force } }

# 3) Production icin HARIC tutulacak ozel path listesi (cleanup-production.ps1 referans alindi)
$excludePaths = @(
  # Frontend demo projeler & gelistirme
  "frontend/public/400_111_project",
  "frontend/public/917_68_project",
  "frontend/public/1094_5_project",
  "frontend/.env",
  # Backend gelistirme / test / legacy
  "backend/legacy",
  "backend/scripts",
  "backend/security-scripts",
  "backend/__tests__",
  "backend/uploads",            # Istege gore: upload'lar production kurulumu icin zorunlu degil
  "backend/check_db_columns.js",
  "backend/HOW_TO_IMPROVE.md",
  "backend/.env",
  "backend/jest.config.js",
  # Kod tabanli prod kurulumu icin uygulama veritabani dosyasi alinmayabilir
  "backend/db.sqlite",
  # Kok dizin gelistirme notlari
  "notes.md",
  "clip.md",
  "instructions-auth.md"
)

Write-Host "Gereksiz dosya/dizinler temizleniyor..." -ForegroundColor Cyan
foreach ($rel in $excludePaths) {
  $target = Join-Path $backupFolder $rel
  if (Test-Path $target) {
    try {
      Remove-Item -Path $target -Recurse -Force -ErrorAction Stop
      Write-Host "  - EXCLUDED: $rel" -ForegroundColor DarkGray
    } catch {
      Write-Host "  - KALDIRILAMADI: $rel ($_ )" -ForegroundColor Red
    }
  }
}

# 4) package.json dosyalarini one cikar
if (Test-Path "frontend/package.json") { Copy-Item "frontend/package.json" "$backupFolder/frontend_package.json" -Force }
if (Test-Path "backend/package.json")  { Copy-Item "backend/package.json"  "$backupFolder/backend_package.json"  -Force }

# 5) Git bilgisi normalde production minimal backup'ta gerekmez. Isterseniz asagidaki satiri acin.
# if (Test-Path ".git") { Copy-Item ".git" "$backupFolder/.git" -Recurse -Force }

# 6) Bilgi dosyasi
$info = @"
# Production Odakli (Minimal) Backup Bilgisi

**Tarih:** {0}
**Dosya:** {1}
**Tur:** Kod odakli, gereksiz/detay dosyalar ayiklanmis

## Dahil Edilenler
- frontend (demo projeler ve .env dosyasi HARIC)
- backend (legacy, test, uploads, db.sqlite vb. HARIC)
- Onemli kok dokumanlar (README, DEPLOYMENT, prod dokumanlari)
- Konfigurasyon dosyalari (vite.config.js, tailwind.config.js, vs.)

## Hariç Tutulanlar
{2}

## Neden Bu Ayrim?
Production'a cikista sadece kod tabaninin ve gerekli konfigurasyonun versiyonlanmis bir kopyasina ihtiyac vardir. Gelistirme/test/legacy/demo/veri iceren ogeler alinmayarak depo boyutu ve veri sizma riskleri azaltildi.

## Tam Backup Icin
TUM dosyalari kapsayan yedek almak isterseniz create-backup.ps1 scriptini kullanin.

-- Otomatik Olusturuldu.
"@

$excludedListPretty = ($excludePaths | ForEach-Object { "- $_" }) -join [Environment]::NewLine
$infoFormatted = $info -f (Get-Date -Format "dd.MM.yyyy HH:mm:ss"), $zipFileName, $excludedListPretty
$infoFormatted | Out-File -FilePath "$backupFolder/PROD_BACKUP_INFO.md" -Encoding UTF8

# 7) Arsivle
Write-Host "ZIP olusturuluyor: $zipFileName" -ForegroundColor Cyan
try {
  Compress-Archive -Path "$backupFolder/*" -DestinationPath $zipFileName -Force
  Write-Host "ZIP olusturuldu." -ForegroundColor Green
} catch {
  Write-Host "ZIP olusturma hatasi: $_" -ForegroundColor Red
  Write-Host "Klasor manuel arsivlenebilir: $backupFolder" -ForegroundColor Yellow
}

# 8) Gecici klasoru sil
try {
  Remove-Item $backupFolder -Recurse -Force -ErrorAction SilentlyContinue
} catch {}

if (Test-Path $zipFileName) {
  $sizeMB = [math]::Round((Get-Item $zipFileName).Length / 1MB, 2)
  Write-Host "[DONE] Production odakli backup hazir: $zipFileName ($sizeMB MB)" -ForegroundColor Green
  Write-Host "Not: Tum dosyalari iceren tam yedek icin create-backup.ps1 kullanin." -ForegroundColor Yellow
} else {
  Write-Host "[FAIL] ZIP olusmadi." -ForegroundColor Red
}
