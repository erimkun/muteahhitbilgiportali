# How to Test — MuteahhitHub Security Checks

Bu küçük rehber, yaptığımız güvenlik değişikliklerini hızlıca doğrulamanız için adım adım test komutları ve DevTools kontrolleri içerir. Aşağıdaki testlerin çoğu için sunucuyu production-benzeri şekilde çalıştırmanız gerekebilir (ör. `NODE_ENV=production` veya `FORCE_HTTPS=true`, `TRUST_PROXY=true` ayarları). Örnekler PowerShell ile verildi.

## Ön Koşullar
- Projeyi backend dizininde başlatın (gerekirse `.env`'inizi `backend/.env.example.production` içeriğine göre güncelleyin).
- Örnek production env değişkenleri:
  - NODE_ENV=production
  - TRUST_PROXY=true (proxy varsa)
  - FORCE_HTTPS=true
  - SESSION_SECRET=uzun_random_deger

## 1) HTTPS redirect kontrolü
Amaç: HTTP isteğinin 301 veya 302 ile HTTPS'e yönlendirildiğini doğrulamak.

PowerShell (tek satır):

```powershell
curl -I http://localhost:3001/ -UseBasicParsing
```

Beklenen:
- `HTTP/1.1 301 Moved Permanently` veya benzeri
- `Location: https://localhost:3001/` veya hostunuzun HTTPS adresi

Not: Local geliştirmede doğrudan HTTPS terminasyonu yoksa bu testi production benzeri ortamda çalıştırın (veya FORCE_HTTPS=true ile). Reverse proxy (nginx, cloudflare) arkasındaysanız `TRUST_PROXY=true` ayarlı olmalı.

## 2) Set-Cookie ve cookie flag'lerini kontrol etme
Amaç: Session cookie içinde `Secure`, `HttpOnly`, `SameSite` gibi güvenlik bayraklarının doğru olduğunu görmek.

- Önce bir oturum başlatma isteği yapın (login endpoint veya `/session` endpoint'i). Örnek (giriş yoksa `/session`):

```powershell
curl -i http://localhost:3001/session -UseBasicParsing
```

- Yanıt başlıklarında `Set-Cookie` görmelisiniz. Örnek beklenen parçalar:
  - `mthub_session=...; Path=/; HttpOnly; SameSite=Strict; Secure` (Secure sadece HTTPS isteklerinde görünür)

Tarayıcı ile kontrol (DevTools):
1. Tarayıcıda uygulamayı açın.
2. DevTools -> Application (veya Storage) -> Cookies -> ilgili domain seçin.
3. Cookie satırında `HttpOnly`, `Secure`, `SameSite` sütunlarını kontrol edin.

## 3) Helmet ve güvenlik başlıklarını doğrulama
Amaç: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` gibi başlıkların sunulduğunu teyit etmek.

PowerShell ile bir endpoint isteği alıp yanıt başlıklarını inceleyin:

```powershell
curl -I https://localhost:3001/ -UseBasicParsing
```

Beklenen başlık örnekleri (env ve helmet konfigüne göre değişir):
- `Content-Security-Policy: ...`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` veya `SAMEORIGIN`
- `Referrer-Policy: no-referrer`

Not: HSTS sadece HTTPS üzerinden yanıt verildiğinde ve helmet config HSTS aktif ise görünür.

## 4) HTTPS terminasyonunu ve sertifikayı tarayıcıda kontrol
Amaç: Gerçek TLS sertifikasının geçerli olduğunu doğrulamak.

Tarayıcı DevTools -> Security sekmesi (veya adres çubuğundaki kilit ikonuna tıklayın) ile sertifika geçerliliğini kontrol edin.

## 5) Rate limiter / brute-force testi
Amaç: auth endpoint'lerindeki rate limiter'ın 429 döndürdüğünü doğrulamak.

PowerShell (deneme):

```powershell
for ($i=0; $i -lt 10; $i++) { curl -i -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"bad","password":"bad"}' -UseBasicParsing }
```

Beklenen: belirli bir sayıdan sonra (ör. 3-20) `HTTP/1.1 429 Too Many Requests` veya JSON hata mesajı dönecektir.

Not: Rate limit konfigürasyonuna göre sayılar değişebilir.

## 6) Secure file serving testi (yetki kontrolleri)
Amaç: `secureFileMiddleware`'in yetkisiz erişimi reddettiğini doğrulamak.

- Yetkisiz istek örneği:

```powershell
curl -i http://localhost:3001/uploads/projects/1094_5_project/tiles/Data/Tile_p000_p000_p000.b3dm -UseBasicParsing
```

Beklenen: `401 Unauthorized` veya `403 Forbidden` (middleware isteğe göre yanıt verir).

- Yetkili oturumla aynı isteği yaptığınızda dosya içeriği veya 200 döndürülmeli.

## 7) CSP nonce / inline script testleri
Amaç: Eğer CSP nonce mantığı kullanıyorsanız, inline script'lerin nonce ile çalıştığını ve `unsafe-inline` kullanılmadığını doğrulayın.

- Sayfayı açın ve DevTools -> Console'da CSP ile ilgili hata (violations) olup olmadığını kontrol edin.
- Eğer inline script nonce ile sunuluyorsa, script tag içinde `nonce="..."` olmalıdır.

## 8) Hızlı kontrol listesi
- [ ] `curl -I http://...` HTTP -> HTTPS redirect kontrolü
- [ ] `curl -i /session` veya login ile `Set-Cookie` header'larını kontrol et
- [ ] DevTools Application -> Cookies: HttpOnly / Secure / SameSite
- [ ] `curl -I https://...` Helmet başlıklarını kontrol et
- [ ] Brute-force testi ile 429 dönülüyor mu?
- [ ] `/uploads/...` yetkisiz erişim reddediliyor mu?

---

Notlar
- Lokal geliştirmede HTTPS ve Secure cookie davranışını test etmek zordur; production veya staging ortamında test etmek en güvenlisidir.
- Eğer uygulama bir ters-proxy (nginx) arkasındaysa, proxy'nin `X-Forwarded-Proto` header'ını doğru setlediğinden emin olun.

Tamamlandı: `backend/security-scripts/how-to-test.md` dosyası oluşturuldu ve repoya eklendi.
