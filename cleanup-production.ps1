# Production Temizlik Scripti
# Bu script production'a geçmeden önce gereksiz dosyaları siler

Write-Host "🧹 Production için dosya temizliği başlatılıyor..." -ForegroundColor Yellow
Write-Host ""

# Frontend temizlik
Write-Host "📂 Frontend temizleniyor..." -ForegroundColor Cyan
Remove-Item -Recurse -Force "frontend/public/400_111_project" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "frontend/public/917_68_project" -ErrorAction SilentlyContinue  
Remove-Item -Recurse -Force "frontend/public/1094_5_project" -ErrorAction SilentlyContinue
Remove-Item -Force "frontend/.env" -ErrorAction SilentlyContinue
Write-Host "✅ Demo proje dosyaları silindi" -ForegroundColor Green

# Backend temizlik
Write-Host "📂 Backend temizleniyor..." -ForegroundColor Cyan
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
Write-Host "✅ Legacy, test ve geliştirme dosyaları silindi" -ForegroundColor Green

# Kök dizin temizlik
Write-Host "📂 Kök dizin temizleniyor..." -ForegroundColor Cyan
Remove-Item -Force "notes.md" -ErrorAction SilentlyContinue
Remove-Item -Force "clip.md" -ErrorAction SilentlyContinue
Remove-Item -Force "instructions-auth.md" -ErrorAction SilentlyContinue
Write-Host "✅ Geliştirme notları silindi" -ForegroundColor Green

# Gerekli klasörleri yeniden oluştur
Write-Host "📁 Gerekli klasörler oluşturuluyor..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path "backend/uploads" -Force | Out-Null
Write-Host "✅ backend/uploads klasörü oluşturuldu" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 Production temizlik tamamlandı!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Sonraki adımlar:" -ForegroundColor Yellow
Write-Host "1. frontend/.env dosyası oluştur (production API URL'i ile)" -ForegroundColor White
Write-Host "2. backend/.env dosyası oluştur (production ayarları ile)" -ForegroundColor White
Write-Host "3. cd frontend && npm install" -ForegroundColor White
Write-Host "4. cd backend && npm install" -ForegroundColor White
Write-Host "5. cd frontend && npm run build" -ForegroundColor White
Write-Host "6. İlk admin: 05326225500 / admin123 (şifreyi değiştir!)" -ForegroundColor White