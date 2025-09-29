## Production Readiness Checks

This short guide lists the minimum checks to run before starting the backend in production. It focuses on session & cookie security, proxy trust, and HTTPS enforcement.

1) SESSION_SECRET

- Ensure `SESSION_SECRET` is set to a long, random value in your production `.env`.
- Generate a secret with OpenSSL (example):

```powershell
# Windows PowerShell
openssl rand -hex 32
```

Copy the output and set it in your `.env` as `SESSION_SECRET=...`.

2) TRUST_PROXY

- If your app is behind a reverse proxy (Nginx, ELB, Cloudflare, Heroku), set `TRUST_PROXY=true` in `.env` so Express honors X-Forwarded-* headers and secure cookies work correctly.

3) FORCE_HTTPS / TLS

- Prefer terminating TLS at the reverse proxy (recommended). If you let Node handle TLS, configure `HTTPS_ENABLED=true` and point `TLS_KEY_PATH` and `TLS_CERT_PATH` to valid files.
- To enforce HTTPS redirects from the app, set `FORCE_HTTPS=true`.

4) SESSION COOKIE OPTIONS

- Verify in `.env`:
  - `SESSION_SAMESITE=strict` (or `lax` if cross-site needs exist)
  - `SESSION_MAX_AGE` (ms)
  - `COOKIE_DOMAIN` only if required

5) Pre-start validation (automated)

- The app now refuses to start when `NODE_ENV=production` and `SESSION_SECRET` is the default insecure value. Run a smoke start to validate configuration:

```powershell
# From backend/
setx SESSION_SECRET "your_generated_secret"; setx TRUST_PROXY true; npm start
```

If the process exits with a message about SESSION_SECRET, update your `.env` and retry.

6) Post-deploy checks

- Check `/metrics` endpoint for app metrics (if enabled).  
- Verify cookies are marked `Secure` and `HttpOnly` in browser devtools when accessing production domain.

If you want, I can also add a lightweight startup script that validates more checks (TLS files exist, port reachable) and exits with clear errors — shall I implement that next?
