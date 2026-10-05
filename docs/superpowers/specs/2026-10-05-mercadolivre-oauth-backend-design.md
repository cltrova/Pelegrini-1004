# Mercado Livre Backend on the Pelegrini VPS

## Goal

Connect the Casa do Chevrolet Mercado Livre account from E-Commerce settings, using a dedicated service on the existing Hostinger VPS. Keep seller tokens and Mercado Livre credentials on that VPS, and provide stable HTTPS callback URLs for the Mercado Livre developer form.

## Verified Context

- The correct application is Pelegrini, served at `https://www.pelegrini.t2a.ia.br/`.
- The active Hostinger VPS is `srv1694569.hstgr.cloud`, Ubuntu 24.04, KVM 1, 1 vCPU, 4 GB RAM, and 50 GB disk.
- The VPS has 15 Docker projects, including `caspper-portal` and other shared services. No Pelegrini Mercado Livre backend project is currently listed.
- Do not modify, restart, replace, or reuse `caspper-portal` or any existing Docker project.
- The Pelegrini app's current login and profile/role loading use Supabase Auth and its `profiles` / `user_roles` tables. Supabase remains the identity and authorization source; the integration API and its Mercado Livre data will live on the VPS.
- The production frontend configuration references Supabase project ref `jegjihccrjqakqdodcrj`. This ref is an identifier, not the user-facing project name. The authenticated app depends on that existing identity provider.
- Hostinger's Docker manager currently lists no Pelegrini project. The visible panel also offers a Traefik deployment, so HTTPS routing and DNS for a new API hostname must be checked before exposing the service.

## Selected Architecture

Create one small, separate Docker project named `pelegrini-mercadolivre-api` on `srv1694569.hstgr.cloud`. It must have its own container, persistent data volume, environment secrets, health check, resource limits, and deployment instructions. It must not join, mount, or change another project's containers or volumes.

Use a lightweight Node.js/TypeScript HTTP API and a dedicated SQLite database in the project's persistent volume. Encrypt Mercado Livre access and refresh tokens at the application layer with AES-GCM and a dedicated encryption key supplied only as a runtime secret. Keep OAuth states and a deduplicated notification inbox in the same database. Do not deploy a full self-hosted Supabase stack or a second shared database for this narrow service.

The API uses these routes:

1. `POST /api/mercadolivre/oauth/start` validates the current Pelegrini session and server-side authorization for the Chevrolet branch, creates a short-lived one-use OAuth state (and PKCE verifier/challenge if enabled), and returns the Mercado Livre authorization URL.
2. `GET /api/mercadolivre/connection` validates the current session and returns safe connection metadata only.
3. `GET /api/mercadolivre/oauth/callback` is public for Mercado Livre, validates and consumes state, exchanges the code server-side, stores encrypted tokens, and redirects to the Pelegrini settings page with a non-sensitive status marker.
4. `POST /api/mercadolivre/notifications` is public for Mercado Livre, validates the app identity and event contract, stores an idempotent event, and responds promptly. Event processing and data synchronization are later work.

The authenticated routes validate Supabase access tokens server-side using the existing project's Auth API, then read only the caller's profile and roles using that same user token and the publishable key, subject to the existing RLS policies. Do not place a Supabase service-role/secret key on the VPS for this integration. Never trust company, branch, role, or user identifiers supplied only by the browser. Restrict CORS to the verified Pelegrini origins, rate-limit OAuth start, and do not return Mercado Livre tokens to the frontend.

The target production hostname is proposed as `https://ml-api.pelegrini.t2a.ia.br`. This is not yet verified or configured. Before deployment, confirm DNS ownership/routing and HTTPS. Prefer an isolated Hostinger Docker project with HTTPS handled by a new/reused reverse-proxy configuration only if it can be added without changing routes or behavior of existing projects. If that isolation cannot be demonstrated, stop and ask before exposing a port or changing firewall/DNS.

URLs to register in Mercado Livre after the hostname is configured and service is deployed:

- OAuth redirect URI: `https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/oauth/callback`
- Notification callback URL: `https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/notifications`

The following route is called by the frontend and is not registered in Mercado Livre:

- `https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/oauth/start`
- `https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/connection`

These are proposed addresses, not live endpoints.

## Data and Secrets

