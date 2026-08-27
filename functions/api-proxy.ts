function json(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function shouldReturnEmptyOnFailure(proxyPath: string): boolean {
  const normalizedPath = proxyPath.startsWith('/') ? proxyPath : `/${proxyPath}`;
  return (
    normalizedPath.includes('/comercial/totais')
    || normalizedPath.includes('/comercial/produtos')
    || normalizedPath.includes('/comercial/pedidos')
    || normalizedPath.includes('/comercial/devolucoes')
    || normalizedPath.includes('/comercial/clientes')
    || normalizedPath.includes('/comercial/agrupado')
    || normalizedPath.includes('/financeiro/dre')
    || normalizedPath.includes('/financeiro/variacao')
    || normalizedPath.includes('/financeiro/duplicatas')
    || normalizedPath.includes('/financeiro/resumo')
    || normalizedPath.includes('/financeiro/fluxo-caixa')
    || normalizedPath.includes('/operacional/estoque')
  );
}

function fallback(proxyPath: string, upstreamStatus?: number, upstreamBody?: string) {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'x-proxy-upstream-error': 'true',
  };
  if (upstreamStatus) headers['x-proxy-upstream-status'] = String(upstreamStatus);
  if (upstreamBody) headers['x-proxy-upstream-body'] = upstreamBody.slice(0, 1000);

  return new Response(proxyPath.includes('/comercial/totais') ? '{}' : '[]', {
    status: 200,
    headers,
  });
}

function resolveUpstreamHostHeader(endpoint: string): string | null {
  try {
    const host = new URL(endpoint).hostname;
    return host === '187.77.203.16' ? 'rsys.cyft.com.br' : null;
  } catch {
    return null;
  }
}

export async function onRequest({ request }: { request: Request }) {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint') || '';
  const proxyPath = url.searchParams.get('path') || '';

  if (!endpoint || !proxyPath) {
    return json(400, { error: 'Parametros endpoint e path sao obrigatorios.' });
  }

  const upstreamUrl = `${endpoint.replace(/\/+$/, '')}/${proxyPath.replace(/^\/+/, '')}`;
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  headers.set('accept', 'application/json');
  const hostHeader = resolveUpstreamHostHeader(endpoint);
  if (hostHeader) headers.set('host', hostHeader);

  try {
    const method = request.method || 'GET';
    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();
    const upstream = await fetch(upstreamUrl, { method, headers, body });
    const responseBody = await upstream.arrayBuffer();

    if (!upstream.ok && shouldReturnEmptyOnFailure(proxyPath)) {
      return fallback(proxyPath, upstream.status, new TextDecoder().decode(responseBody));
    }

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('connection');
    responseHeaders.set('x-local-api-proxy-url', upstreamUrl);

    return new Response(responseBody, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (shouldReturnEmptyOnFailure(proxyPath)) {
      return fallback(proxyPath, 502, error instanceof Error ? error.message : 'Falha no proxy.');
    }

    return json(502, {
      error: error instanceof Error ? error.message : 'Falha no proxy.',
    });
  }
}
