# Authentication – Fastify/JS – Jira Backlog

---

## Strategy

**Phase 1 — Naive but real skeleton:** A fully working auth system — register, login, sessions, logout, protected routes — implemented as simply as possible. In-memory storage, plaintext passwords, simple UUID sessions. Every endpoint does real work; nothing is mocked or stubbed.

**Phase 2 — SPIDR upgrades:** Each story replaces exactly one naive piece with a production implementation. Stories are independent — password hardening doesn't depend on the DB story being done, session hardening doesn't depend on password hardening, etc.

The skeleton is the product. The SPIDR stories harden it.

---

## EPIC-1 · Naive Working Skeleton

> Goal: a fully working Fastify auth system backed by in-memory state. Register stores `{ email, password }` in a JS Map. Login compares plaintext passwords and issues a UUID session token stored in another Map. `GET /me` reads the session. Logout deletes it. Real flow, naive implementations.

### ~~SKEL-1 · Fastify scaffold + health check~~ ✅ Done

**Story:** As a developer, I need a runnable Fastify app so the team has a base to build on.

**Acceptance Criteria:**
- `GET /health` returns `{ status: "ok" }`
- App starts with `node src/index.js`
- `.env` loads via `dotenv`

**Tasks:**
- [x] `npm init`, install `fastify`, `dotenv`
- [x] `src/app.js` — app factory (registers plugins + routes, exported for testing)
- [x] `src/index.js` — starts server, calls `app.listen`
- [x] `src/routes/health.js`
- [x] `src/plugins/env.js` — `fastify-plugin` wrapping `dotenv`

---

### ~~SKEL-2 · In-memory user store + register~~ ✅ Done

**Story:** As a new user, I need to register with an email and password so I have an account.

**Acceptance Criteria:**
- `POST /auth/register` with `{ email, password }` returns `201 { id, email }`
- Duplicate email returns `409`
- Users stored in a module-level `Map<email, { id, email, password }>`
- Password stored as plaintext (will be replaced in SEC-1)

**Tasks:**
- [x] `src/store/users.js` — in-memory Map with `createUser(email, password)`, `findByEmail(email)`
- [x] `src/routes/auth.js` — register handler
- [x] Generate `id` with `crypto.randomUUID()`

---

### ~~SKEL-3 · Plaintext login + UUID session~~ ✅ Done

**Story:** As a registered user, I need to log in so I receive a session token I can use on subsequent requests.

**Acceptance Criteria:**
- `POST /auth/login` with `{ email, password }` returns `200 { sessionToken }`
- Validates email exists and password matches (plaintext compare)
- Wrong credentials return `401`
- Session stored in a module-level `Map<sessionToken, userId>` (will be replaced in SES-1)
- `sessionToken` is a `crypto.randomUUID()`

**Tasks:**
- [x] `src/store/sessions.js` — in-memory Map with `createSession(userId)`, `findSession(token)`, `deleteSession(token)`
- [x] Login handler in `src/routes/auth.js`

---

### ~~SKEL-4 · Session-authenticated protected route~~ ✅ Done

**Story:** As an authenticated user, I need `GET /me` to return my profile so I can verify my session works.

**Acceptance Criteria:**
- `GET /me` with `Authorization: Bearer <sessionToken>` returns `200 { id, email }`
- Invalid/missing token returns `401`
- Looks up token in session Map, then user in user Map

**Tasks:**
- [x] `src/hooks/authenticate.js` — `preHandler` that reads Bearer token, calls `findSession`, attaches `request.user`
- [x] `src/routes/me.js` — returns `request.user`

---

### ~~SKEL-5 · Logout~~ ✅ Done

**Story:** As an authenticated user, I need to log out so my session token is immediately invalidated.

**Acceptance Criteria:**
- `POST /auth/logout` (authenticated) deletes the session token
- Returns `204`
- Subsequent requests with that token return `401`

**Tasks:**
- [x] Logout handler calls `deleteSession(token)`
- [x] Reuse `authenticate` hook on this route

---

**End of skeleton.** At this point: `register → login → GET /me → logout` is a real, working, end-to-end flow. curl it and it works.

