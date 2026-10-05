# Deploy: Pelegrini Mercado Livre API

Target: `srv1694569.hstgr.cloud`, as a new project named `pelegrini-mercadolivre-api`.

This service is exclusively for the Pelegrini / Casa do Chevrolet company (`10041`). It must not reuse or join any existing Docker project, including `caspper-portal`.

## Required runtime values

Create a protected `.env` beside `docker-compose.yml` in the VPS project. Do not commit or upload it to the Git repository.

```dotenv
PUBLIC_APP_ORIGIN=https://pelegrini.t2a.ia.br
SUPABASE_URL=https://jegjihccrjqakqdodcrj.supabase.co
SUPABASE_PUBLISHABLE_KEY=<existing Pelegrini publishable key>
MELI_CLIENT_ID=<Mercado Livre application ID>
MELI_CLIENT_SECRET=<Mercado Livre application secret>
MELI_TOKEN_ENCRYPTION_KEY=<base64 encoding of 32 random bytes>
MELI_PKCE_ENABLED=false
```

Generate the encryption key on a trusted machine with:

```sh
openssl rand -base64 32
```

Set `MELI_PKCE_ENABLED=true` only if PKCE is enabled in the Mercado Livre application settings.

Enter the values only in the VPS's protected project environment settings. Do not use a Supabase service-role key. Restrict the environment file to the project owner (`0600`) if the panel provides file-based environment configuration.

## Network and HTTPS

The Compose project intentionally publishes no host port and creates its own Docker bridge. Do not connect it to an existing project's network or volume. Do not change the shared firewall or reverse proxy until Hostinger's isolated domain-routing mechanism has been confirmed.

The planned API hostname is `ml-api.pelegrini.t2a.ia.br`, but it currently has no DNS record. Before assigning it, inspect the authoritative DNS zone and the VPS's current ingress. Route only this project to container port `3000`, with a valid HTTPS certificate. The frontend origins are the Pelegrini apex and `www` host only.

After HTTPS is live, configure the Mercado Livre application's exact redirect URI:

`https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/oauth/callback`

Notification URL:

`https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/notifications`

The notification route accepts `orders_v2`, `items`, and `shipments` for the configured application ID. It stores idempotently and does not yet synchronize product or order data.

## Storage and checks

`mercadolivre_data` is the project's only data volume. It contains SQLite records and encrypted Mercado Livre access/refresh tokens. Back up this volume using Hostinger's project-level backup facility before enabling OAuth; test restoration into a separate, non-production volume first.

Verify `/health` over the final HTTPS hostname. Without Mercado Livre secrets it reports `not_configured`; with valid secrets it reports `ok`. The status response never includes secret material. Verify OAuth start rejects unauthenticated callers and notification POST rejects a different `application_id`.

To roll back, stop only `pelegrini-mercadolivre-api` and restore only its image/configuration. Never remove its volume unless a separate, explicit data-deletion approval is obtained.
