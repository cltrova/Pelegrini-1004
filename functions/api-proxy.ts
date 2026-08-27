import { connect } from 'cloudflare:sockets';

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

function shouldUseRsysSocket(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint);
    return parsed.protocol === 'http:' && parsed.hostname === '187.77.203.16';
  } catch {
    return false;
  }
}

async function fetchRsysBySocket(proxyPath: string, method: string, body?: ArrayBuffer): Promise<Response> {
  const socket = connect({ hostname: '187.77.203.16', port: 80 });
  await socket.opened;
  const writer = socket.writable.getWriter();
  const normalizedPath = `/${proxyPath.replace(/^\/+/, '')}`;
  const bodyBytes = body ? new Uint8Array(body) : new Uint8Array();
  const headerLines = [
    `${method} ${normalizedPath} HTTP/1.0`,
    'Host: api-rsys.cyft.com.br',
    'Accept: application/json',
    'Content-Type: application/json',
    'Connection: close',
  ];
  if (bodyBytes.byteLength > 0) headerLines.push(`Content-Length: ${bodyBytes.byteLength}`);
  const headerText = `${headerLines.join('\r\n')}\r\n\r\n`;
  const headerBytes = new TextEncoder().encode(headerText);
  const requestBytes = new Uint8Array(headerBytes.byteLength + bodyBytes.byteLength);
  requestBytes.set(headerBytes);
  requestBytes.set(bodyBytes, headerBytes.byteLength);
  await writer.write(requestBytes);
  await writer.close();

  const chunks: Uint8Array[] = [];
  const reader = socket.readable.getReader();
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }

  const responseBytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    responseBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const separator = new TextEncoder().encode('\r\n\r\n');
  let headerEnd = -1;
  for (let i = 0; i <= responseBytes.byteLength - separator.byteLength; i++) {
    if (separator.every((byte, index) => responseBytes[i + index] === byte)) {
      headerEnd = i;
      break;
    }
  }
  if (headerEnd < 0) return json(502, { error: 'Resposta invalida da VPS.' });

  const rawHeaders = new TextDecoder().decode(responseBytes.slice(0, headerEnd));
  const bodyPart = responseBytes.slice(headerEnd + separator.byteLength);
  const [statusLine, ...parsedHeaderLines] = rawHeaders.split('\r\n');
  const status = Number(statusLine.match(/HTTP\/\d(?:\.\d)?\s+(\d+)/)?.[1] || 502);
  const responseHeaders = new Headers();
  for (const line of parsedHeaderLines) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (['connection', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) continue;
    responseHeaders.set(key, line.slice(idx + 1).trim());
  }
  responseHeaders.set('x-local-api-proxy-socket-host', 'api-rsys.cyft.com.br');
  return new Response(bodyPart, { status, headers: responseHeaders });
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

  try {
    const method = request.method || 'GET';
    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();
    const upstream = shouldUseRsysSocket(endpoint)
      ? await fetchRsysBySocket(proxyPath, method, body)
      : await fetch(upstreamUrl, { method, headers, body });
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
