# Mercado Livre VPS Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure Mercado Livre OAuth and notifications API as a separate Docker project on the existing Pelegrini Hostinger VPS, then connect the E-Commerce settings UI to it.

**Architecture:** A small Fastify/TypeScript service runs in its own Docker project with a persistent SQLite volume. It validates the system's existing Supabase session and caller-owned profile/role data, while Mercado Livre OAuth secrets and encrypted seller tokens stay on the VPS. The Vite frontend only calls the authenticated API and redirects the browser to the authorization URL.

**Tech Stack:** Node.js 24, TypeScript, Fastify, `@fastify/cors`, `@fastify/rate-limit`, `@supabase/supabase-js`, Node `node:sqlite`, Vitest, Docker Compose, Hostinger VPS, Cloudflare DNS/HTTPS as confirmed by inspection.

**Spec:** `docs/superpowers/specs/2026-10-05-mercadolivre-oauth-backend-design.md`

## Global Constraints

- Target only the Pelegrini application at `https://www.pelegrini.t2a.ia.br/` and Hostinger VPS `srv1694569.hstgr.cloud`.
- Create a new isolated project named `pelegrini-mercadolivre-api`; do not change, restart, reuse, mount, or route through existing projects, especially `caspper-portal`.
- Proposed API hostname is `ml-api.pelegrini.t2a.ia.br`; verify DNS authority and valid HTTPS before using it.
- Keep the E-Commerce integration exclusive to Chevrolet company `10041` and enforce current server-side profile/role authorization.
- Validate sessions with the existing Supabase Auth project and caller's RLS-limited reads; never put a Supabase service-role/secret key on the VPS.
- Keep Mercado Livre client secret, token encryption key, and seller tokens out of source, GitHub, Cloudflare frontend configuration, browser storage, responses, and logs.
- Encrypt tokens with AES-GCM; consume OAuth state once; rotate refresh-token pairs atomically.
- Webhook events must be persisted idempotently before HTTP 200; synchronization and listing/order API reads remain deferred.
- Do not expose a raw port or alter shared firewall/reverse-proxy routing. Stop if isolated HTTPS routing cannot be demonstrated.
- Do not change the existing Cloudflare Pages target or deploy this service to Caspper.

## Review Focus

- Missing/invalid Authorization header, expired Supabase session, or wrong company/role must be rejected before any OAuth state is created; test the auth guard and start route.
- Chevrolet/company identity forged in the request body must not change the fixed server-side company `10041`; test start and status routes.
- Expired, mismatched, and replayed OAuth state must fail without token persistence; test callback/state storage.
- Token encryption must use a fresh nonce, decrypt only with the configured key, and reject tampered ciphertext; test crypto/storage helpers.
- Duplicate or malformed notifications must not create duplicate events or receive success before durable persistence; test the webhook route.

---

### Task 1: Standalone VPS API foundation

**Files:**
- Create: `services/mercadolivre-api/package.json`
- Create: `services/mercadolivre-api/tsconfig.json`
- Create: `services/mercadolivre-api/src/app.ts`
- Create: `services/mercadolivre-api/src/config.ts`
- Create: `services/mercadolivre-api/src/app.test.ts`
- Create: `services/mercadolivre-api/Dockerfile`
- Create: `services/mercadolivre-api/.dockerignore`

