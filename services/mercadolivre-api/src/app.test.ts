import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

describe('Mercado Livre API foundation', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('reports not configured without Mercado Livre credentials', async () => {
    app = buildApp({
      port: 3000,
      publicAppOrigin: 'https://www.pelegrini.t2a.ia.br',
      supabaseUrl: 'https://auth.example.test',
      supabasePublishableKey: 'publishable-test',
      meliClientId: '',
      meliClientSecret: '',
      meliTokenEncryptionKey: '',
      sqlitePath: ':memory:',
    });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'not_configured' });
  });

  it('reports ready without exposing credentials when configured', async () => {
    app = buildApp({
      port: 3000,
      publicAppOrigin: 'https://www.pelegrini.t2a.ia.br',
      supabaseUrl: 'https://auth.example.test',
      supabasePublishableKey: 'publishable-test',
      meliClientId: 'meli-client-test',
      meliClientSecret: 'must-not-leak',
      meliTokenEncryptionKey: Buffer.alloc(32).toString('base64'),
      sqlitePath: ':memory:',
    });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(response.body).not.toContain('must-not-leak');
  });

  it('does not report a ready service without the existing Pelegrini auth configuration', async () => {
    app = buildApp({
      port: 3000,
      publicAppOrigin: 'https://www.pelegrini.t2a.ia.br',
      supabaseUrl: '',
      supabasePublishableKey: '',
      meliClientId: 'meli-client-test',
      meliClientSecret: 'must-not-leak',
      meliTokenEncryptionKey: Buffer.alloc(32).toString('base64'),
      sqlitePath: ':memory:',
    });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.json()).toEqual({ status: 'not_configured' });
    expect(response.body).not.toContain('must-not-leak');
  });

  it('does not grant CORS access to an unlisted origin', async () => {
    app = buildApp({
      port: 3000,
      publicAppOrigin: 'https://www.pelegrini.t2a.ia.br',
      supabaseUrl: 'https://auth.example.test',
      supabasePublishableKey: 'publishable-test',
      meliClientId: '',
      meliClientSecret: '',
      meliTokenEncryptionKey: '',
      sqlitePath: ':memory:',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://caspper.t2a.ia.br' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows the Pelegrini apex host used by the live app', async () => {
    app = buildApp({
      port: 3000,
      publicAppOrigin: 'https://www.pelegrini.t2a.ia.br',
      supabaseUrl: 'https://auth.example.test',
      supabasePublishableKey: 'publishable-test',
      meliClientId: '',
      meliClientSecret: '',
      meliTokenEncryptionKey: '',
      sqlitePath: ':memory:',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://pelegrini.t2a.ia.br' },
    });

    expect(response.headers['access-control-allow-origin']).toBe('https://pelegrini.t2a.ia.br');
  });

  it('rejects unsupported methods for known routes', async () => {
    app = buildApp({
      port: 3000,
      publicAppOrigin: 'https://www.pelegrini.t2a.ia.br',
      supabaseUrl: 'https://auth.example.test',
      supabasePublishableKey: 'publishable-test',
      meliClientId: '',
      meliClientSecret: '',
      meliTokenEncryptionKey: '',
      sqlitePath: ':memory:',
    });

    const response = await app.inject({ method: 'POST', url: '/health' });

    expect(response.statusCode).toBe(404);
  });
});
