#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error('\n\u274C Production config validation failed: ' + msg + '\n');
  process.exit(1);
}

const env = process.env;

if (env.NODE_ENV !== 'production') {
  console.log('Not in production mode, skipping strict production config checks.');
  process.exit(0);
}

// SESSION_SECRET
const secret = env.SESSION_SECRET || env.SESSION_SECRET || '';
if (!secret || secret === 'dev_secret_change_me' || secret.length < 32) {
  fail('SESSION_SECRET must be set to a strong value (at least 32 chars). Generate one with: openssl rand -hex 32');
}

// TRUST_PROXY
if (!(env.TRUST_PROXY === 'true' || env.TRUST_PROXY === '1')) {
  console.warn('⚠️  Warning: TRUST_PROXY is not enabled. If you run behind a proxy, set TRUST_PROXY=true so secure cookies work correctly.');
}

// HTTPS checks
if (env.HTTPS_ENABLED === 'true' || env.FORCE_HTTPS === 'true') {
  const keyPath = env.TLS_KEY_PATH || './certs/private-key.pem';
  const certPath = env.TLS_CERT_PATH || './certs/certificate.pem';

  if (!fs.existsSync(path.resolve(keyPath))) {
    fail(`TLS key file not found at ${keyPath}`);
  }
  if (!fs.existsSync(path.resolve(certPath))) {
    fail(`TLS certificate file not found at ${certPath}`);
  }
}

console.log('✅ Production config validation passed.');
process.exit(0);
