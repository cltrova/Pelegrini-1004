import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

import type { AuthorizationGatewayFactory } from './auth.js';
import { createDatabase, type EcommerceDatabase } from './database.js';
import { registerNotificationRoute } from './notifications.js';
import { registerOAuthRoutes } from './oauth.js';

export interface ApiConfig {
  port: number;
  publicAppOrigin: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  meliClientId: string;
  meliClientSecret: string;
  meliTokenEncryptionKey: string;
  meliPkceEnabled?: boolean;
  sqlitePath: string;
}

export interface ApiDependencies {
  database?: EcommerceDatabase;
  authorizationGatewayFactory?: AuthorizationGatewayFactory;
  fetch?: typeof fetch;
}

export function buildApp(config: ApiConfig, deps: ApiDependencies = {}) {
  const app = Fastify({
    bodyLimit: 32 * 1024,
    logger: {
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.url'],
        censor: '[REDACTED]',
      },
    },
  });

  void app.register(cors, {
    origin: (origin, callback) => {
      const hostname = new URL(config.publicAppOrigin).hostname;
      const alternateHostname = hostname.startsWith('www.')
        ? hostname.slice(4)
        : `www.${hostname}`;
      const allowed = origin === config.publicAppOrigin
        || origin === `https://${alternateHostname}`;
      callback(null, allowed);
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['authorization', 'content-type'],
    credentials: false,
    maxAge: 600,
  });

  const database = deps.database ?? createDatabase(config.sqlitePath);
  if (!deps.database) app.addHook('onClose', async () => database.close());
  void app.register(rateLimit, { global: false, max: 5, timeWindow: '1 minute' });
  void registerOAuthRoutes(app, {
    database,
    config,
    fetch: deps.fetch,
    authorizationGatewayFactory: deps.authorizationGatewayFactory,
  });
  registerNotificationRoute(app, database, config);

  app.get('/health', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    const configured = Boolean(
      config.supabaseUrl
        && config.supabasePublishableKey
        && config.meliClientId
        && config.meliClientSecret
        && config.meliTokenEncryptionKey,
    );
    return { status: configured ? 'ok' : 'not_configured' };
  });

  return app;
}
