const serve = (handler: (req: Request) => Response | Promise<Response>) => Deno.serve(handler);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'X-Proxy-Upstream-Error, X-Proxy-Upstream-Status, X-Proxy-Upstream-Body',
  'Cache-Control': 'no-store',
};

const UPSTREAM_TIMEOUT_MS = 120000; // 120s (evita travar a UI quando o servidor do cliente está offline)

async function tryFetch(targetUrl: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(targetUrl, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildTargetUrl(endpointUrl: string, path: string): string {
  const base = endpointUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function shouldReturnEmptyOnFailure(path: string, status?: number): boolean {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const pathWithoutQuery = normalizedPath.split('?')[0].replace(/\/+$/, '');
  const isFinanceiroRoot = /\/financeiro$/.test(pathWithoutQuery);
  return (
    normalizedPath.includes('/comercial/totais') ||
    normalizedPath.includes('/comercial/produtos') ||
    normalizedPath.includes('/comercial/pedidos') ||
    normalizedPath.includes('/comercial/devolucoes') ||
    normalizedPath.includes('/comercial/clientes') ||
    normalizedPath.includes('/comercial/agrupado') ||
    isFinanceiroRoot ||
    normalizedPath.includes('/financeiro/dre') ||
    normalizedPath.includes('/financeiro/variacao') ||
    normalizedPath.includes('/financeiro/duplicatas') ||
    normalizedPath.includes('/financeiro/resumo') ||
    normalizedPath.includes('/financeiro/fluxo-caixa') ||
    normalizedPath.includes('/operacional/estoque')
  );
}

function fallbackResponse(path: string, status = 200, upstreamStatus?: number, upstreamBody?: string): Response {
  return new Response(getFallbackPayload(path), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Proxy-Upstream-Error': 'true',
      ...(upstreamStatus ? { 'X-Proxy-Upstream-Status': String(upstreamStatus) } : {}),
      ...(upstreamBody ? { 'X-Proxy-Upstream-Body': upstreamBody.slice(0, 1000) } : {}),
    },
  });
}

async function fetchWithRetry(
  targetUrl: string,
  options: RequestInit,
  maxAttempts = 3
): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await tryFetch(targetUrl, options);
    if (response.ok) return response;
    // Retry apenas em 5xx (instabilidade upstream)
    if (response.status >= 500 && attempt < maxAttempts) {
      console.warn(`[Proxy] Tentativa ${attempt}/${maxAttempts} falhou (${response.status}). Retentando...`);
      try { await response.body?.cancel(); } catch { /* noop */ }
      await new Promise((r) => setTimeout(r, 800 * attempt));
      lastResponse = null;
      continue;
    }
    lastResponse = response;
    break;
  }
  return lastResponse as Response;
}

function getFallbackPayload(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath.includes('/comercial/totais')) {
    return JSON.stringify({});
  }
  return JSON.stringify([]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpointUrl = url.searchParams.get('endpoint');
    const path = url.searchParams.get('path');
    const isTest = url.searchParams.get('test') === '1';

    if (!endpointUrl || !path) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros endpoint e path são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetUrl = buildTargetUrl(endpointUrl, path);
    console.log(`[Proxy] Requisição para: ${targetUrl}${isTest ? ' (teste)' : ''}`);

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    let response: Response;
    try {
      response = await fetchWithRetry(targetUrl, fetchOptions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Fallback automático: se HTTPS falhar por certificado inválido, tenta HTTP
      if (
        targetUrl.startsWith('https://') &&
        (msg.includes('invalid peer certificate') ||
         msg.includes('UnknownIssuer') ||
         msg.includes('certificate'))
      ) {
        const httpUrl = targetUrl.replace(/^https:\/\//, 'http://');
        console.warn(`[Proxy] HTTPS falhou (certificado inválido). Tentando HTTP: ${httpUrl}`);
        try {
          response = await tryFetch(httpUrl, fetchOptions);
        } catch (httpErr) {
          const httpMsg = httpErr instanceof Error ? httpErr.message : String(httpErr);
          console.error(`[Proxy] HTTP também falhou: ${httpMsg}`);
          if (shouldReturnEmptyOnFailure(path, 502)) {
            return fallbackResponse(path, 200, 502, httpMsg);
          }
          return new Response(
            JSON.stringify({
              error: `Endpoint inacessível. HTTPS rejeitado (certificado inválido) e HTTP falhou: ${httpMsg}`,
              hint: 'Configure um certificado SSL válido no servidor ou habilite a porta HTTP.',
              targetUrl,
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        throw err;
      }
    }

    if (!response.ok) {
      console.error(`[Proxy] Erro do endpoint: ${response.status} ${response.statusText}`);
      const responseBody = await response.text().catch(() => '');
      if (isTest) {
        // No modo teste, qualquer resposta HTTP do servidor (mesmo 404) significa que ele está online
        return new Response(
          JSON.stringify({
            ok: true,
            upstreamStatus: response.status,
            upstreamStatusText: response.statusText,
            targetUrl,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (shouldReturnEmptyOnFailure(path, response.status)) {
        return fallbackResponse(path, 200, response.status, responseBody || response.statusText);
      }
      return new Response(
        JSON.stringify({
          error: `Erro do endpoint: ${response.status} ${response.statusText}`,
          targetUrl,
          responseBody,
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/json';
    return new Response(response.body, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': contentType },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Proxy] Erro:', errorMessage);
    try {
      const url = new URL(req.url);
      const path = url.searchParams.get('path') || '';
      if (path && shouldReturnEmptyOnFailure(path, 502)) {
        return fallbackResponse(path, 200, 502, errorMessage);
      }
    } catch {
      // Mantém resposta padrão abaixo caso nem a URL da função possa ser lida.
    }
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