**Interfaces:**
- `buildApp(config: ApiConfig, deps?: ApiDependencies): FastifyInstance`
- `ApiConfig` reads `PORT`, `PUBLIC_APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `MELI_CLIENT_ID`, `MELI_CLIENT_SECRET`, `MELI_TOKEN_ENCRYPTION_KEY`, and `SQLITE_PATH`.
- Health endpoint: `GET /health` returns only `{ status: "ok" | "not_configured" }` and never secrets.

- [ ] **Step 1: Write failing API foundation tests** for health response with and without Mercado Livre credentials, disallowed CORS origin, and method handling.
- [ ] **Step 2: Run tests to verify failure** with `npm run test -- --run services/mercadolivre-api/src/app.test.ts`.
- [ ] **Step 3: Implement Fastify app, strict config parsing, CORS allowlist, health endpoint, and Docker build** using Node 24 slim; bind the service only to the container interface and keep host exposure in Compose.
- [ ] **Step 4: Run tests and type/build checks** with the service scripts; expected all route tests pass and production TypeScript build succeeds.
- [ ] **Step 5: Commit** only the standalone API foundation files.

### Task 2: Existing-session authorization and persistent storage

**Files:**
- Create: `services/mercadolivre-api/src/auth.ts`
- Create: `services/mercadolivre-api/src/database.ts`
- Create: `services/mercadolivre-api/src/crypto.ts`
- Create: `services/mercadolivre-api/src/auth.test.ts`
- Create: `services/mercadolivre-api/src/database.test.ts`
- Create: `services/mercadolivre-api/src/crypto.test.ts`

**Interfaces:**
- `authorizeChevroletRequest(request, config): Promise<AuthorizedChevroletUser>` validates the bearer token with Supabase Auth, reads the caller's `profiles` and `user_roles` with that same token, and requires master role plus company `10041`.
- `createDatabase(path): EcommerceDatabase` initializes private service tables for connection, OAuth state, and notification inbox in the persistent SQLite file.
- `encryptToken(plaintext, key): EncryptedValue` and `decryptToken(value, key): string` use AES-256-GCM with a unique 12-byte nonce and authenticated ciphertext.

- [ ] **Step 1: Write failing tests** for valid/invalid session, non-master role, wrong company, DB initialization and transaction rollback, fresh nonces, round-trip decryption, and tampered ciphertext.
- [ ] **Step 2: Run tests to verify failure** with the matching service test paths.
- [ ] **Step 3: Implement the authorization guard, SQLite schema/transactions, and token encryption helpers.** Never trust request-supplied role, user, or company values.
- [ ] **Step 4: Run the tests and type-check**; expected all auth, data-isolation, and crypto tests pass.
- [ ] **Step 5: Commit** only auth, database, crypto, and tests.

### Task 3: OAuth start, callback, and token rotation

**Files:**
- Create: `services/mercadolivre-api/src/oauth.ts`
- Create: `services/mercadolivre-api/src/oauth.test.ts`
- Modify: `services/mercadolivre-api/src/app.ts`
- Modify: `services/mercadolivre-api/src/app.test.ts`

**Interfaces:**
- `POST /api/mercadolivre/oauth/start` accepts no company identity from the client and returns `{ authorizationUrl }` only after authorization and app-credential checks.
- `GET /api/mercadolivre/connection` uses the auth guard and returns `{ state, connection, integration }`, with no token fields.
- `GET /api/mercadolivre/oauth/callback?code=...&state=...` is public, consumes valid state once, performs the server-side token exchange, persists encrypted tokens, and redirects to the fixed Pelegrini settings route with a generic status.
- `refreshSellerToken(connectionId): Promise<void>` atomically stores the newly rotated access/refresh token pair and expiry.

- [ ] **Step 1: Write failing OAuth tests** for unconfigured credentials, auth rejection, state creation/binding/expiry/replay, fixed redirect URI, successful callback persistence, safe redirect, redacted failures, and atomic refresh rotation.
- [ ] **Step 2: Run tests to verify failure** with the OAuth service test paths.
- [ ] **Step 3: Implement OAuth URL generation and callback** with Authorization Code, exact configured callback URI, PKCE when enabled, single-use state, AES-GCM persistence, and generic safe errors. Add rate limiting to the start route.
- [ ] **Step 4: Run tests and type-check**; expected invalid states never persist tokens and successful paths never return token material.
- [ ] **Step 5: Commit** OAuth routes and tests.

### Task 4: Notifications inbox

**Files:**
- Create: `services/mercadolivre-api/src/notifications.ts`
- Create: `services/mercadolivre-api/src/notifications.test.ts`
- Modify: `services/mercadolivre-api/src/app.ts`
- Modify: `services/mercadolivre-api/src/app.test.ts`

**Interfaces:**
- `POST /api/mercadolivre/notifications` validates method, content type, payload size, configured application identity, and supported topic; it persists an idempotent inbox row before returning HTTP 200.
- Duplicate deliveries return HTTP 200 without inserting another row; malformed/unpersisted events return non-2xx.

- [ ] **Step 1: Write failing tests** for supported event, duplicate event, wrong application, unsupported topic, malformed payload, oversized body, and persistence failure.
- [ ] **Step 2: Run tests to verify failure** with the notifications service test path.
- [ ] **Step 3: Implement notification validation and transactional inbox insert**; do not fetch Mercado Livre resources or perform synchronization in this phase.
- [ ] **Step 4: Run tests and type-check**; expected duplicates are idempotent and only durable events receive 200.
- [ ] **Step 5: Commit** webhook route and tests.

### Task 5: Connect E-Commerce settings to the VPS API

**Files:**
- Modify: `src/modules/ecommerce/ecommerceTypes.ts`
- Modify: `src/modules/ecommerce/ecommerceService.ts`
- Modify: `src/modules/ecommerce/ecommerceService.test.ts`
- Modify: `src/pages/ecommerce/EcommerceIntegrationPage.tsx`
- Modify: `src/pages/ecommerce/EcommerceIntegrationPage.test.tsx`
- Modify: `src/hooks/useEcommerceData.ts`
- Modify: `src/hooks/useEcommerceData.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Add `startOAuth(context): Promise<{ authorizationUrl: string }>` to `EcommerceService`.
- The real frontend service gets the current session using `supabase.auth.getSession()`, sends its access token as a bearer token to `VITE_MERCADOLIVRE_API_URL`, and calls only OAuth-start and connection-status routes in this phase.
- Connect action redirects to the returned HTTPS authorization URL only when `canConnect` is true; no token is stored or returned in browser state.

