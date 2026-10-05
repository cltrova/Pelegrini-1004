import { createHash } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import type { ApiConfig } from './app.js';
import type { EcommerceDatabase } from './database.js';

const SUPPORTED_TOPICS = new Set(['orders_v2', 'items', 'shipments']);

interface MercadoLivreNotification {
  _id?: unknown;
  id?: unknown;
  topic?: unknown;
  resource?: unknown;
  user_id?: unknown;
  application_id?: unknown;
  attempts?: unknown;
  sent?: unknown;
  received?: unknown;
  actions?: unknown;
}

function validId(value: unknown): value is string | number {
  return (typeof value === 'string' && value.length > 0 && value.length <= 128)
    || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0);
}

function validResource(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 2048
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\')
    && !/(?:^|\/)(?:\.\.|%2e%2e)(?:\/|$)/i.test(value)
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function eventKey(event: MercadoLivreNotification): string {
  const stableId = event._id ?? event.id;
  if (validId(stableId)) return `id:${stableId}`;
  return createHash('sha256').update([
    event.application_id, event.user_id, event.topic, event.resource, event.sent ?? '',
  ].join('\n')).digest('hex');
}

function safePayload(event: MercadoLivreNotification): Record<string, unknown> {
  const allowed = ['_id', 'id', 'topic', 'resource', 'user_id', 'application_id', 'attempts', 'sent', 'received', 'actions'] as const;
  return Object.fromEntries(allowed
    .filter((key) => event[key] !== undefined)
    .map((key) => [key, event[key]]));
}

export function registerNotificationRoute(
  app: FastifyInstance,
  database: EcommerceDatabase,
  config: ApiConfig,
): void {
  app.post('/api/mercadolivre/notifications', async (request, reply) => {
    if (!config.meliClientId) return reply.code(503).send({ error: 'not_configured' });
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      return reply.code(415).send({ error: 'unsupported_media_type' });
    }

    const event = request.body as MercadoLivreNotification | null;
    if (!event || typeof event !== 'object' || Array.isArray(event)
      || typeof event.topic !== 'string' || !SUPPORTED_TOPICS.has(event.topic)
      || !validResource(event.resource) || !validId(event.user_id)
      || !validId(event.application_id)) {
      return reply.code(400).send({ error: 'invalid_notification' });
    }
    if (String(event.application_id) !== config.meliClientId) {
      return reply.code(403).send({ error: 'application_mismatch' });
    }
    if (event._id !== undefined && !validId(event._id)
      || event.id !== undefined && !validId(event.id)
      || event.sent !== undefined && typeof event.sent !== 'string'
      || event.actions !== undefined && (!Array.isArray(event.actions)
        || event.actions.some((action) => typeof action !== 'string'))) {
      return reply.code(400).send({ error: 'invalid_notification' });
    }

    try {
      const key = eventKey(event);
      database.connection.prepare(`
        INSERT INTO notification_inbox (
          event_key, topic, resource, seller_id, application_id, payload_json, received_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_key) DO NOTHING
      `).run(
        key,
        event.topic,
        event.resource,
        String(event.user_id),
        String(event.application_id),
        JSON.stringify(safePayload(event)),
        new Date().toISOString(),
      );
      reply.header('cache-control', 'no-store');
      return reply.code(200).send({ received: true });
    } catch {
      return reply.code(503).send({ error: 'notification_not_persisted' });
    }
  });
}
