import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { createDatabase } from './database.js';
import type { ApiConfig } from './app.js';

const config: ApiConfig = {
  port: 3000,
  publicAppOrigin: 'https://www.pelegrini.t2a.ia.br',
  supabaseUrl: 'https://auth.example.test',
  supabasePublishableKey: 'publishable-test',
  meliClientId: '123456',
  meliClientSecret: 'secret',
  meliTokenEncryptionKey: Buffer.alloc(32, 1).toString('base64'),
  sqlitePath: ':memory:',
};

describe('Mercado Livre notifications', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let db: ReturnType<typeof createDatabase> | undefined;

  afterEach(async () => {
    await app?.close();
    db?.close();
    app = undefined;
    db = undefined;
  });

  function createApp(overrides: Partial<ApiConfig> = {}) {
    db = createDatabase(':memory:');
    app = buildApp({ ...config, ...overrides }, { database: db });
    return app;
  }

  const event = {
    _id: 'event-1',
    topic: 'orders_v2',
    resource: '/orders/12345',
    user_id: 123,
    application_id: 123456,
    attempts: 1,
  };

  it('persists a supported event before acknowledging it', async () => {
    const server = createApp();
    const response = await server.inject({
      method: 'POST', url: '/api/mercadolivre/notifications', payload: event,
    });
    expect(response.statusCode).toBe(200);
    expect(db?.connection.prepare('SELECT topic, resource, seller_id, application_id FROM notification_inbox').get())
      .toEqual({ topic: 'orders_v2', resource: '/orders/12345', seller_id: '123', application_id: '123456' });
  });

  it('acknowledges duplicate deliveries without storing another row', async () => {
    const server = createApp();
    await server.inject({ method: 'POST', url: '/api/mercadolivre/notifications', payload: event });
    const response = await server.inject({ method: 'POST', url: '/api/mercadolivre/notifications', payload: event });
    expect(response.statusCode).toBe(200);
    expect(db?.connection.prepare('SELECT count(*) AS count FROM notification_inbox').get())
      .toMatchObject({ count: 1 });
  });

  it('rejects events for another application', async () => {
    const server = createApp();
    const response = await server.inject({
      method: 'POST', url: '/api/mercadolivre/notifications',
      payload: { ...event, application_id: 654321 },
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects unsupported topics and unsafe resource paths', async () => {
    const server = createApp();
    const unsupported = await server.inject({
      method: 'POST', url: '/api/mercadolivre/notifications',
      payload: { ...event, topic: 'payments' },
    });
    const unsafe = await server.inject({
      method: 'POST', url: '/api/mercadolivre/notifications',
      payload: { ...event, _id: 'event-2', resource: 'https://attacker.example/data' },
    });
    expect(unsupported.statusCode).toBe(400);
    expect(unsafe.statusCode).toBe(400);
  });

  it('rejects malformed payloads and oversized bodies', async () => {
    const server = createApp();
    const malformed = await server.inject({
      method: 'POST', url: '/api/mercadolivre/notifications', payload: { topic: 'orders_v2' },
    });
    const oversized = await server.inject({
      method: 'POST', url: '/api/mercadolivre/notifications',
      payload: { ...event, padding: 'x'.repeat(40_000) },
    });
    expect(malformed.statusCode).toBe(400);
    expect(oversized.statusCode).toBe(413);
  });

  it('fails closed when persistence fails', async () => {
    const server = createApp();
    db!.connection.exec('DROP TABLE notification_inbox');
    const response = await server.inject({
      method: 'POST', url: '/api/mercadolivre/notifications', payload: event,
    });
    expect(response.statusCode).toBe(503);
  });
});
