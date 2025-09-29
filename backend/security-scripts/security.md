# MuteahhitHub Güvenlik Analizi ve İyileştirme Raporu

Bu doküman, MuteahhitHub uygulamasının güvenlik analizini, tespit edilen açıkları ve bu açıkları gidermek için önerilen çözümleri içermektedir.

## 1. En Kritik Risk: Yetkisiz Dosya Erişimi (Broken Access Control)

**OWASP Kategorisi:** A01:2021 - Broken Access Control

### Sorun
Uygulamanın en ciddi güvenlik açığı, proje verilerinin (`tiles`, `models`, `360views` vb.) `frontend/public` klasörü altında saklanmasıdır. Vite gibi modern web geliştirme araçları, `public` klasöründeki tüm içeriği, herhangi bir sunucu taraflı kontrol olmaksızın doğrudan erişilebilir kılar.

Bu durum, backend'de yazılmış olan `secureFileMiddleware.js` ve diğer tüm yetkilendirme mekanizmalarının tamamen devre dışı kalmasına neden olur. Kötü niyetli bir kullanıcı, proje kodunu (örn: `1094_5_project`) bildiği veya tahmin ettiği takdirde, aşağıdaki gibi bir URL üzerinden projeye ait tüm hassas verilere **doğrudan ve yetkisiz** bir şekilde erişebilir:

`https://[sunucu_adresi]/1094_5_project/tiles/Data/Tile_p000_p000_p000.b3dm`

Bu, kullanıcı verilerinin gizliliğini ve sistemin bütünlüğünü temelden tehdit eden kritik bir zafiyettir.

### Çözüm
Tüm proje dosyaları, sadece backend üzerinden ve sıkı yetki kontrolleriyle sunulmalıdır.

1.  **Dosyaların Taşınması:** `frontend/public` altındaki tüm proje klasörleri (`1094_5_project`, `400_111_project` vb.) backend'deki `uploads/projects` klasörüne taşınmalıdır. `uploads` klasörü zaten `secureFileMiddleware` tarafından korunmaktadır.
2.  **Frontend'in Güncellenmesi:** Frontend uygulamasının (CesiumJS viewer), bu dosyalara erişmek için doğrudan URL kullanmak yerine, backend API'sine istek yapması gerekmektedir. Backend, gelen istekteki kullanıcının yetkisini kontrol ettikten sonra dosyayı bir stream olarak frontend'e göndermelidir.

**Örnek Veri Akışı:**
*   Frontend, `https://[sunucu_adresi]/api/projects/1094_5/files/tiles/Data/Tile_p000_p000_p000.b3dm` gibi bir endpoint'e istek atar.
*   Backend, bu isteği alır, `authMiddleware` ile kullanıcının kimliğini doğrular ve `1094_5` projesine erişim yetkisi olup olmadığını kontrol eder.
*   Yetki varsa, backend ilgili dosyayı diskten okur ve HTTP yanıtı olarak frontend'e gönderir.
*   Yetki yoksa, `403 Forbidden` hatası döndürür.

## 2. API ve Endpoint Güvenliği

### Sorun
- **IDOR (Insecure Direct Object References):** Bazı API endpoint'leri (özellikle `GET` istekleri) yeterli yetkilendirme kontrolünden geçmiyor olabilir. Bir kullanıcı, URL'deki ID'yi değiştirerek başka bir kullanıcının projesine ait bilgilere erişebilir.
- **Hata Mesajları:** Detaylı hata mesajları (örn: "Project not found" veya "SQLITE_CONSTRAINT_UNIQUE"), saldırgana sistemin iç yapısı hakkında bilgi sızdırabilir.

### Çözüm
1.  **Tüm Endpoint'leri Güvence Altına Alın:** `projectRoutes.js` ve diğer route dosyalarındaki tüm endpoint'lerin `requireAdmin` veya `requireProjectAccess` gibi uygun middleware'ler ile korunduğundan emin olun. Özellikle veri listeleyen veya getiren endpoint'ler kritik öneme sahiptir.
2.  **Genel Hata Mesajları Kullanın:** Kullanıcıya gösterilen hata mesajlarını standartlaştırın. "İstek işlenemedi", "Geçersiz istek" veya "Erişim yetkiniz bulunmuyor" gibi genel mesajlar kullanın. Detaylı teknik hatalar sadece sunucu loglarına yazılmalıdır.

