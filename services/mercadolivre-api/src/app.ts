import Fastify from 'fastify';
import cors from '@fastify/cors';

export interface ApiConfig {
  port: number;
  publicAppOrigin: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  meliClientId: string;
  meliClientSecret: string;
  meliTokenEncryptionKey: string;
  sqlitePath: string;
}

export interface ApiDependencies {}

export function buildApp(config: ApiConfig, _deps: ApiDependencies = {}) {
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
    origin: (origin, callback) => callback(null, origin === config.publicAppOrigin),
    methods: ['GET', 'POST'],
    allowedHeaders: ['authorization', 'content-type'],
    credentials: false,
    maxAge: 600,
  });

  app.get('/health', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    const configured = Boolean(
      config.meliClientId && config.meliClientSecret && config.meliTokenEncryptionKey,
    );
    return { status: configured ? 'ok' : 'not_configured' };
  });

  return app;
}