---

## ~~EPIC-2 · Harden Passwords (SPIDR — Rules)~~ ✅ Done

### ~~SEC-1 · Replace plaintext passwords with bcrypt~~ ✅ Done

**Story:** As the system, I need passwords hashed at rest so a leaked database doesn't expose credentials.

**Replaces:** plaintext `password` field in the user store.

**Acceptance Criteria:**
- `POST /auth/register` hashes password with `bcrypt` (cost factor 12) before storing
- `POST /auth/login` uses `bcrypt.compare` instead of `===`
- Plaintext password is never stored, logged, or returned
- Timing-safe: `bcrypt.compare` runs even if user is not found (against a dummy hash)

**Tasks:**
- [x] Install `bcrypt`
- [x] `src/store/users.js` — change `password` field to `passwordHash`
- [x] Register: `bcrypt.hash(password, 12)` before `createUser`
- [x] Login: `bcrypt.compare(password, user.passwordHash)` — if user not found, compare against a static dummy hash to prevent timing attacks

---

## EPIC-3 · Persist to a Real Database (SPIDR — Data)

### ~~DB-1 · (Spike) Choose DB client + migration strategy~~ ✅ Done

**Story:** As a team, we need to decide on DB client and schema migration approach before wiring persistence.

**Acceptance Criteria:**
- ADR written in `docs/adr/001-db.md`
- Decision: MongoDB + Prisma — chosen with rationale
- Migration tool identified: Prisma Migrate

**Tasks:**
- [x] Evaluate options; write ADR (`docs/adr/001-db.md`)

---

### ~~DB-2 · Persist users to DB~~ ✅ Done

**Story:** As the system, I need users persisted to a real database so they survive a server restart.

**Replaces:** in-memory `users` Map in `src/store/users.js`.

**Acceptance Criteria:**
- `POST /auth/register` inserts into `users` table
- `POST /auth/login` queries by email
- `users` schema: `id UUID PK`, `email TEXT UNIQUE NOT NULL`, `password_hash TEXT NOT NULL`, `created_at TIMESTAMPTZ`
- In-memory store is deleted after this story

**Tasks:**
- [x] DB connection plugin `src/plugins/db.js`
- [x] `users` migration
- [x] Rewrite `src/store/users.js` → `src/db/users.js` with same interface (`createUser`, `findByEmail`)
- [x] Update register + login handlers to use new module

---

### ~~DB-3 · Persist sessions to DB~~ ✅ Done

**Story:** As the system, I need sessions persisted to a database so they survive a server restart and can be audited.

**Replaces:** in-memory `sessions` Map in `src/store/sessions.js`.

**Acceptance Criteria:**
- `sessions` schema: `token TEXT PK`, `user_id UUID FK`, `created_at TIMESTAMPTZ`, `expires_at TIMESTAMPTZ`
- `POST /auth/login` inserts session row
- `authenticate` hook queries session row
- `POST /auth/logout` deletes session row
- In-memory store is deleted after this story

**Tasks:**
- [x] `sessions` migration
- [x] Rewrite `src/store/sessions.js` → `src/db/sessions.js` with same interface
- [x] Update login, authenticate hook, logout to use new module

---

## EPIC-4 · Harden Sessions → JWT + Refresh Tokens (SPIDR — Data + Rules)

### ~~SES-1 · Replace UUID session tokens with JWTs~~ ✅ Done

**Story:** As the system, I need stateless access tokens so protected routes can authorize without a DB lookup on every request.

**Replaces:** UUID session token lookup in `authenticate` hook.

**Acceptance Criteria:**
- `POST /auth/login` returns a signed JWT (`{ sub, email, role, iat, exp }`) instead of a UUID
- JWT TTL: 15 minutes
- `authenticate` hook calls `request.jwtVerify()` — no DB query needed
- `JWT_SECRET` env var, minimum 32 bytes

**Tasks:**
- [x] Install `@fastify/jwt`
- [x] `src/plugins/jwt.js`
- [x] `src/lib/token.js` — `issueAccessToken(user)`
- [x] Rewrite `authenticate` hook to use `request.jwtVerify()`
- [x] Login handler replaces UUID issuance with JWT