## 3. Kimlik Doğrulama ve Oturum Yönetimi

### Sorun
- **Oturum Güvenliği:** `express-session` için kullanılan `secret` anahtarının üretim ortamında tahmin edilemez ve güçlü bir değer olması gerekir. Varsayılan veya zayıf bir anahtar, oturumların ele geçirilmesine yol açabilir.
- **Rol Yönetimi:** Mevcut `admin` ve `user` rolleri, gelecekteki ihtiyaçlar için yetersiz kalabilir.

### Çözüm
1.  **Güçlü Oturum Anahtarı:** Oturum `secret`'ını `.env` dosyasından okuyun ve üretim ortamı için `openssl rand -hex 32` gibi bir komutla üretilmiş rastgele bir değer kullanın.
2.  **Güvenli Çerez Ayarları:** Üretim ortamında oturum çerezleri için `secure: true` (sadece HTTPS üzerinden gönderilir), `httpOnly: true` (istemci taraflı script'lerin erişimini engeller) ve `sameSite: 'strict'` veya `'lax'` ayarlarını kullanın.
3.  **Rol Tabanlı Erişim Kontrolü (RBAC):** İhtiyaçlara göre daha detaylı roller (`proje_yoneticisi`, `izleyici`, `editor` vb.) tanımlayın ve bu rollere göre API yetkilerini `authMiddleware` içinde kontrol edin.

## 4. Veritabanı Güvenliği

### Mevcut Durum (İyi)
`dbService.js` dosyasındaki tüm veritabanı operasyonları, `sqlite3` kütüphanesinin parametreli sorgu (`?`) özelliğini kullanmaktadır. Bu, SQL Injection saldırılarına karşı **etkili bir koruma** sağlar. `security-scripts/attacks.js` dosyasındaki testlerin başarısız olması bu yüzdendir.

### Öneri
- **Veritabanı Dosya Konumu:** `db.sqlite` dosyasının web sunucusunun erişebileceği bir dizinde (örn: `public` veya `frontend/public`) **olmadığından** emin olun. Mevcut konumu (`backend/db.sqlite`) bu açıdan güvenlidir.

## 5. Bağımlılık Güvenliği (Dependency Management)

### Sorun
`package.json` dosyalarında listelenen kütüphanelerin eski sürümlerinde bilinen güvenlik açıkları olabilir.

### Çözüm
1.  **Düzenli Tarama:** `npm audit` veya `yarn audit` komutlarını düzenli olarak çalıştırarak projenizin bağımlılıklarındaki bilinen güvenlik açıklarını tespit edin.
2.  **Güncelleme:** `npm audit fix` komutuyla veya manuel olarak paketleri güncelleyerek bu açıkları kapatın. Bu işlem, hem `backend` hem de `frontend` için yapılmalıdır.

## Özet ve Aksiyon Planı

1.  **(Acil / Kritik)** `frontend/public` klasöründeki tüm proje verilerini `backend/uploads/projects` altına taşıyın.
2.  **(Acil / Kritik)** Frontend uygulamasını, proje dosyalarını backend'deki güvenli bir API endpoint'i üzerinden talep edecek şekilde güncelleyin.
3.  **(Yüksek Öncelik)** Tüm API endpoint'lerinin yetkilendirme middleware'leri ile korunduğunu tekrar kontrol edin.
4.  **(Orta Öncelik)** Oturum yönetimi ayarlarını (secret, cookie flags) üretim ortamı için güçlendirin.
5.  **(Orta Öncelik)** `npm audit` komutunu çalıştırarak bağımlılıkları kontrol edin ve güncelleyin.
6.  **(Düşük Öncelik)** Hata mesajlarını daha genel olacak şekilde standartlaştırın.
