export type PortalModule =
  | 'modulo_comercial'
  | 'modulo_dre'
  | 'modulo_operacional'
  | 'modulo_resumo'
  | 'modulo_variacao'
  | 'modulo_whatsapp';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bearerPattern = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i;
const companyCodes = new Set<unknown>(['1004', '10041', 1004, 10041]);
const maxPortalBodyBytes = 64 * 1024;
const portalTimeoutMs = 5_000;
type PortalFailure = 401 | 403 | 503;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function singleRow(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value) && value.length === 1 && isRecord(value[0])) return value[0];
}

function portalOrigin(configuredUrl: string | undefined): URL | null {
  const url = configuredUrl && URL.parse(configuredUrl);
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.href !== `${url.origin}/`) return null;
  return url;
}

async function readPortalJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Missing portal response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let raw = '';
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) return JSON.parse(raw + decoder.decode());
      bytes += part.value.byteLength;
      if (bytes > maxPortalBodyBytes) throw new Error('Portal response exceeds the limit');
      raw += decoder.decode(part.value, { stream: true });
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

class PortalLookupError extends Error {
  readonly status: PortalFailure;

  constructor(status: PortalFailure) {
    super('Portal lookup failed');
    this.status = status;
  }
}

export async function authorizePortal(
  authorization: readonly string[] | undefined,
  requiredModules: readonly PortalModule[],
  env: NodeJS.ProcessEnv,
  fetchPortal: typeof fetch,
  requestSignal: AbortSignal,
): Promise<PortalFailure | undefined> {
  if (authorization?.length !== 1 || authorization[0].length > 8192 + 'Bearer '.length) return 401;
  const bearer = bearerPattern.exec(authorization[0]);
  if (!bearer) return 401;

  const origin = portalOrigin(env.PORTAL_AUTH_URL);
  const apiKey = env.PORTAL_PUBLIC_KEY?.trim();
  if (!origin || !apiKey) return 503;

  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(portalTimeoutMs)]);
  const headers = { authorization: `Bearer ${bearer[1]}`, apikey: apiKey, accept: 'application/json' };

  const get = async (path: string, fields?: { user_id: string; select: string }): Promise<unknown> => {
    const url = new URL(path, origin);
    if (fields) url.search = new URLSearchParams(fields).toString();
    const reply = await fetchPortal(url, { method: 'GET', headers, signal, redirect: 'error', cache: 'no-store' });
    if (reply.status === 200) return readPortalJson(reply);

    void reply.body?.cancel().catch(() => {});
    if (reply.status === 401 || (path === '/auth/v1/user' && [400, 403].includes(reply.status))) {
      throw new PortalLookupError(401);
    }
    throw new PortalLookupError(reply.status === 403 ? 403 : 503);
  };

  try {
    const account = await get('/auth/v1/user');
    if (!isRecord(account) || typeof account.id !== 'string' || !uuidPattern.test(account.id) || typeof account.email !== 'string') {
      return 401;
    }
    const email = account.email.trim();
    if (!email || email.length > 254 || typeof account.email_confirmed_at !== 'string' || !account.email_confirmed_at.trim()) {
      return 403;
    }

    const actorFilter = `eq.${account.id.toLowerCase()}`;
    const roles = await get('/rest/v1/user_roles', { user_id: actorFilter, select: 'role' });
    if (!Array.isArray(roles)) return 503;
    if (roles.some((row) => isRecord(row) && row.role === 'master')) return;

    const profile = singleRow(await get('/rest/v1/profiles', { user_id: actorFilter, select: 'cod_empresa_bi' }));
    if (!companyCodes.has(profile?.cod_empresa_bi)) return 403;

    const permissions = singleRow(await get('/rest/v1/user_module_permissions', {
      user_id: actorFilter,
      select: requiredModules.join(','),
    }));
    if (!permissions || !requiredModules.some((module) => permissions[module] === true)) return 403;
  } catch (error) {
    return error instanceof PortalLookupError ? error.status : 503;
  }
}
