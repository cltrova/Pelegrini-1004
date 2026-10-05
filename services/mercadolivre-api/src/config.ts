import type { ApiConfig } from './app.js';

type Environment = Record<string, string | undefined>;

function readHttpsOrigin(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an HTTPS origin`);
  }

  if (url.protocol !== 'https:' || url.origin !== value.replace(/\/$/, '')) {
    throw new Error(`${name} must be an HTTPS origin`);
  }

  return url.origin;
}

export function loadConfig(env: Environment = process.env): ApiConfig {
  const port = Number(env.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const publicAppOrigin = readHttpsOrigin(env.PUBLIC_APP_ORIGIN, 'PUBLIC_APP_ORIGIN');
  const supabaseUrl = env.SUPABASE_URL?.trim() ?? '';
  if (supabaseUrl) readHttpsOrigin(supabaseUrl, 'SUPABASE_URL');

  const meliTokenEncryptionKey = env.MELI_TOKEN_ENCRYPTION_KEY?.trim() ?? '';
  if (meliTokenEncryptionKey) {
    const key = Buffer.from(meliTokenEncryptionKey, 'base64');
    if (key.length !== 32 || key.toString('base64') !== meliTokenEncryptionKey) {
      throw new Error('MELI_TOKEN_ENCRYPTION_KEY must encode 32 bytes');
    }
  }

  return {
    port,
    publicAppOrigin,
    supabaseUrl,
    supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',
    meliClientId: env.MELI_CLIENT_ID?.trim() ?? '',
    meliClientSecret: env.MELI_CLIENT_SECRET?.trim() ?? '',
    meliTokenEncryptionKey,
    sqlitePath: env.SQLITE_PATH?.trim() || '/data/mercadolivre.sqlite',
  };
}
