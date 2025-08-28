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
