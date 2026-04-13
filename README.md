# EasyPostgre Admin Vault MVP

This repository now includes a server-side admin login flow with protected routes, session validation middleware, and a credential vault service that encrypts database secrets at rest.

## What is implemented

- **Admin login flow**
  - `POST /auth/login` validates admin credentials from environment variables.
  - A server-side session is created and validated by middleware on protected routes.
  - `POST /auth/logout` invalidates the session.
- **Protected routes**
  - `GET /admin/me`
  - `GET/POST/PATCH/DELETE /credentials`
- **Credential vault service (server-only secret handling)**
  - Passwords are encrypted at rest using AES-256-GCM with an app-level secret (`APP_SECRET`).
  - API responses only include masked password values (`passwordMasked`).
  - Plaintext secrets are never returned to client responses.
- **Input validation with Zod**
  - Credential create/update payloads are schema-validated.
  - Delete operations require explicit confirmation tokens.

## Environment variables

Required:

- `ADMIN_PASSWORD`: admin password for login.
- `APP_SECRET`: application secret used to derive encryption key.

Optional:

- `ADMIN_USER` (default: `admin`)
- `SESSION_TTL_MINUTES` (default: `60`)
- `PORT` (default: `3000`)

## Threat model and limitations (MVP)

### Threat model

This MVP is designed to reduce accidental secret disclosure in a single-admin environment:

- Protects credential storage at rest by encrypting secret fields.
- Restricts credential APIs behind authenticated admin sessions.
- Adds explicit confirmation tokens for destructive operations.
- Returns masked values to UI to reduce overexposure of sensitive fields.

### Known limitations

- **Single-admin assumption:** one static admin credential pair from env; no multi-user RBAC.
- **Local secret management:** `APP_SECRET` and admin credentials are env-managed; secure distribution/rotation is external.
- **In-memory storage:** sessions, confirmation tokens, and credentials are in-memory and reset on restart.
- **No brute-force throttling:** login endpoint currently lacks rate limiting and lockout controls.
- **No CSRF token protection:** cookie is `HttpOnly` and `SameSite=Strict`, but full CSRF strategy is not implemented.
- **Server compromise risk:** if runtime memory is compromised, plaintext may be observable during decryption operations.

## Quick start

```bash
npm install
ADMIN_PASSWORD='change-me' APP_SECRET='a-very-long-random-secret' npm start
```

