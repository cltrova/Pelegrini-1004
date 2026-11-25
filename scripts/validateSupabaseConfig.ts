import { Buffer } from 'node:buffer';

function isAnonKey(key: string, hostname: string): boolean {
  const parts = key.split('.');
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return false;

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const hostedRef = hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
    return typeof header.alg === 'string' && Boolean(header.alg) && header.alg !== 'none'
      && payload.role === 'anon' && typeof payload.ref === 'string' && Boolean(payload.ref)
      && (!hostedRef || payload.ref === hostedRef);
  } catch {
    return false;
  }
}

export function assertProductionSupabaseConfig(env: Record<string, string | undefined>): void {
  const urlValue = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const fail = (): never => {
    throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY com o endereço e a chave pública do serviço de contas antes de gerar o build de produção.');
  };

  if (!urlValue || !key || key !== key.trim() || urlValue !== urlValue.trim()) return fail();

  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return fail();
  }

  const nonProductionHost = /^(?:(?:localhost|example|your-project|placeholder)(?:\.|$)|127\.|0\.0\.0\.0$|\[::1\]$)/i;
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || url.pathname !== '/' || nonProductionHost.test(url.hostname)) return fail();

  const exampleKey = /^sb_publishable_(?:your|example|placeholder|replace|changeme)(?:[_-]|$)/i;
  const publishableKey = /^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(key) && !exampleKey.test(key);
  if (!publishableKey && !isAnonKey(key, url.hostname)) return fail();
}
