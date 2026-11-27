import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { createAiServer } from './http.ts';
import type { AiHandler, AiHandlers } from './http.ts';
import type { DailyInsightSnapshot, InsightsBranch } from './daily-insight-types.ts';

const portalOrigin = 'https://portal.example.test';
const portalKey = 'configured-portal-public-key';
const openAiKey = 'server-only-openai-key';
const actorToken = 'portal.actor.signature';
const actorId = '123e4567-e89b-12d3-a456-426614174000';
const account = { id: actorId, email: 'usuario@example.test', email_confirmed_at: '2026-01-01' };
const mib = 1024 * 1024;
const accessMatrix = {
  'assistente-estoque': ['modulo_operacional'],
  'assistente-estoque-insights': ['modulo_operacional'],
  'assistente-estoque-brain': ['modulo_operacional'],
  'assistente-dre': ['modulo_dre'],
  'assistente-variacao': ['modulo_variacao'],
  'assistente-financeiro': ['modulo_dre', 'modulo_variacao', 'modulo_resumo'],
  'comercial-ai-chat': ['modulo_comercial'],
  'comercial-ai-feed': ['modulo_comercial'],
  'campanhas-insights': ['modulo_comercial'],
  'categorias-insights': ['modulo_comercial'],
  'marcas-insights': ['modulo_comercial'],
  'produtos-insights': ['modulo_comercial'],
  'ai-compose': ['modulo_whatsapp'],
  'smart-replies': ['modulo_whatsapp'],
  'transcribe-audio': ['modulo_operacional', 'modulo_whatsapp'],
  'cobranca-simulate': ['modulo_resumo'],
} satisfies Record<keyof AiHandlers, string[]>;

type PortalCall = { url: URL; init: RequestInit | undefined };
type FixtureOptions = {
  handler?: AiHandler;
  asMaster?: boolean;
  env?: NodeJS.ProcessEnv;
  readDailyInsights?: (branch: InsightsBranch) => Promise<DailyInsightSnapshot | null>;
  interceptPortal?: (call: PortalCall) => Response | undefined;
};

