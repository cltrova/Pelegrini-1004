import { createHash, randomBytes } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import { authorizeChevroletRequest, type AuthorizationGatewayFactory } from './auth.js';
import type { ApiConfig } from './app.js';
import type { EcommerceDatabase } from './database.js';
import { decryptToken, encryptToken } from './crypto.js';

export const MERCADOLIVRE_REDIRECT_URI =
  'https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/oauth/callback';
const MERCADOLIVRE_AUTHORIZATION_URL = 'https://auth.mercadolivre.com.br/authorization';
const MERCADOLIVRE_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const MERCADOLIVRE_USER_URL = 'https://api.mercadolibre.com/users';
const CONNECTION_REDIRECT = 'https://www.pelegrini.t2a.ia.br/ecommerce/configuracoes?meli=connected';
const ERROR_REDIRECT = 'https://www.pelegrini.t2a.ia.br/ecommerce/configuracoes?meli=error';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
  scope?: string;
  token_type: string;
}

interface OAuthOptions {
  database: EcommerceDatabase;
  config: ApiConfig;
  fetch?: typeof fetch;
  authorizationGatewayFactory?: AuthorizationGatewayFactory;
}

function nowIso(): string {
  return new Date().toISOString();
}

function hashState(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

function configured(config: ApiConfig): boolean {
  return Boolean(
    config.supabaseUrl
      && config.supabasePublishableKey
      && config.meliClientId
      && config.meliClientSecret
      && config.meliTokenEncryptionKey,
  );
}

function parseTokenResponse(value: unknown): TokenResponse {
  if (!value || typeof value !== 'object') throw new Error('Invalid token response');
  const data = value as Record<string, unknown>;
  if (typeof data.access_token !== 'string' || !data.access_token
    || typeof data.refresh_token !== 'string' || !data.refresh_token
    || typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in)
    || data.expires_in <= 0 || typeof data.user_id !== 'number'
    || !Number.isSafeInteger(data.user_id) || typeof data.token_type !== 'string') {
    throw new Error('Invalid token response');
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    user_id: data.user_id,
    scope: typeof data.scope === 'string' ? data.scope : undefined,
    token_type: data.token_type,
  };
}

async function exchangeToken(
  config: ApiConfig,
  body: URLSearchParams,
  fetchImpl: typeof fetch,
): Promise<TokenResponse> {
  const response = await fetchImpl(MERCADOLIVRE_TOKEN_URL, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Mercado Livre token exchange failed');
  return parseTokenResponse(await response.json());
}

function saveConnection(
  db: EcommerceDatabase,
  config: ApiConfig,
  token: TokenResponse,
  nickname: string | null,
): void {
  const access = encryptToken(token.access_token, config.meliTokenEncryptionKey);
  const refresh = encryptToken(token.refresh_token, config.meliTokenEncryptionKey);
  const current = nowIso();
  const expires = new Date(Date.now() + token.expires_in * 1000).toISOString();
  db.transaction(() => {
    db.connection.prepare(`
      INSERT INTO connections (
        id, company_code, seller_id, nickname, status,
        access_token_ciphertext, access_token_nonce, access_token_tag,
        refresh_token_ciphertext, refresh_token_nonce, refresh_token_tag,
        expires_at, scopes, connected_at, updated_at
      ) VALUES (?, '10041', ?, ?, 'connected', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(company_code) DO UPDATE SET
        seller_id = excluded.seller_id,
        nickname = excluded.nickname,
        status = 'connected',
        access_token_ciphertext = excluded.access_token_ciphertext,
        access_token_nonce = excluded.access_token_nonce,
        access_token_tag = excluded.access_token_tag,
        refresh_token_ciphertext = excluded.refresh_token_ciphertext,
        refresh_token_nonce = excluded.refresh_token_nonce,
        refresh_token_tag = excluded.refresh_token_tag,
        expires_at = excluded.expires_at,
        scopes = excluded.scopes,
        connected_at = excluded.connected_at,
        updated_at = excluded.updated_at
    `).run(
      'chevrolet-mercadolivre', String(token.user_id), nickname,
      access.ciphertext, access.nonce, access.tag,
      refresh.ciphertext, refresh.nonce, refresh.tag,
      expires, JSON.stringify(token.scope?.split(' ').filter(Boolean) ?? []), current, current,
    );
  });
}

export async function refreshSellerToken(
  database: EcommerceDatabase,
  config: ApiConfig,
  sellerId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const row = database.connection.prepare(`
    SELECT refresh_token_ciphertext, refresh_token_nonce, refresh_token_tag
    FROM connections WHERE company_code = '10041' AND seller_id = ? AND status = 'connected'
  `).get(sellerId) as {
    refresh_token_ciphertext: string;
    refresh_token_nonce: string;
    refresh_token_tag: string;
  } | undefined;
  if (!row) throw new Error('Mercado Livre connection not found');

  const refreshToken = decryptToken({
    ciphertext: row.refresh_token_ciphertext,
    nonce: row.refresh_token_nonce,
    tag: row.refresh_token_tag,
    keyVersion: 1,
  }, config.meliTokenEncryptionKey);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.meliClientId,
    client_secret: config.meliClientSecret,
    refresh_token: refreshToken,
  });
  const token = await exchangeToken(config, body, fetchImpl);
  if (String(token.user_id) !== sellerId) throw new Error('Mercado Livre seller mismatch');

  const access = encryptToken(token.access_token, config.meliTokenEncryptionKey);
  const refresh = encryptToken(token.refresh_token, config.meliTokenEncryptionKey);
  database.transaction(() => {
    const result = database.connection.prepare(`
      UPDATE connections SET
        access_token_ciphertext = ?, access_token_nonce = ?, access_token_tag = ?,
        refresh_token_ciphertext = ?, refresh_token_nonce = ?, refresh_token_tag = ?,
        expires_at = ?, scopes = ?, updated_at = ?
      WHERE company_code = '10041' AND seller_id = ? AND status = 'connected'
    `).run(
      access.ciphertext, access.nonce, access.tag,
      refresh.ciphertext, refresh.nonce, refresh.tag,
      new Date(Date.now() + token.expires_in * 1000).toISOString(),
      JSON.stringify(token.scope?.split(' ').filter(Boolean) ?? []), nowIso(), sellerId,
    );
    if (result.changes !== 1) throw new Error('Mercado Livre connection changed during refresh');
  });
}