- [ ] **Step 1: Write failing tests** for API base URL handling, authorization header presence, missing session, malformed/unsafe authorization URL, enabled/disabled connect states, and redirect behavior.
- [ ] **Step 2: Run tests to verify failure** with the named frontend test files.
- [ ] **Step 3: Implement the transport and settings action.** Keep overview/listings/orders in explicit `not_configured` states until the later read API phase.
- [ ] **Step 4: Run focused tests, full test suite, lint, and production build**; expected no frontend secret and no unrelated module changes.
- [ ] **Step 5: Commit** the E-Commerce API client and UI wiring.

### Task 6: Isolated VPS deployment and public HTTPS

**Files:**
- Create: `services/mercadolivre-api/docker-compose.yml`
- Create: `services/mercadolivre-api/DEPLOY.md`
- Modify: `services/mercadolivre-api/Dockerfile`
- Modify: `.env.example`

**Interfaces:**
- Docker project name: `pelegrini-mercadolivre-api` on `srv1694569.hstgr.cloud`.
- Proposed public base URL: `https://ml-api.pelegrini.t2a.ia.br`.
- Compose uses a dedicated persistent SQLite volume, health check, restart policy, non-root user, and bounded memory/CPU; do not attach existing project volumes or networks.
- OAuth and notification URLs are fixed to `/api/mercadolivre/oauth/callback` and `/api/mercadolivre/notifications`.

- [ ] **Step 1: Write deployment/config tests** that validate required secrets fail closed, no host port is exposed without the approved proxy route, and health check uses `/health`.
- [ ] **Step 2: Build and smoke-test the container locally** with no Mercado Livre credentials; expected health is `not_configured` and protected routes reject unauthenticated calls.
- [ ] **Step 3: Inspect authoritative DNS, current reverse proxy, Docker networks, resource headroom, and Hostinger project-creation options.** Do not write DNS/firewall/proxy settings at this step.
- [ ] **Step 4: Present the exact isolated Docker project, hostname/DNS target, HTTPS route, and any Hostinger/Cloudflare write to the user for action-time confirmation.** Stop if that routing would affect an existing project.
- [ ] **Step 5: After confirmation, create only the new Docker project and necessary DNS/HTTPS route.** Do not configure Mercado Livre secrets until the user has the app's credentials and enters them into the VPS's protected runtime settings.
- [ ] **Step 6: Verify live health over HTTPS, OAuth-start safe `not_configured` behavior, notification endpoint status handling, and all existing Docker projects remain unchanged.**
- [ ] **Step 7: Provide the exact live OAuth redirect URI and notification URL** for the Mercado Livre developer form; only then have the user register them and supply Client ID/secret directly to the VPS secret store.