---

### ~~SES-2 · Add refresh token rotation~~ ✅ Done

**Story:** As a user, I need a long-lived refresh token so I stay logged in without re-entering my password every 15 minutes.

**Builds on:** SES-1 (requires JWTs to be in place).

**Acceptance Criteria:**
- Login returns `{ accessToken, refreshToken }`
- Refresh token: opaque UUID, stored hashed in `refresh_tokens` table (`token_hash`, `user_id`, `expires_at`, `revoked_at`). TTL: 7 days
- `POST /auth/refresh` accepts a refresh token, validates it, revokes it, issues a new access token + refresh token (rotation)
- `POST /auth/logout` revokes the refresh token

**Tasks:**
- [x] `refresh_tokens` migration
- [x] `src/lib/token.js` — `issueRefreshToken`, `rotateRefreshToken`, `revokeToken`
- [x] `POST /auth/refresh` route
- [x] Update login + logout handlers

---

## EPIC-5 · Input Validation (SPIDR — Rules)

### ~~VAL-1 · Validate register + login inputs~~ ✅ Done

**Story:** As an API, I need to reject malformed requests before they hit business logic.

**Acceptance Criteria:**
- `POST /auth/register`: email must be valid format; password ≥ 8 characters; missing fields → `400` with field-level errors
- `POST /auth/login`: email + password required; missing fields → `400`
- Fastify JSON schema handles validation (no extra library needed)

**Tasks:**
- [x] Add `schema.body` to register + login routes
- [x] `src/plugins/errorHandler.js` — serialize Fastify validation errors into `{ errors: [{ field, message }] }`

---

## EPIC-6 · Rate Limiting (SPIDR — Rules)

### ~~RATE-1 · Throttle login attempts~~ ✅ Done

**Story:** As the system, I need to throttle login attempts per IP to prevent brute force.

**Acceptance Criteria:**
- Max 5 login attempts per IP per minute → `429` with `Retry-After` header
- Rate limit scoped only to `POST /auth/login` (not global)

**Tasks:**
- [x] Install `@fastify/rate-limit`
- [x] Apply as route-level plugin on login route only

---

## EPIC-7 · Password Reset (SPIDR — Path)

### ~~PWD-0 · Change password (authenticated)~~ ✅ Done

**Story:** As a logged-in user, I need to change my password so I can update my credentials.

**Acceptance Criteria:**
- `POST /auth/change-password` (authenticated) with `{ currentPassword, newPassword }` updates `password_hash`
- Validates current password with bcrypt before allowing change
- All active refresh tokens for the user are revoked on change (forces re-login on other devices)
- Returns `200`

**Tasks:**
- [x] `updatePassword(id, passwordHash)` in `src/db/users.js`
- [x] `revokeAllForUser(userId)` in `src/lib/token.js`
- [x] `POST /auth/change-password` handler

---

### ~~PWD-1 · Request password reset token~~ ✅ Done

**Story:** As a user who forgot my password, I need to request a reset token so I can set a new password.

**Acceptance Criteria:**
- `POST /auth/forgot-password` with `{ email }` returns `{ resetToken }` directly in the response
- Always returns `200` whether or not email exists (prevent enumeration); token is `null` if email not found
- Reset token: short-lived JWT `{ sub: userId, purpose: "password-reset", exp: +1h }`

**Tasks:**
- [x] `issuePasswordResetToken(fastify, userId)` in `src/lib/token.js`
- [x] `POST /auth/forgot-password` handler

---

### ~~PWD-2 · Consume reset token~~ ✅ Done

**Story:** As a user, I need to set a new password using my reset token.

**Acceptance Criteria:**
- `POST /auth/reset-password` with `{ token, newPassword }` updates `password_hash`
- Token validated: valid signature, `purpose === "password-reset"`, not expired
- All active refresh tokens for the user are revoked on reset
- Returns `200`

