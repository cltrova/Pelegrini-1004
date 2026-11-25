import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createPelegriniAiServer } from './server.ts';

test('the production server dispatches real handlers and only the OpenAI key reaches inference', { timeout: 8_000 }, async (t) => {
  const env = {
    PORTAL_AUTH_URL: 'https://portal.example.test',
    PORTAL_PUBLIC_KEY: 'test-portal-key',
    OPENAI_API_KEY: 'test-openai-key',
    AI_GATEWAY_URL: 'https://unused.example.test',
    AI_GATEWAY_API_KEY: 'unused-test-gateway-key',
  };
  const actorToken = 'test.portal.session';
  const previousEnv = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const realFetch = globalThis.fetch;
  const calls: { url: URL; init?: RequestInit }[] = [];
  let serviceOrigin = '';
  const frames = 'data: {"choices":[{"delta":{"content":"Olá"}}]}\n\ndata: [DONE]\n\n';
  t.mock.method(globalThis, 'fetch', async (input: URL | Request | string, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin === serviceOrigin) return realFetch(input, init);
    calls.push({ url, init });
    if (url.origin === env.PORTAL_AUTH_URL) {
      if (url.pathname === '/auth/v1/user') {
        return Response.json({ id: '123e4567-e89b-12d3-a456-426614174000', email: 'master@example.test', email_confirmed_at: '2026-01-01' });
      }
      if (url.pathname === '/rest/v1/user_roles') return Response.json([{ role: 'master' }]);
    }
    if (url.href === 'https://api.openai.com/v1/chat/completions') {
      const body = JSON.parse(String(init?.body));
      return body.stream
        ? new Response(frames, { headers: { 'content-type': 'text/event-stream' } })
        : Response.json({ choices: [{ message: { content: 'Mensagem revisada.' } }] });
    }
    throw new Error('Unexpected outbound URL');
  });

  const server = createPelegriniAiServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert(address && typeof address !== 'string');
  serviceOrigin = `http://127.0.0.1:${address.port}`;

  const headers = {
    authorization: `Bearer ${actorToken}`,
    apikey: 'browser-portal-key',
    cookie: 'portal=private-session-cookie',
    'content-type': 'application/json',
  };
  const composed = await fetch(`${serviceOrigin}/api/ia/ai-compose`, {
    method: 'POST', headers, body: JSON.stringify({ text: 'Mensagem', action: 'rewrite' }),
  });
  assert.equal(composed.status, 200);
  assert.deepEqual(await composed.json(), { transformedText: 'Mensagem revisada.' });
  const streamed = await fetch(`${serviceOrigin}/api/ia/assistente-financeiro`, {
    method: 'POST', headers, body: JSON.stringify({ messages: [{ role: 'user', content: 'Resuma.' }] }),
  });
  assert.equal(streamed.status, 200);
  assert.equal(streamed.headers.get('content-type'), 'text/event-stream');
  assert.equal(await streamed.text(), frames);

  assert.deepEqual(calls.map(({ url }) => url.pathname), [
    '/auth/v1/user', '/rest/v1/user_roles', '/v1/chat/completions',
    '/auth/v1/user', '/rest/v1/user_roles', '/v1/chat/completions',
  ]);
  for (const { url, init } of calls) {
    const outbound = new Headers(init?.headers);
    if (url.origin === env.PORTAL_AUTH_URL) {
      assert.equal(outbound.get('authorization'), `Bearer ${actorToken}`);
      assert.equal(outbound.get('apikey'), env.PORTAL_PUBLIC_KEY);
    } else {
      assert.equal(outbound.get('authorization'), `Bearer ${env.OPENAI_API_KEY}`);
      assert.equal(outbound.get('apikey'), null);
      const sent = String(init?.body);
      for (const credential of [actorToken, env.PORTAL_PUBLIC_KEY, headers.apikey, headers.cookie]) {
        assert(!sent.includes(credential));
      }
    }
    assert.equal(outbound.get('cookie'), null);
  }
});
