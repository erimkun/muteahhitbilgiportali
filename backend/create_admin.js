/**
 * Secure initial admin creation / update script
 *
 * IMPORTANT (Production Guidance):
 * - Script'i production ortamında sadece bir kez çalıştırın.
 * - Çalıştırdıktan sonra repodan çıkarın veya erişimi kısıtlayın.
 * - Parola / telefon bilgilerini KESİNLİKLE koda gömmeyin.
 * - Kullanım: (örnek)
 *   node create_admin.js \
 *     --phone 05321112233 \
 *     --password 'GucluParola123!' \
 *     --name 'System Admin' \
 *     --role superadmin
 *
 *   Ortam değişkenleri ile de verebilirsiniz:
 *     ADMIN_PHONE=0532... ADMIN_PASSWORD='GucluParola123!' node create_admin.js
 *
 * Bayraklar:
 *   --force  Var olan kullanıcıyı zorla günceller (parola reset)
 *   --no-overwrite  Var ise hata verip çık (güvenli kurulum modu)
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Reuse backend DB resolution logic similar to database.js
let dbFile;
try {
  const config = require('./config/env');
  const defaultDbName = (config && config.database && config.database.filename) ? config.database.filename : 'db.sqlite';
  dbFile = process.env.DBSOURCE || path.join(__dirname, defaultDbName);
} catch (_) {
  dbFile = process.env.DBSOURCE || path.join(__dirname, 'db.sqlite');
}

if (!fs.existsSync(path.dirname(dbFile))) {
  console.error('❌ Database directory not found:', path.dirname(dbFile));
  process.exit(2);
}

// Simple CLI arg parser
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}
const hasFlag = (flag) => args.includes(flag);

const adminPhone = process.env.ADMIN_PHONE || getArg('--phone');
const adminPassword = process.env.ADMIN_PASSWORD || getArg('--password');
const adminName = process.env.ADMIN_NAME || getArg('--name') || 'Admin';
const adminRole = (process.env.ADMIN_ROLE || getArg('--role') || 'admin').toLowerCase();
const force = hasFlag('--force');
const noOverwrite = hasFlag('--no-overwrite');

function usage(msg) {
  if (msg) console.error('\n❌ ' + msg + '\n');
  console.log(`Kullanım:
  node create_admin.js --phone 05XXXXXXXXX --password 'GucluParola123!' [--name 'Ad'] [--role admin|superadmin] [--force|--no-overwrite]

Alternatif (env):
  ADMIN_PHONE=05XXXXXXXXX ADMIN_PASSWORD='GucluParola123!' node create_admin.js
`);
  process.exit(1);
}

if (!adminPhone) usage('Telefon (--phone veya ADMIN_PHONE) gerekli.');
if (!adminPassword) usage('Parola (--password veya ADMIN_PASSWORD) gerekli.');

// Basic password policy (adjust as needed)
function validatePassword(pw) {
  const errors = [];
  if (pw.length < 10) errors.push('>=10 karakter');
  if (!/[A-ZÇĞİÖŞÜ]/.test(pw)) errors.push('en az 1 büyük harf');
  if (!/[a-zçğıöşü]/.test(pw)) errors.push('en az 1 küçük harf');
  if (!/[0-9]/.test(pw)) errors.push('en az 1 rakam');
  if (!/[!@#$%^&*()_+\-=[\]{};':",.<>/?`~]/.test(pw)) errors.push('en az 1 sembol');
  return errors;
}

const pwIssues = validatePassword(adminPassword);
if (pwIssues.length) {
  console.warn('⚠️ Parola politika uyarıları: ' + pwIssues.join(', '));
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Production ortamında zayıf parola ile devam edilmiyor.');
    process.exit(1);
  }
}

if (!['admin', 'superadmin'].includes(adminRole)) {
  usage('Geçersiz rol. Sadece admin veya superadmin.');
}

console.log('🔧 Admin oluşturma / güncelleme başlıyor...');
console.log('📄 DB:', dbFile);
console.log('👤 Telefon:', adminPhone);
console.log('🎚 Rol:', adminRole);
if (force && noOverwrite) {
  console.error('❌ --force ve --no-overwrite birlikte kullanılamaz');
  process.exit(1);
}

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('❌ DB bağlantı hatası:', err.message);
    process.exit(2);
  }
});

function safeExit(code = 0) {
  db.close(() => process.exit(code));
}

db.get('SELECT id, phone, role FROM users WHERE phone = ?', [adminPhone], (err, row) => {
  if (err) {
    console.error('❌ Sorgu hatası:', err.message);
    return safeExit(2);
  }

  if (row) {
    console.log(`ℹ️ Kullanıcı zaten mevcut (id=${row.id}, rol=${row.role}).`);
    if (noOverwrite) {
      console.error('⛔ no-overwrite aktif: Güncelleme yapılmadı.');
      return safeExit(3);
    }
    if (!force) {
      console.log('✋ Parola resetlemek için --force kullanın veya --no-overwrite ile iptal edin.');
      return safeExit(4);
    }
    const hash = bcrypt.hashSync(adminPassword, 12);
    db.run('UPDATE users SET password_hash = ?, name = ?, role = ?, is_active = 1 WHERE id = ?', [hash, adminName, adminRole, row.id], function (uErr) {
      if (uErr) {
        console.error('❌ Güncelleme hatası:', uErr.message);
        return safeExit(5);
      }
      console.log('✅ Admin kullanıcı güncellendi (parola & rol).');
      console.log('⚠️ Parolayı güvenli bir yerde saklayın. Bu ekranda tekrar gösterilmeyecek.');
      return safeExit(0);
    });
  } else {
    const hash = bcrypt.hashSync(adminPassword, 12);
    db.run(
      'INSERT INTO users (phone, password_hash, name, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, datetime("now"))',
      [adminPhone, hash, adminName, adminRole],
      function (iErr) {
        if (iErr) {
          console.error('❌ Oluşturma hatası:', iErr.message);
          return safeExit(6);
        }
        console.log('✅ Admin kullanıcı oluşturuldu (id=' + this.lastID + ').');
        console.log('⚠️ Parolayı güvenli bir yerde saklayın. Bu ekranda tekrar gösterilmeyecek.');
        return safeExit(0);
      }
    );
  }
});