export async function registerOAuthRoutes(
  app: FastifyInstance,
  options: OAuthOptions,
): Promise<void> {
  const fetchImpl = options.fetch ?? fetch;
  const authenticate = async (request: Parameters<typeof authorizeChevroletRequest>[0]) =>
    authorizeChevroletRequest(request, options.config, options.authorizationGatewayFactory);

  app.post('/api/mercadolivre/oauth/start', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    if (!configured(options.config)) return reply.code(503).send({ error: 'not_configured' });
    try {
      const user = await authenticate(request);
      const state = randomBytes(32).toString('hex');
      const verifier = options.config.meliPkceEnabled
        ? randomBytes(32).toString('base64url')
        : null;
      const encryptedVerifier = verifier
        ? encryptToken(verifier, options.config.meliTokenEncryptionKey)
        : null;
      const challenge = verifier
        ? createHash('sha256').update(verifier).digest('base64url')
        : null;
      const createdAt = nowIso();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      options.database.connection.prepare('DELETE FROM oauth_states WHERE expires_at <= ?').run(createdAt);
      options.database.connection.prepare(`
        INSERT INTO oauth_states (
          state_hash, user_id, company_code, created_at, expires_at,
          pkce_verifier_ciphertext, pkce_verifier_nonce, pkce_verifier_tag
        ) VALUES (?, ?, '10041', ?, ?, ?, ?, ?)
      `).run(
        hashState(state), user.userId, createdAt, expiresAt,
        encryptedVerifier?.ciphertext ?? null,
        encryptedVerifier?.nonce ?? null,
        encryptedVerifier?.tag ?? null,
      );

      const authorizationUrl = new URL(MERCADOLIVRE_AUTHORIZATION_URL);
      const authorizationParams = new URLSearchParams({
        response_type: 'code',
        client_id: options.config.meliClientId,
        redirect_uri: MERCADOLIVRE_REDIRECT_URI,
        state,
      });
      if (challenge) {
        authorizationParams.set('code_challenge', challenge);
        authorizationParams.set('code_challenge_method', 'S256');
      }
      authorizationUrl.search = authorizationParams.toString();
      reply.header('cache-control', 'no-store');
      return { authorizationUrl: authorizationUrl.toString() };
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error
        ? Number(error.statusCode) : 503;
      return reply.code([401, 403, 503].includes(statusCode) ? statusCode : 503)
        .send({ error: statusCode === 401 ? 'unauthorized' : statusCode === 403 ? 'forbidden' : 'unavailable' });
    }
  });

  app.get('/api/mercadolivre/connection', async (request, reply) => {
    try {
      await authenticate(request);
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error
        ? Number(error.statusCode) : 503;
      return reply.code([401, 403, 503].includes(statusCode) ? statusCode : 503)
        .send({ error: statusCode === 401 ? 'unauthorized' : statusCode === 403 ? 'forbidden' : 'unavailable' });
    }

    const row = options.database.connection.prepare(`
      SELECT seller_id, nickname, status, expires_at, scopes, connected_at, last_sync_at
      FROM connections WHERE company_code = '10041'
    `).get() as {
      seller_id: string; nickname: string | null; status: string; expires_at: string;
      scopes: string; connected_at: string; last_sync_at: string | null;
    } | undefined;
    reply.header('cache-control', 'no-store');
    return {
      state: row?.status ?? 'disconnected',
      redirectUri: MERCADOLIVRE_REDIRECT_URI,
      connection: row ? {
        sellerId: row.seller_id,
        nickname: row.nickname,
        expiresAt: row.expires_at,
        scopes: JSON.parse(row.scopes) as string[],
        connectedAt: row.connected_at,
        lastSyncAt: row.last_sync_at,
      } : null,
      integration: configured(options.config) ? 'configured' : 'not_configured',
    };
  });

  app.get('/api/mercadolivre/oauth/callback', async (request, reply) => {
    const query = request.query as { code?: unknown; state?: unknown; error?: unknown };
    try {
      if (!configured(options.config) || typeof query.code !== 'string' || !query.code
        || typeof query.state !== 'string' || !/^[a-f0-9]{64}$/.test(query.state)) {
        throw new Error('Invalid OAuth callback');
      }
      const stateHash = hashState(query.state);
      const state = options.database.transaction(() => {
        const stored = options.database.connection.prepare(`
          SELECT user_id, company_code, expires_at,
            pkce_verifier_ciphertext, pkce_verifier_nonce, pkce_verifier_tag
          FROM oauth_states WHERE state_hash = ?
        `).get(stateHash) as {
          user_id: string;
          company_code: string;
          expires_at: string;
          pkce_verifier_ciphertext: string | null;
          pkce_verifier_nonce: string | null;
          pkce_verifier_tag: string | null;
        } | undefined;
        options.database.connection.prepare('DELETE FROM oauth_states WHERE state_hash = ?').run(stateHash);
        return stored;
      });
      if (!state || state.company_code !== '10041' || Date.parse(state.expires_at) <= Date.now()) {
        throw new Error('Invalid OAuth state');
      }

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: options.config.meliClientId,
        client_secret: options.config.meliClientSecret,
        code: query.code,
        redirect_uri: MERCADOLIVRE_REDIRECT_URI,
      });
      if (options.config.meliPkceEnabled) {
        if (!state.pkce_verifier_ciphertext || !state.pkce_verifier_nonce || !state.pkce_verifier_tag) {
          throw new Error('Missing PKCE verifier');
        }
        body.set('code_verifier', decryptToken({
          ciphertext: state.pkce_verifier_ciphertext,
          nonce: state.pkce_verifier_nonce,
          tag: state.pkce_verifier_tag,
          keyVersion: 1,
        }, options.config.meliTokenEncryptionKey));
      }
      const token = await exchangeToken(options.config, body, fetchImpl);
      const sellerResponse = await fetchImpl(`${MERCADOLIVRE_USER_URL}/${token.user_id}`, {
        headers: { authorization: `Bearer ${token.access_token}`, accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!sellerResponse.ok) throw new Error('Mercado Livre seller verification failed');
      const seller = await sellerResponse.json() as { id?: unknown; nickname?: unknown };
      if (String(seller.id) !== String(token.user_id)) throw new Error('Mercado Livre seller mismatch');
      saveConnection(
        options.database,
        options.config,
        token,
        typeof seller.nickname === 'string' ? seller.nickname : null,
      );
      return reply.redirect(CONNECTION_REDIRECT, 303);
    } catch {
      return reply.redirect(ERROR_REDIRECT, 303);
    }
  });
}