async function start(t: TestContext, options: FixtureOptions = {}) {
  const permissions: Record<string, unknown> = { modulo_operacional: true };
  const calls: PortalCall[] = [];
  const handled: Request[] = [];
  const handler: AiHandler = async (incoming) => {
    handled.push(incoming);
    return options.handler ? options.handler(incoming) : Response.json({ ok: true });
  };
  const handlers = Object.fromEntries(Object.keys(accessMatrix).map((slug) => [slug, handler])) as AiHandlers;
  const server = createAiServer({
    handlers,
    readDailyInsights: options.readDailyInsights,
    env: { PORTAL_AUTH_URL: portalOrigin, PORTAL_PUBLIC_KEY: portalKey, OPENAI_API_KEY: openAiKey, ...options.env },
    fetchPortal: async (input, init) => {
      const url = new URL(String(input));
      const call = { url, init };
      calls.push(call);
      const substitute = options.interceptPortal?.(call);
      if (substitute) return substitute;
      switch (url.pathname) {
        case '/auth/v1/user': return Response.json(account);
        case '/rest/v1/user_roles': return Response.json([{ role: options.asMaster ? 'master' : 'client' }]);
        case '/rest/v1/profiles': return Response.json([{ cod_empresa_bi: '10041' }]);
        case '/rest/v1/user_module_permissions': return Response.json([permissions]);
        default: throw new Error('Unexpected portal URL');
      }
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const post = (slug: string, body = '{}', headers = new Headers({ authorization: `Bearer ${actorToken}` })) =>
    fetch(`${origin}/api/ia/${slug}`, { method: 'POST', headers, body });
  return { calls, handled, origin, permissions, post };
}

async function assertError(response: Response, status: number) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/);
  const result = await response.text();
  assert.equal(typeof JSON.parse(result).error, 'string');
  for (const secret of [actorToken, portalKey, openAiKey, 'private upstream text']) {
    assert(!result.includes(secret));
  }
}

test('microphone uploads preserve the multipart boundary without forwarding the session token', async (t) => {
  const { origin } = await start(t, {
    handler: async (request) => {
      assert.equal(request.headers.get('authorization'), null);
      const audio = (await request.formData()).get('file');
      assert(audio instanceof Blob);
      return Response.json({ audio: await audio.text() });
    },
  });
  const audio = new FormData();
  audio.append('file', new Blob(['microfone fictício'], { type: 'audio/webm' }), 'audio.webm');
  const response = await fetch(`${origin}/api/ia/transcribe-audio`, {
    method: 'POST',
    headers: { authorization: `Bearer ${actorToken}` },
    body: audio,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { audio: 'microfone fictício' });
});

test('health works without secrets and only exact allowlisted POST paths reach authentication', async (t) => {
  const ia = await start(t, { env: { OPENAI_API_KEY: undefined, PORTAL_AUTH_URL: undefined, PORTAL_PUBLIC_KEY: undefined } });
  const health = await fetch(`${ia.origin}/api/ia/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await health.json(), { status: 'ok' });
  const wrongMethod = await fetch(`${ia.origin}/api/ia/assistente-estoque`);
  assert.equal(wrongMethod.headers.get('allow'), 'POST');
  await assertError(wrongMethod, 405);
  const preflight = await fetch(`${ia.origin}/api/ia/assistente-estoque`, { method: 'OPTIONS' });
  assert.equal(preflight.headers.get('access-control-allow-origin'), null);
  await assertError(preflight, 405);

  for (const slug of ['completions', 'constructor', 'assistente-estoque/', 'assistente-estoque?extra=1', '%61ssistente-estoque']) {
    await assertError(await ia.post(slug), 404);
  }
  assert.equal(ia.calls.length, 0);
  assert.equal(ia.handled.length, 0);
});

test('missing or malformed portal bearer tokens fail without a portal or inference call', async (t) => {
  const ia = await start(t);
  for (const authorization of [undefined, 'Basic a.b.c', 'Bearer opaque', 'Bearer  a.b.c', `Bearer ${'a'.repeat(8192)}.b.c`]) {
    const headers = new Headers({ apikey: portalKey });
    if (authorization) headers.set('authorization', authorization);
    await assertError(await ia.post('assistente-estoque', '{"role":"master"}', headers), 401);
  }
  assert.equal(ia.calls.length, 0);
  assert.equal(ia.handled.length, 0);
});

test('portal account validation fails closed for rejected, unconfirmed, and malformed accounts', async (t) => {
  const outcomes: Array<[number, () => Response]> = [
    [401, () => new Response('private upstream text', { status: 403 })],
    [401, () => Response.json({ ...account, id: 'invalid id' })],
    [403, () => Response.json({ ...account, email_confirmed_at: null })],
    [503, () => new Response('private upstream text', { status: 502 })],
    [503, () => new Response(null, { status: 302, headers: { location: 'https://other.example.test' } })],
    [503, () => new Response('private upstream text')],
    [503, () => Response.json({ ...account, extra: 'a'.repeat(64 * 1024) })],
  ];
  let reply: () => Response;
  const ia = await start(t, { interceptPortal: () => reply() });
  for (const [status, response] of outcomes) {
    reply = response;
    await assertError(await ia.post('assistente-estoque'), status);
  }
  assert.equal(ia.calls.length, outcomes.length);
  assert(ia.calls.every(({ url, init }) => url.pathname === '/auth/v1/user' && init?.redirect === 'error'));
  assert.equal(ia.handled.length, 0);
});

test('portal lookups use the validated actor and configured key, and the handler receives only a fresh JSON request', async (t) => {
  const body = '{"texto":"ação", "user_id":"another-user", "role":"master"}';
  const ia = await start(t, {
    handler: async (incoming) => new Response(await incoming.text(), {
      status: 201,
      headers: { 'content-type': 'application/json', 'set-cookie': 'portal=value', 'access-control-allow-origin': '*' },
    }),
  });
  const response = await ia.post('assistente-estoque', body, new Headers({
    authorization: `bEaReR ${actorToken}`,
    apikey: 'browser-substituted-key',
    cookie: 'browser-session=some-session',
    'x-client-info': 'caller-metadata',
  }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(await response.text(), body);
  assert.equal(ia.handled.length, 1);
  const forwarded = ia.handled[0];
  assert.equal(forwarded.method, 'POST');
  assert.equal(new URL(forwarded.url).pathname, '/api/ia/assistente-estoque');
  assert.deepEqual([...forwarded.headers], [['content-type', 'application/json']]);
  assert.deepEqual(ia.calls.map(({ url }) => [url.pathname, url.searchParams.get('select')]), [
    ['/auth/v1/user', null],
    ['/rest/v1/user_roles', 'role'],
    ['/rest/v1/profiles', 'cod_empresa_bi'],
    ['/rest/v1/user_module_permissions', 'modulo_operacional'],
  ]);
  for (const { url, init } of ia.calls) {
    assert.equal(url.origin, portalOrigin);
    assert.equal(init?.method, 'GET');
    assert.equal(init?.redirect, 'error');
    assert.deepEqual(Object.fromEntries(new Headers(init?.headers)), {
      accept: 'application/json', apikey: portalKey, authorization: `Bearer ${actorToken}`,
    });
    assert.equal(url.searchParams.get('user_id'), url.pathname === '/auth/v1/user' ? null : `eq.${actorId}`);
  }
});

test('only a Master from user_roles bypasses the company and module policies', async (t) => {
  const ia = await start(t, { asMaster: true });
  const response = await ia.post('cobranca-simulate');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(ia.calls.map(({ url }) => url.pathname), ['/auth/v1/user', '/rest/v1/user_roles']);
  assert.equal(ia.handled.length, 1);
});

test('reading daily insights requires the commercial module and the requested branch', async (t) => {
  const snapshot = { dia: '2026-11-27', periodo: { inicio: '2026-11-01', fim: '2026-11-26' }, insights: [] };
  let profile = { cod_empresa_bi: 1004, filiais_permitidas: ['chevrolet'], filial_id: 'transmissao' };
  const reads: InsightsBranch[] = [];
  const ia = await start(t, {
    env: { OPENAI_API_KEY: undefined },
    interceptPortal: ({ url }) => url.pathname === '/rest/v1/profiles' ? Response.json([profile]) : undefined,
    readDailyInsights: async (branch) => { reads.push(branch); return snapshot; },
  });
  const get = (branch: InsightsBranch, authorized = true) => fetch(`${ia.origin}/api/ia/metas-insights-${branch}`, {
    headers: authorized ? { Authorization: `Bearer ${actorToken}` } : {},
  });
  await assertError(await get('chevrolet', false), 401);
  await assertError(await get('chevrolet'), 403);
  ia.permissions.modulo_comercial = true;
  await assertError(await get('transmissao'), 403);
  const result = await get('chevrolet');
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await result.json(), { snapshot });
  profile = { ...profile, cod_empresa_bi: 10041, filiais_permitidas: ['transmissao'] };
  await assertError(await get('transmissao'), 403);
  await assertError(await ia.post('metas-insights-chevrolet'), 405);
  await assertError(await ia.post('metas-insights'), 404);
  assert.deepEqual(reads, ['chevrolet']);
});

test('module access is specific to each slug and any listed permission grants access', async (t) => {
  const ia = await start(t);
  const modules = new Set(Object.values(accessMatrix).flat());
  for (const [slug, allowed] of Object.entries(accessMatrix)) {
    for (const module of modules) {
      for (const name of modules) ia.permissions[name] = name === module;
      const response = await ia.post(slug);
      if (allowed.includes(module)) {
        assert.equal(response.status, 200, `${slug} must allow ${module}`);
        assert.deepEqual(await response.json(), { ok: true });
      } else {
        assert.equal(response.status, 403, `${slug} must deny ${module}`);
        await assertError(response, 403);
      }
    }
  }
  assert.equal(ia.handled.length, Object.values(accessMatrix).flat().length);
});

test('company and permission checks use portal records and reject a client-asserted Master', async (t) => {
  let profiles: unknown = [{ cod_empresa_bi: '1010' }];
  let permissions: unknown = [{ modulo_operacional: true }];
  const ia = await start(t, {
    interceptPortal: ({ url }) => {
      if (url.pathname === '/auth/v1/user') return Response.json({ ...account, user_metadata: { role: 'master' } });
      if (url.pathname === '/rest/v1/profiles') return Response.json(profiles);
      if (url.pathname === '/rest/v1/user_module_permissions') return Response.json(permissions);
    },
  });
  const body = JSON.stringify({ role: 'master', cod_empresa_bi: '1004', modulo_operacional: true });
  for (const profile of [[{ cod_empresa_bi: '1010' }], [], [{ cod_empresa_bi: '1004' }, { cod_empresa_bi: '10041' }]]) {
    profiles = profile;
    await assertError(await ia.post('assistente-estoque', body), 403);
  }
  profiles = [{ cod_empresa_bi: '1004' }];
  for (const record of [[], [{ modulo_operacional: 'true' }], [{ modulo_operacional: false }]]) {
    permissions = record;
    await assertError(await ia.post('assistente-estoque', body), 403);
  }
  assert.equal(ia.handled.length, 0);
  permissions = [{ modulo_operacional: true }];
  const response = await ia.post('assistente-estoque', body);
  assert.equal(response.status, 200);
  await response.json();
});

test('authorization backend errors and missing configuration prevent running the handler', async (t) => {
  const wrongPortal = await start(t, { env: { PORTAL_AUTH_URL: 'http://portal.example.test' } });
  await assertError(await wrongPortal.post('assistente-estoque'), 503);
  assert.equal(wrongPortal.calls.length, 0);
  assert.equal(wrongPortal.handled.length, 0);

  const portalFailure = await start(t, {
    interceptPortal: ({ url }) => {
      if (url.pathname === '/rest/v1/user_roles') throw new Error('private upstream text');
      return undefined;
    },
  });
  await assertError(await portalFailure.post('assistente-estoque'), 503);
  assert.equal(portalFailure.handled.length, 0);

  const missingKey = await start(t, { env: { OPENAI_API_KEY: ' ' } });
  await assertError(await missingKey.post('assistente-estoque'), 503);
  assert.equal(missingKey.handled.length, 0);
  assert.equal(missingKey.calls[0].url.pathname, '/auth/v1/user');
});

test('body limits are enforced for declared and chunked uploads before the handler', { timeout: 8_000 }, async (t) => {
  const ia = await start(t, { asMaster: true });
  const largeBody = `{"audio":"${'a'.repeat(2 * mib)}"}`;
  await assertError(await ia.post('assistente-estoque', largeBody), 413);
  assert.equal(ia.handled.length, 0);

  const chunked = await new Promise<Response>((resolve, reject) => {
    const client = request(`${ia.origin}/api/ia/assistente-estoque`, {
      method: 'POST', headers: { authorization: `Bearer ${actorToken}` },
    }, async (incoming) => {
      try {
        const body = await Array.fromAsync(incoming);
        resolve(new Response(Buffer.concat(body), { status: incoming.statusCode, headers: { ...incoming.headers } as HeadersInit }));
      } catch (error) {
        reject(error);
      }
    });
    client.on('error', reject);
    client.write(Buffer.alloc(mib));
    client.write(Buffer.alloc(mib));
    client.end('a');
  });
  await assertError(chunked, 413);
  assert.equal(ia.handled.length, 0);

  const audio = await ia.post('transcribe-audio', largeBody);
  assert.equal(audio.status, 200);
  assert.deepEqual(await audio.json(), { ok: true });

  const oversizedAudio = await new Promise<Response>((resolve, reject) => {
    const client = request(`${ia.origin}/api/ia/transcribe-audio`, {
      method: 'POST', headers: { authorization: `Bearer ${actorToken}`, 'content-length': String(34 * mib + 1) },
    }, async (incoming) => {
      try {
        const body = await Array.fromAsync(incoming);
        resolve(new Response(Buffer.concat(body), { status: incoming.statusCode, headers: { ...incoming.headers } as HeadersInit }));
      } catch (error) {
        reject(error);
      }
    });
    client.on('error', reject);
    client.end();
  });
  await assertError(oversizedAudio, 413);
  assert.equal(ia.handled.length, 1);
});

test('handler errors expose safe JSON and preserve expected rate-limit status', async (t) => {
  let handler: AiHandler = () => { throw new Error(`private upstream text ${openAiKey}`); };
  const ia = await start(t, { asMaster: true, handler: (incoming) => handler(incoming) });
  await assertError(await ia.post('ai-compose'), 500);
  handler = () => Response.json({ error: openAiKey, details: 'private upstream text', success: false }, { status: 500 });
  const failure = await ia.post('transcribe-audio');
  await assertError(failure.clone(), 500);
  assert.equal((await failure.json()).success, false);
  handler = () => Response.json({ error: 'Limite de requisições.' }, { status: 429 });
  const limited = await ia.post('ai-compose');
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: 'Limite de requisições.' });
});

test('SSE frames arrive before the stream ends and the response disables buffering', { timeout: 5_000 }, async (t) => {
  const encoder = new TextEncoder();
  const first = 'data: {"delta":"ação"}\n\n';
  const last = 'data: [DONE]\n\n';
  let writer!: ReadableStreamDefaultController<Uint8Array>;
  const ia = await start(t, { asMaster: true, handler: () => new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      writer = controller;
      controller.enqueue(encoder.encode(first));
    },
  }), { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } }) });
  const response = await ia.post('assistente-dre');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-accel-buffering'), 'no');
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let firstSeen = '';
  while (!firstSeen.endsWith('\n\n')) {
    const part = await reader.read();
    assert.equal(part.done, false);
    firstSeen += part.value;
  }
  assert.equal(firstSeen, first);
  writer.enqueue(encoder.encode(last));
  writer.close();
  let lastSeen = '';
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    lastSeen += part.value;
  }
  assert.equal(lastSeen, last);
});

test('a stream failure closes the response without appending internal error details', { timeout: 5_000 }, async (t) => {
  let writer!: ReadableStreamDefaultController<Uint8Array>;
  const ia = await start(t, { asMaster: true, handler: () => new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      writer = controller;
      controller.enqueue(new TextEncoder().encode('data: primeira\n\n'));
    },
  }), { headers: { 'content-type': 'text/event-stream' } }) });
  const response = await ia.post('assistente-financeiro');
  const reader = response.body!.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /^data: primeira/);
  writer.error(new Error(`private upstream text ${openAiKey}`));
  await assert.rejects(reader.read(), (error: Error) => !error.message.includes('private upstream text'));
});
