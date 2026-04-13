# easypostgre

A minimal TypeScript service scaffold for secure PostgreSQL credential handling and backup prerequisite checks.

## Feature list

- Auth secret and encryption key driven configuration via environment variables.
- AES-256-GCM credential encryption/decryption utilities.
- Input validation helpers for required values, storage paths, and database identifiers.
- HTTP API health endpoint (`GET /health`).
- HTTP API prerequisite endpoint (`GET /api/v1/system/prerequisites`) that reports whether `pg_dump` and `pg_restore` are available.
- Test foundation with unit tests (crypto + validation) and one integration-style API test.
- CI-friendly scripts for linting, type-checking, and building.

## Setup

1. **Install dependencies**
   ```bash
   npm ci
   ```
2. **Create your environment file**
   ```bash
   cp .env.example .env
   ```
3. **Set secrets**
   - `AUTH_SECRET`: use at least 32 random characters.
   - `CREDENTIAL_ENCRYPTION_KEY_BASE64`: must be a base64-encoded 32-byte key.
4. **Run tests**
   ```bash
   npm test
   ```
5. **Start the service**
   ```bash
   RUN_SERVER=1 NODE_ENV=production node --enable-source-maps dist/src/server.js
   ```

## Architecture

- `src/crypto.js`: encryption/decryption boundary (credential confidentiality).
- `src/validation.js`: centralized validation for user/environment inputs.
- `src/server.js`: API surface and runtime checks for backup/restore prerequisites.
- `tests/*.test.js`: foundational unit and integration-style tests.

This separation keeps cryptography, validation, and HTTP concerns isolated and easier to evolve independently.

## Security tradeoffs

- Uses authenticated encryption (AES-256-GCM), but key management is environment-based; production deployments should source keys from a KMS or secret manager rather than local `.env` files.
- Validation prevents obvious path traversal and identifier injection patterns but does not replace deeper authorization checks.
- Endpoint only reports binary availability and avoids exposing detailed host command output to reduce leak risk.
- No persistent auth/session implementation is included yet; this is intentionally a scaffold.

## Backup/restore prerequisites and fallback behavior

This project expects these PostgreSQL client binaries to be installed on runtime hosts:

- `pg_dump` (for backups)
- `pg_restore` (for restores)

The endpoint `GET /api/v1/system/prerequisites` returns:

- `pgDump`: whether `pg_dump --version` succeeds.
- `pgRestore`: whether `pg_restore --version` succeeds.
- `fallbackMode`: `true` when either binary is unavailable.

### Fallback behavior when binaries are unavailable

When `fallbackMode` is `true`, callers should disable backup/restore actions and surface an operational warning. This avoids failing mid-operation and keeps behavior deterministic in constrained environments (e.g., slim containers without PostgreSQL client tooling).

## Known limitations

- No real credential persistence implementation yet (only utility layer).
- No actual backup/restore execution orchestration yet.
- No authentication middleware or role-based authorization.
- No migration, multi-tenant isolation, or retention policies yet.
- Fallback mode is informational; caller-side enforcement is required.
