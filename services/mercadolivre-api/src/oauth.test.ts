import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from './app.js';
import { createDatabase } from './database.js';
import type { ApiConfig } from './app.js';
import type { AuthorizationGateway } from './auth.js';

const encryptionKey = Buffer.alloc(32, 7).toString('base64');
const config: ApiConfig = {
  port: 3000,
  publicAppOrigin: 'https://www.pelegrini.t2a.ia.br',
  supabaseUrl: 'https://auth.example.test',
  supabasePublishableKey: 'publishable-test',
  meliClientId: 'client-123',
  meliClientSecret: 'client-secret',
  meliTokenEncryptionKey: encryptionKey,
  sqlitePath: ':memory:',
};

function createGateway(): AuthorizationGateway {
  return {
    getUser: vi.fn().mockResolvedValue({ user: { id: 'master-user' }, error: null }),
    getProfile: vi.fn().mockResolvedValue({ profile: { cod_empresa_bi: '10041' }, error: null }),
    getRoles: vi.fn().mockResolvedValue({ roles: ['master'], error: null }),
  };
}

describe('Mercado Livre OAuth', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let db: ReturnType<typeof createDatabase> | undefined;

  afterEach(async () => {
    await app?.close();
    db?.close();
    app = undefined;
    db = undefined;
    vi.restoreAllMocks();
  });

  function createApp(overrides: Partial<ApiConfig> = {}, fetchImpl?: typeof fetch) {
    db = createDatabase(':memory:');
    app = buildApp({ ...config, ...overrides }, {
      database: db,
      authorizationGatewayFactory: () => createGateway(),
      fetch: fetchImpl,
    });
    return app;
  }

  it('rejects OAuth start when credentials are not configured', async () => {
    const server = createApp({ meliClientId: '', meliClientSecret: '' });
    const response = await server.inject({
      method: 'POST', url: '/api/mercadolivre/oauth/start',
      headers: { authorization: 'Bearer valid' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'not_configured' });
  });

  it('requires an authorized system session before creating OAuth state', async () => {
    const server = createApp();
    const response = await server.inject({ method: 'POST', url: '/api/mercadolivre/oauth/start' });
    expect(response.statusCode).toBe(401);
    expect(db?.connection.prepare('SELECT count(*) AS count FROM oauth_states').get())
      .toMatchObject({ count: 0 });
  });

  it('creates an authorization URL with a fixed callback and opaque state', async () => {
    const server = createApp();
    const response = await server.inject({
      method: 'POST', url: '/api/mercadolivre/oauth/start',
      headers: { authorization: 'Bearer valid' },
    });
    const authorizationUrl = new URL(response.json().authorizationUrl);
    expect(response.statusCode).toBe(200);
    expect(authorizationUrl.origin).toBe('https://auth.mercadolivre.com.br');
    expect(authorizationUrl.searchParams.get('client_id')).toBe('client-123');
    expect(authorizationUrl.searchParams.get('redirect_uri'))
      .toBe('https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/oauth/callback');
    expect(authorizationUrl.searchParams.get('state')).toHaveLength(64);
    expect(db?.connection.prepare('SELECT user_id, company_code FROM oauth_states').get())
      .toEqual({ user_id: 'master-user', company_code: '10041' });
    expect(response.body).not.toContain('client-secret');
  });

  it('uses PKCE only when enabled and keeps the verifier server-side', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-secret', refresh_token: 'refresh-secret',
        expires_in: 21600, user_id: 12345, scope: 'read', token_type: 'bearer',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 12345, nickname: 'CHEVROLET' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }));
    const server = createApp({ meliPkceEnabled: true }, fetchImpl as typeof fetch);
    const start = await server.inject({
      method: 'POST', url: '/api/mercadolivre/oauth/start',
      headers: { authorization: 'Bearer valid' },
    });
    const authorizationUrl = new URL(start.json().authorizationUrl);
    const state = authorizationUrl.searchParams.get('state')!;
    expect(authorizationUrl.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    const storedState = db?.connection.prepare('SELECT * FROM oauth_states').get() as Record<string, unknown>;
    expect(storedState.pkce_verifier_ciphertext).toBeTruthy();
    expect(JSON.stringify(storedState)).not.toContain('code_verifier');

    await server.inject({
      method: 'GET', url: `/api/mercadolivre/oauth/callback?code=one-time-code&state=${state}`,
    });
    const tokenRequest = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(new URLSearchParams(tokenRequest.body as string).get('code_verifier'))
      .toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('returns safe disconnected status without token data', async () => {
    const server = createApp();
    const response = await server.inject({
      method: 'GET', url: '/api/mercadolivre/connection',
      headers: { authorization: 'Bearer valid' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      state: 'disconnected',
      redirectUri: 'https://ml-api.pelegrini.t2a.ia.br/api/mercadolivre/oauth/callback',
      connection: null,
      integration: 'configured',
    });
    expect(response.body).not.toContain('token');
  });

  it('consumes valid state, exchanges code server-side, and stores encrypted tokens', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-secret', refresh_token: 'refresh-secret',
        expires_in: 21600, user_id: 12345, scope: 'read write', token_type: 'bearer',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 12345, nickname: 'CHEVROLET' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }));
    const server = createApp({}, fetchImpl as typeof fetch);
    const start = await server.inject({
      method: 'POST', url: '/api/mercadolivre/oauth/start',
      headers: { authorization: 'Bearer valid' },
    });
    const state = new URL(start.json().authorizationUrl).searchParams.get('state')!;
    const callback = await server.inject({
      method: 'GET', url: `/api/mercadolivre/oauth/callback?code=one-time-code&state=${state}`,
    });
    const stored = db?.connection.prepare('SELECT * FROM connections').get() as Record<string, unknown>;
    expect(callback.statusCode).toBe(303);
    expect(callback.headers.location).toBe('https://www.pelegrini.t2a.ia.br/ecommerce/configuracoes?meli=connected');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(stored)).not.toContain('access-secret');
    expect(JSON.stringify(stored)).not.toContain('refresh-secret');
    expect(stored.seller_id).toBe('12345');
    expect(stored.nickname).toBe('CHEVROLET');
    expect(db?.connection.prepare('SELECT count(*) AS count FROM oauth_states').get())
      .toMatchObject({ count: 0 });
    const replay = await server.inject({
      method: 'GET', url: `/api/mercadolivre/oauth/callback?code=replay-code&state=${state}`,
    });
    expect(replay.statusCode).toBe(303);
    expect(replay.headers.location).toBe('https://www.pelegrini.t2a.ia.br/ecommerce/configuracoes?meli=error');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects replayed or invalid state and never sends the code upstream', async () => {
    const fetchImpl = vi.fn();
    const server = createApp({}, fetchImpl as typeof fetch);
    const response = await server.inject({
      method: 'GET', url: '/api/mercadolivre/oauth/callback?code=private-code&state=invalid',
    });
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe('https://www.pelegrini.t2a.ia.br/ecommerce/configuracoes?meli=error');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(response.body).not.toContain('private-code');
  });

  it('rejects expired OAuth state before calling the Mercado Livre token endpoint', async () => {
    const fetchImpl = vi.fn();
    const server = createApp({}, fetchImpl as typeof fetch);
    const start = await server.inject({
      method: 'POST', url: '/api/mercadolivre/oauth/start',
      headers: { authorization: 'Bearer valid' },
    });
    const state = new URL(start.json().authorizationUrl).searchParams.get('state')!;
    db?.connection.prepare('UPDATE oauth_states SET expires_at = ?')
      .run(new Date(Date.now() - 1_000).toISOString());

    const callback = await server.inject({
      method: 'GET', url: `/api/mercadolivre/oauth/callback?code=expired-code&state=${state}`,
    });
    expect(callback.headers.location).toBe('https://www.pelegrini.t2a.ia.br/ecommerce/configuracoes?meli=error');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(db?.connection.prepare('SELECT count(*) AS count FROM connections').get())
      .toMatchObject({ count: 0 });
  });

  it('rotates both tokens atomically and exposes only safe connection fields', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-secret', refresh_token: 'refresh-secret',
        expires_in: 21600, user_id: 12345, scope: 'read write', token_type: 'bearer',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 12345, nickname: 'CHEVROLET' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }));
    const server = createApp({}, fetchImpl as typeof fetch);
    const start = await server.inject({
      method: 'POST', url: '/api/mercadolivre/oauth/start',
      headers: { authorization: 'Bearer valid' },
    });
    const state = new URL(start.json().authorizationUrl).searchParams.get('state')!;
    await server.inject({ method: 'GET', url: `/api/mercadolivre/oauth/callback?code=once&state=${state}` });

    const { refreshSellerToken } = await import('./oauth.js');
    await refreshSellerToken(db!, config, '12345', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'rotated-access', refresh_token: 'rotated-refresh', expires_in: 21600,
      user_id: 12345, scope: 'read write', token_type: 'bearer',
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch);

    const stored = db?.connection.prepare('SELECT * FROM connections').get() as Record<string, unknown>;
    expect(stored.access_token_ciphertext).not.toBe('access-secret');
    expect(stored.refresh_token_ciphertext).not.toBe('refresh-secret');
    expect(stored.updated_at).toBeTruthy();
  });

  it('keeps the saved token pair when Mercado Livre rejects refresh', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-before', refresh_token: 'refresh-before',
        expires_in: 21600, user_id: 12345, scope: 'read write', token_type: 'bearer',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 12345, nickname: 'CHEVROLET' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }));
    const server = createApp({}, fetchImpl as typeof fetch);
    const start = await server.inject({
      method: 'POST', url: '/api/mercadolivre/oauth/start',
      headers: { authorization: 'Bearer valid' },
    });
    const state = new URL(start.json().authorizationUrl).searchParams.get('state')!;
    await server.inject({ method: 'GET', url: `/api/mercadolivre/oauth/callback?code=once&state=${state}` });
    const before = db?.connection.prepare('SELECT * FROM connections').get();

    const { refreshSellerToken } = await import('./oauth.js');
    const rejectRefresh = vi.fn().mockResolvedValue(new Response('invalid_grant', { status: 400 }));
    await expect(refreshSellerToken(db!, config, '12345', rejectRefresh as typeof fetch))
      .rejects.toThrow('Mercado Livre token exchange failed');
    expect(db?.connection.prepare('SELECT * FROM connections').get()).toEqual(before);
  });
});