**Tasks:**
- [x] Verify JWT, check `purpose` claim
- [x] `bcrypt.hash` new password + update DB row
- [x] Revoke all `refresh_tokens` for `user_id`

---

## EPIC-8 · Email Verification (SPIDR — Interface)

### EML-1 · Require email verification before login

**Story:** As the system, I need to confirm the user owns their email before allowing login.

**Acceptance Criteria:**
- On register, return a `verifyToken` in the response (same pattern as password reset — no email dependency)
- `GET /auth/verify?token=<token>` sets `emailVerifiedAt`
- Unverified users attempting login get `403 { message: "Email not verified" }`

**Tasks:**
- [ ] `emailVerifiedAt DateTime?` field + `prisma db push`
- [ ] Verification token: JWT `{ sub: userId, purpose: "email-verify" }`, TTL 24h
- [ ] `GET /auth/verify` handler
- [ ] Login handler checks `emailVerifiedAt`

---

## EPIC-9 · Authorization (SPIDR — Rules + Interface)

### AUTHZ-1 · Role-based route protection

**Story:** As the system, I need admin routes gated by role so regular users can't access them.

**Acceptance Criteria:**
- `role` column on `users` table (`user` | `admin`), default `user`
- `role` included in JWT payload
- `requireRole('admin')` hook returns `403` for non-admin
- Applied to `GET /admin/users`

**Tasks:**
- [ ] `role` column + migration
- [ ] `src/hooks/requireRole.js`
- [ ] `src/routes/admin.js` — `GET /admin/users`

---

### AUTHZ-2 · API key authentication (alternative interface)

**Story:** As a machine client, I need to authenticate via API key instead of JWT so scripts can call the API without a login flow.

**Acceptance Criteria:**
- `Authorization: ApiKey <key>` accepted on all protected routes alongside `Bearer`
- Keys stored hashed in `api_keys` table (`key_hash`, `user_id`, `name`, `revoked_at`)
- Keys can be created via `POST /api-keys` and revoked via `DELETE /api-keys/:id`

**Tasks:**
- [ ] `api_keys` table + migration
- [ ] `src/hooks/authenticate.js` — detect scheme, branch to JWT or API key validation
- [ ] `POST /api-keys`, `DELETE /api-keys/:id` routes

---

## Story Map

```
SKELETON (naive but real) ──────────────────────────────────────────────
  SKEL-1      SKEL-2        SKEL-3          SKEL-4        SKEL-5
  scaffold    register      login +         GET /me       logout
              (plaintext,   UUID session    (session
              in-memory)    (in-memory)     lookup)

HARDEN each piece independently ───────────────────────────────────────
  Passwords   DB            Sessions        Validation    Rate limit
  ─────────   ──────────    ──────────      ──────────    ──────────
  SEC-1       DB-1 spike    SES-1 JWT       VAL-1         RATE-1
  bcrypt      DB-2 users    SES-2 refresh
              DB-3 sessions

  Password Reset   Email Verify    Authorization
  ─────────────    ────────────    ─────────────
  PWD-1 request    EML-1           AUTHZ-1 RBAC
  PWD-2 consume                    AUTHZ-2 API keys
```

---

## Suggested Sprint Order

| Sprint | Stories | What changes |
|--------|---------|--------------|
| 0 | SKEL-1 → SKEL-5 | Fully working auth, naively implemented |
| 1 | DB-1 (spike), SEC-1, VAL-1 | Real passwords, real validation — still in-memory sessions |
| 2 | DB-2, DB-3 | Swap in-memory stores for DB, one at a time |
| 3 | SES-1, SES-2 | Upgrade session tokens to JWT + refresh rotation |
| 4 | RATE-1, PWD-1, PWD-2 | Rate limiting, password reset |
| 5 | EML-1, AUTHZ-1, AUTHZ-2 | Email verify, RBAC, API keys |

---

## Dependencies

```
fastify
@fastify/jwt          (SES-1)
@fastify/rate-limit   (RATE-1)
bcrypt                (SEC-1)
dotenv
no email dependency — reset/verify tokens returned in API responses
pg / prisma / drizzle (DB-1 spike decision)
```
