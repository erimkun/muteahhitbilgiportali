# MuteahhitHub 🏗️

Modern inşaat projeleri için gelişmiş 3D görselleştirme ve yönetim platformu.

## 🚀 Özellikler

- **3D Model Görüntüleme**: Cesium.js ile gelişmiş 3D model desteği
- **Drone Fotoğrafları**: Havadan çekim görüntüleri
- **Kat Planları**: Detaylı bina kat planları
- **360° Görünüm**: İnteraktif 360 derece görüntüleme
- **Admin Paneli**: Gelişmiş yönetim araçları
- **Ölçüm Araçları**: Hassas mesafe ve alan hesaplamaları
- **Model Düzenleme**: 3D modellerde kesme ve düzenleme

## 🛠️ Teknolojiler

- **Frontend**: React.js, Cesium.js, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Veritabanı**: SQLite
- **3D Rendering**: Cesium.js
- **Build Tool**: Vite

## 📁 Proje Yapısı

```
├── frontend/          # React frontend uygulaması
│   ├── components/    # UI bileşenleri
│   ├── pages/        # Sayfa bileşenleri
│   ├── context/      # React context'leri
│   └── utils/        # Yardımcı fonksiyonlar
├── backend/           # Node.js backend API
│   ├── uploads/      # Yüklenen dosyalar
│   └── database.js   # Veritabanı bağlantısı
└── public/            # Statik dosyalar ve 3D modeller
```

## 🚀 Kurulum

### Gereksinimler
- Node.js (v16 veya üzeri)
- npm veya yarn

### Frontend Kurulumu
```bash
cd frontend
npm install
npm run dev
```

### Backend Kurulumu
```bash
cd backend
npm install
npm start
```

## 📸 Özellikler Detayı

### 3D Model Görüntüleme
- Cesium.js tabanlı 3D render motoru
- Yüksek performanslı tile-based rendering
- PBR (Physically Based Rendering) desteği

### Admin Araçları
- Model seçim ve düzenleme
- Alan kesme ve ölçüm
- Logo ve bina konumlandırma
- Otomatik alan hesaplama

### Dosya Yönetimi
- Drone fotoğrafları
- Kat planları (JPG formatında)
- 3D modeller (GLTF/B3DM formatında)
- PDF dokümanlar

## 🔧 Geliştirme

### Kod Standartları
- ESLint konfigürasyonu
- Prettier formatlaması
- Component-based mimari

### Test
```bash
npm run test
```

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit yapın (`git commit -m 'Add some AmazingFeature'`)
4. Push yapın (`git push origin feature/AmazingFeature`)
5. Pull Request oluşturun

## 📞 İletişim

- **Proje**: MuteahhitHub
- **Geliştirici**: Uskudar Kentas
- **GitHub**: [uskudarkentas/MuteahhitHub](https://github.com/uskudarkentas/MuteahhitHub)

---

⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!