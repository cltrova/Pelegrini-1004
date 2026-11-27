import { createServer, request } from 'node:http';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { authorizePortal } from '../ia/portal-auth.ts';

const route = '/api/comercial/preparado/produtos';
const branchByCompany = new Map([['1004', 'transmissao'], ['10041', 'chevrolet']] as const);
const forwardedHeaders = ['content-type', 'content-encoding', 'content-length', 'vary',
  'x-data-as-of', 'x-data-version', 'retry-after'] as const;

export function createReportsGateway(token: string, port: number, env = process.env, fetchPortal = globalThis.fetch) {
  if (!/^[\x21-\x7e]{32,}$/.test(token) || !Number.isSafeInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Configuração inválida do gateway de relatórios');
  }

  return createServer(async (incoming, outgoing) => {
    outgoing.setHeader('Cache-Control', 'private, no-store');
    outgoing.setHeader('X-Content-Type-Options', 'nosniff');
    incoming.resume();
    const fail = (status: number, code: string) => {
      if (outgoing.destroyed) return;
      if (outgoing.headersSent) { outgoing.destroy(); return; }
      outgoing.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      outgoing.end(JSON.stringify({ code }));
    };
    const target = URL.parse(incoming.url ?? '/', 'http://localhost');
    if (target?.pathname !== route || target.origin !== 'http://localhost') return fail(404, 'NOT_FOUND');
    if (incoming.method !== 'GET') return fail(405, 'METHOD_NOT_ALLOWED');
    const companies = target.searchParams.getAll('cod_empresa_bi');
    const company = companies[0];
    const branch = company === '1004' || company === '10041' ? branchByCompany.get(company) : undefined;
    if (!branch || companies.length !== 1) return fail(422, 'INVALID_FILTER');

    const client = new AbortController();
    outgoing.on('close', () => client.abort());
    const started = performance.now();
    const failure = await authorizePortal(incoming.headersDistinct.authorization, ['modulo_comercial'],
      env, fetchPortal, client.signal, branch, '1004');
    if (client.signal.aborted) return;
    if (failure) return fail(failure, failure === 401 ? 'UNAUTHORIZED' : failure === 403 ? 'FORBIDDEN' : 'AUTH_UNAVAILABLE');
    const authMs = (performance.now() - started).toFixed(1);

    const internal = request({ hostname: '127.0.0.1', port, method: 'GET',
      path: `/interno/relatorios/produtos${target.search}`, signal: client.signal,
      headers: {
        authorization: `Bearer ${token}`,
        'accept-encoding': incoming.headers['accept-encoding'] ?? 'identity',
      },
    }, (reply) => {
      reply.on('error', () => fail(503, 'DATA_UNAVAILABLE'));
      if (reply.statusCode === 200) {
        const age = Date.now() - Date.parse(String(reply.headers['x-data-as-of']));
        if (!(age >= 0 && age < 60_000)) {
          reply.resume();
          fail(503, 'DATA_UNAVAILABLE');
          return;
        }
      }
      outgoing.setHeader('Server-Timing', [String(reply.headers['server-timing'] || ''), `auth;dur=${authMs}`]
        .filter(Boolean).join(', '));
      for (const name of forwardedHeaders) {
        const value = reply.headers[name];
        if (value) outgoing.setHeader(name, value);
      }
      outgoing.statusCode = reply.statusCode ?? 503;
      reply.pipe(outgoing);
    });
    internal.on('error', () => fail(503, 'DATA_UNAVAILABLE'));
    internal.setTimeout(5_000, () => internal.destroy());
    internal.end();
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const token = readFileSync(process.env.RELATORIOS_TOKEN_FILE!, 'ascii').trim();
  const upstreamPort = Number(process.env.RELATORIOS_UPSTREAM_PORT ?? 8328);
  const port = Number(process.env.RELATORIOS_GATEWAY_PORT ?? 8329);
  createReportsGateway(token, upstreamPort).listen(port, '127.0.0.1');
}
