const crypto = require('crypto');

function cspNonce(req, res, next) {
  try {
    // 16 bytes base64 nonce
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.nonce = nonce;
  } catch (e) {
    // fallback to no nonce (helmet will still apply policy)
    res.locals.nonce = null;
  }
  next();
}

module.exports = { cspNonce };