- Runtime secrets: Mercado Livre client ID, client secret, and token-encryption key. Supabase project URL and publishable key are not secrets; use them with the caller's bearer token to verify the current system session and RLS-limited profile/role reads.
- Enter secrets only in the VPS project's protected runtime configuration; never place them in source, GitHub, Cloudflare frontend variables, a browser response, or chat.
- Persist only encrypted access/refresh tokens, non-sensitive seller/application metadata, hashed one-use OAuth states, and deduplicated notification records.
- Refresh tokens are single-use and rotate. Replace the access token, refresh token, and expiry atomically before considering refresh successful.
- Redact authorization codes, tokens, cookies, secrets, and raw callback query strings from all logs.
- Configure a backup for the project's persistent data volume and document restore steps before production OAuth is enabled.

## OAuth Flow

1. The settings UI sends its existing Supabase access token to the VPS API over HTTPS.
2. The API validates the token and checks the server-owned profile/role data for permission to manage the Chevrolet integration.
3. The API creates random, expiring, one-time state bound to the authenticated user and Chevrolet company, and returns an authorization URL using the fixed callback URI.
4. The browser navigates to Mercado Livre. Mercado Livre returns to the public callback.
5. The callback verifies and consumes state, exchanges the code server-side using the client secret and the exact registered redirect URI, encrypts the resulting tokens, and stores them for company `10041`.
6. The callback redirects to Pelegrini E-Commerce settings with a safe result. The UI calls the authenticated connection endpoint to render status.
7. Future protected data endpoints will refresh tokens server-side using the latest refresh token. This phase adds and tests the reusable rotation logic but does not call listing/order APIs.

The Mercado Livre application should use Authorization Code, Refresh Token, and PKCE if enabled for this app; disable Client Credentials for seller authorization; select Mercado Livre as the business unit; and grant only read permissions needed for the initial read-only order/shipment and listing/price screens.

## Notifications

- Register the callback only after it is deployed on the confirmed HTTPS hostname.
- Accept only topics required for the planned read-only screens.
- Validate application identity and any authentication mechanism required by Mercado Livre's current notification contract.
- Deduplicate by stable notification identifiers and/or a canonical topic/resource/application tuple.
- Persist before acknowledging with HTTP 200; return non-2xx when persistence fails so Mercado Livre can retry.
- Treat notifications as event hints, not authoritative data. Later processing fetches the resource using the seller token.

## Frontend Changes

- Replace the placeholder service with the configured VPS API base URL for OAuth start and connection status.
- Send the current Supabase access token only to the authenticated API routes over HTTPS.
- Enable Connect/Reconnect only after required server configuration and HTTPS health checks pass.
- Keep all Mercado Livre integration inside E-Commerce > Configurações > Mercado Livre.
- Display connected/disconnected/error states without tokens, client secrets, or raw callback parameters.
- Keep the rest of Pelegrini auth, Supabase, Cloudflare Pages deployment, and other modules unchanged.

## Failure Handling

- Missing Mercado Livre credentials return controlled `not_configured` status and do not initiate OAuth.
- Invalid, expired, mismatched, or replayed OAuth state fails closed and redirects with a generic error code.
- Token exchange errors are logged only after sensitive fields are removed and stored as a safe connection error status.
- Notification persistence failures return non-2xx to enable retry.
- The API binds only to the intended internal Docker network/port; public HTTPS is routed only for its chosen hostname. No broad firewall opening or shared reverse-proxy modification without separate review.
- Health checks and deployment rollback affect only the new project.

## Acceptance Criteria

1. The registered URLs use a hostname verified to route to the Pelegrini VPS over valid HTTPS.
2. The OAuth start and connection routes validate the existing session and enforce Chevrolet integration permission server-side.
3. Invalid, expired, or reused state is rejected and no token is stored on failure.
4. Credentials and seller tokens never appear in frontend responses, browser storage, source files, or logs.
5. Tokens are encrypted at rest in a persistent volume with documented backups.
6. A valid callback stores the connection and returns the browser to Pelegrini settings with a safe status.
7. Refresh replaces the single-use refresh token atomically.
8. Notifications are persisted idempotently before prompt HTTP 200 acknowledgement.
9. The service is a separate Docker project and does not alter, restart, mount, or route traffic through `caspper-portal` or other existing projects.
10. Missing app secrets leave the integration explicitly not configured.
11. No Cloudflare/GitHub frontend deployment or existing Pelegrini module is changed except the E-Commerce settings connection needed for this API.

## References

- [Mercado Livre OAuth and tokens](https://developers.mercadolivre.com.br/pt_br/mensagens-post-venda/autenticacao-e-autorizacao)
- [Mercado Livre notifications](https://developers.mercadolivre.com.br/pt_br/descricao-de-produtos/produto-receba-notificacoes)
- [Supabase Auth user verification](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Hostinger Docker applications and SSL](https://www.hostinger.com/changelog/docker-applications-now-include-auto-ssl)
