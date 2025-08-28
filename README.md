# MuteahhitHub

3D Bina Görüntüleme ve Yönetim Platformu

## Proje Hakkında

MuteahhitHub, inşaat projelerini 3D olarak görüntülemek ve yönetmek için geliştirilmiş bir web uygulamasıdır. Cesium.js kullanarak 3D bina modellerini, drone fotoğraflarını ve kat planlarını görüntüler.

## Özellikler

- 🏗️ 3D Bina Modeli Görüntüleme
- 📸 Drone Fotoğraf Yönetimi
- 📐 Kat Planı Görüntüleme
- 🎯 360° Görünüm
- 📏 Ölçüm Araçları
- 🔧 Admin Panel ve Düzenleme Araçları
- 👤 Kullanıcı Bazlı Erişim Kontrolü

## Teknolojiler

- **Frontend:** React + Vite + Cesium.js
- **Backend:** Node.js + Express
- **Veritabanı:** SQLite
- **3D Görselleştirme:** Cesium.js
- **Stil:** Tailwind CSS

## Kurulum

### Gereksinimler

- Node.js (v16 veya üzeri)
- Git
- Git LFS

### Git LFS Kurulumu

Proje büyük 3D model dosyaları içerdiği için Git LFS kullanılmaktadır.

#### Windows
```bash
# Git LFS'i indirin ve kurun
# https://git-lfs.com/ adresinden indirin

# Veya Chocolatey ile:
choco install git-lfs

# Kurulum sonrası:
git lfs install
```

#### macOS
```bash
# Homebrew ile:
brew install git-lfs

# Kurulum sonrası:
git lfs install
```

#### Linux (Ubuntu/Debian)
```bash
# APT ile:
sudo apt install git-lfs

# Kurulum sonrası:
git lfs install
```

### Proje Kurulumu

1. **Repository'yi klonlayın:**
```bash
git clone https://github.com/uskudarkentas/MuteahhitHub.git
cd MuteahhitHub
```

2. **Git LFS dosyalarını indirin:**
```bash
git lfs pull
```

3. **Backend bağımlılıklarını yükleyin:**
```bash
cd backend
npm install
```

4. **Frontend bağımlılıklarını yükleyin:**
```bash
cd ../frontend
npm install
```

## Çalıştırma

### Backend
```bash
cd backend
npm start
```

### Frontend
```bash
cd frontend
npm run dev
```

## Proje Yapısı

```
MuteahhitHub/
├── backend/                 # Node.js backend
│   ├── database.js         # Veritabanı bağlantısı
│   ├── index.js            # Ana sunucu dosyası
│   └── uploads/            # Yüklenen dosyalar
├── frontend/               # React frontend
│   ├── components/         # React bileşenleri
│   ├── pages/             # Sayfa bileşenleri
│   └── public/            # Statik dosyalar ve 3D modeller
└── .gitattributes         # Git LFS konfigürasyonu
```

## Git LFS ile Çalışma

### Yeni Büyük Dosya Ekleme
```bash
# Dosyayı ekleyin
git add large-file.b3dm

# Commit yapın
git commit -m "Add large 3D model file"

# Push yapın
git push
```

### Büyük Dosyaları Güncelleme
```bash
# Dosyayı güncelleyin
git add updated-file.b3dm

# Commit yapın
git commit -m "Update 3D model file"

# Push yapın
git push
```

### LFS Dosyalarını Kontrol Etme
```bash
# LFS ile takip edilen dosyaları görün
git lfs ls-files

# LFS durumunu kontrol edin
git lfs status
```

## Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## İletişim

- Proje Sahibi: [@uskudarkentas](https://github.com/uskudarkentas)
- Proje Linki: [https://github.com/uskudarkentas/MuteahhitHub](https://github.com/uskudarkentas/MuteahhitHub)