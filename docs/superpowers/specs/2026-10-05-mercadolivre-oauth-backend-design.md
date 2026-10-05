# Mercado Livre OAuth Backend Design

## Goal

Allow an authorized Casa do Chevrolet user to connect the store's Mercado Livre account from E-Commerce settings, and provide stable HTTPS URLs for the OAuth redirect and notification callback. Keep application credentials and seller tokens on the server, never in the browser.

## Current Context

- The Pelegrini frontend is a Vite application deployed through GitHub to Cloudflare Pages.
- The repository already uses Supabase Edge Functions and has project ref `jegjihccrjqakqdodcrj`.
- The E-Commerce frontend currently reports `not_configured`; its Connect button is disabled and it makes no Mercado Livre requests.
- The existing Cloudflare Pages function is a data proxy and is not an OAuth or credential store.
- The initial E-Commerce screens are read-only. Listing/order mutations and synchronization workers are outside this phase.

## Selected Architecture

Use Supabase Edge Functions for the server-side endpoints, following the existing repository's backend pattern. This keeps the callbacks next to the existing Supabase project and gives the functions access to the project's database and secrets. Do not route OAuth secrets or tokens through the Vite bundle or the generic Cloudflare proxy.

Create four independently routed functions:

1. `mercadolivre-oauth-start` accepts an authenticated request from E-Commerce settings, verifies the caller has access to the Chevrolet branch and permission to manage its integration, creates a short-lived one-use OAuth state, and returns the Mercado Livre authorization URL. The authenticated frontend then navigates to that URL.
2. `mercadolivre-connection-status` accepts authenticated status requests and returns only safe connection metadata, never tokens or secrets.
3. `mercadolivre-oauth-callback` is public because Mercado Livre calls it. It validates the state, exchanges the authorization code server-side, encrypts and stores access/refresh tokens, then redirects to the Pelegrini settings page with a non-sensitive connection result.
4. `mercadolivre-notifications` is public because Mercado Livre calls it. It validates the configured application identity and notification structure, stores an idempotent event record, and acknowledges promptly. Background processing and data synchronization are explicitly deferred.

Stable production URLs to register:

- OAuth redirect URI: `https://jegjihccrjqakqdodcrj.supabase.co/functions/v1/mercadolivre-oauth-callback`
- Notification callback URL: `https://jegjihccrjqakqdodcrj.supabase.co/functions/v1/mercadolivre-notifications`

The OAuth-start URL is an internal frontend endpoint and is not registered in Mercado Livre:

- `https://jegjihccrjqakqdodcrj.supabase.co/functions/v1/mercadolivre-oauth-start`
- `https://jegjihccrjqakqdodcrj.supabase.co/functions/v1/mercadolivre-connection-status`

## Data and Secret Handling

- Add a non-exposed `private` schema with tables for the Chevrolet connection, one-use OAuth states, and received notification events.
- Enable RLS on every new table and grant no direct access to `anon` or `authenticated`; only trusted Edge Functions may use the privileged server key after authorization checks.
- Encrypt access and refresh token values with AES-GCM using a dedicated key stored as a Supabase Edge Function secret. Store ciphertext, nonce, key version, expiry, and seller/application identifiers only.
- Store `MELI_CLIENT_ID`, `MELI_CLIENT_SECRET`, and the token-encryption key as Supabase Edge Function secrets, never in `.env.local`, the repository, browser storage, or client-visible environment variables.
- Store only a hash of the OAuth `state`, bind it to the initiating user and Chevrolet company, expire it quickly, and consume it once.
- Refresh tokens are single-use and rotate: persist each new refresh token atomically with its access token and expiry before considering the refresh complete.
- Do not log authorization codes, tokens, client secrets, or raw sensitive callback query strings.

## OAuth Flow

1. The authenticated frontend invokes `mercadolivre-oauth-start`; the function checks the session and server-side Chevrolet access before initiating authorization.
2. The function creates and stores a random one-time state, plus PKCE verifier/challenge when PKCE is enabled for the Mercado Livre app, and returns the authorization URL to the frontend.
3. The frontend navigates to the Brazil Mercado Livre authorization endpoint using the registered fixed redirect URI and state.
4. Mercado Livre redirects to `mercadolivre-oauth-callback` with the authorization code and state.
5. The callback validates and consumes state, exchanges the code server-side using the client secret and the exact registered redirect URI, encrypts the resulting tokens, and stores the connection for company `10041`.
6. The callback redirects to `/ecommerce/configuracoes` with a status marker only. The UI obtains connection status from `mercadolivre-connection-status`; it never receives tokens.
7. Refresh runs server-side when protected API work needs a valid access token, uses the latest refresh token exactly once, and stores the rotated pair.

The app configuration is expected to enable Authorization Code, Refresh Token, and PKCE; disable Client Credentials for this seller-authorized flow; select Mercado Livre; and grant only read access needed for users, orders/shipments, and listings/prices. The actual API calls are not part of this phase.

## Notifications

- Configure the stable notification callback URL above only after the function is deployed.
- Accept only the notification topics required for future read-only order/listing updates.
- Validate the application's identity and any signature/authentication mechanism required by Mercado Livre's current notification contract.
- Deduplicate deliveries using stable notification identifiers and/or the canonical topic/resource/application tuple.
- Persist the event before acknowledging it; respond HTTP 200 promptly and defer API lookups or synchronization to a later worker phase.
- Do not treat the callback as proof of event contents; fetch the authoritative resource with the seller access token in a later processing phase.

## Frontend Changes

- Replace the placeholder not-configured service with calls to protected Supabase Edge Functions for connection status and OAuth start.
- Enable the Connect/Reconnect control only when server-side app credentials are configured.
- Show connected/disconnected/error states without exposing token values, client secret, or raw OAuth callback parameters.
- Keep the integration inside E-Commerce > Configurações > Mercado Livre.

## Failure Handling

- Missing application secrets produce a controlled `not_configured` response and never a partial authorization redirect.
- Missing, expired, mismatched, or replayed state fails closed and redirects back with a generic error code.
- Mercado Livre token exchange errors are logged with sensitive fields removed and saved as a safe connection error status.
- Notification persistence failures return a non-2xx response so Mercado Livre can retry; successful persistence receives HTTP 200.
- Invalid methods and malformed payloads return appropriate 4xx responses without exposing internal errors.

## Acceptance Criteria

1. The Mercado Livre developer form can use the two stable HTTPS callback URLs listed above.
2. OAuth start is authenticated and enforces Chevrolet access server-side.
3. Callback rejects invalid, expired, or replayed state and does not persist tokens on failure.
4. Client secret, access token, and refresh token never appear in frontend responses, browser storage, source files, or logs.
5. Tokens are encrypted at rest, and the new tables cannot be accessed through the public Supabase Data API.
6. A valid callback stores a connection and returns the user to E-Commerce settings with a safe status.
7. Refresh rotates and replaces the single-use refresh token atomically.
8. The notification endpoint persists a deduplicated event and returns HTTP 200 promptly.
9. Missing secrets leave the UI in an explicit not-configured state.
10. Existing Pelegrini modules and the separate Caspper project remain untouched.

## References

- [Mercado Livre OAuth and tokens](https://developers.mercadolivre.com.br/pt_br/mensagens-post-venda/autenticacao-e-autorizacao)
- [Mercado Livre notifications](https://developers.mercadolivre.com.br/pt_br/descricao-de-produtos/produto-receba-notificacoes)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase securing data](https://supabase.com/docs/guides/database/secure-data)
