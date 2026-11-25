const primarySite = 'https://pelegrini.t2a.ia.br';
const routePattern = /^\/api\/ia\/[a-z]+(?:-[a-z]+)*$/;
const uncached = { 'Cache-Control': 'private, no-store' };

export async function onRequest({ request }: { request: Request }) {
  const incoming = new URL(request.url);
  if (!routePattern.test(incoming.pathname)) {
    return Response.json({ error: 'Função de IA não encontrada.' }, { status: 404, headers: uncached });
  }
  if (request.method !== 'POST' && !(request.method === 'GET' && incoming.pathname === '/api/ia/health')) {
    return Response.json({ error: 'Método inválido para esta função.' }, { status: 405, headers: uncached });
  }
  if (incoming.origin === primarySite) {
    return Response.json({ error: 'A API de IA está indisponível.' }, { status: 503, headers: uncached });
  }

  const headers = new Headers();
  for (const name of ['Authorization', 'Content-Type', 'Accept']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(new URL(incoming.pathname, primarySite), {
      method: request.method,
      headers,
      body: request.method === 'POST' ? request.body : undefined,
      redirect: 'manual',
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return Response.json({ error: 'A API de IA está indisponível.' }, { status: 502, headers: uncached });
    }
    const responseHeaders = new Headers(uncached);
    const contentType = upstream.headers.get('Content-Type');
    if (contentType) responseHeaders.set('Content-Type', contentType);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: 'A API de IA está indisponível.' }, { status: 502, headers: uncached });
  }
}
