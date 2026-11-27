import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { authorizePortal } from './portal-auth.ts';
import type { PortalModule } from './portal-auth.ts';
import type { DailyInsightSnapshot, InsightsBranch } from './daily-insight-types.ts';

const apiPrefix = '/api/ia/';
const mib = 1024 * 1024;
const bodyLimit = 2 * mib;
const audioBodyLimit = 34 * mib;
const requiredModules = {
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
} as const satisfies Record<string, readonly PortalModule[]>;

const dailyInsightsRoutes = new Map<string, InsightsBranch>([
  ['metas-insights-transmissao', 'transmissao'],
  ['metas-insights-chevrolet', 'chevrolet'],
]);

const errors = {
  401: 'Sessão do portal inválida ou expirada.',
  403: 'Acesso a este recurso de IA não autorizado.',
  404: 'Recurso de IA não encontrado.',
  405: 'Método não permitido.',
  413: 'Corpo da requisição excede o limite.',
  500: 'Não foi possível concluir a solicitação de IA.',
  503: 'Serviço de IA indisponível no momento.',
} as const;

type AiSlug = keyof typeof requiredModules;
export type AiHandler = (request: Request) => Response | Promise<Response>;
export type AiHandlers = Record<AiSlug, AiHandler>;

type AiServerOptions = {
  handlers: AiHandlers;
  env?: NodeJS.ProcessEnv;
  fetchPortal?: typeof fetch;
  readDailyInsights?: (branch: InsightsBranch) => Promise<DailyInsightSnapshot | null>;
};

function isAiSlug(slug: string): slug is AiSlug {
  return Object.hasOwn(requiredModules, slug);
}

function sendJson(outgoing: ServerResponse, status: number, body: object): void {
  const json = JSON.stringify(body);
  outgoing.setHeader('Content-Type', 'application/json; charset=utf-8');
  outgoing.setHeader('Content-Length', Buffer.byteLength(json));
  outgoing.statusCode = status;
  outgoing.end(json);
}

function discardUnreadBody(incoming: IncomingMessage): void {
  if (incoming.readableEnded || incoming.destroyed) return;
  // Give the peer time to read the error while discarding, never buffering, unread bytes.
  const deadline = setTimeout(() => incoming.socket.destroy(), 1_000);
  deadline.unref();
  incoming.once('close', () => clearTimeout(deadline));
  incoming.resume();
}

async function readBody(incoming: IncomingMessage, limit: number): Promise<Buffer<ArrayBuffer> | null> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  // Keep the socket writable so a chunked upload can receive 413 before it closes.
  for await (const chunk of incoming.iterator({ destroyOnReturn: false })) {
    bytes += chunk.byteLength;
    if (bytes > limit) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes);
}

export function createAiServer({ handlers, env = process.env, fetchPortal = globalThis.fetch, readDailyInsights }: AiServerOptions) {
  async function serve(incoming: IncomingMessage, outgoing: ServerResponse, waitingForContinue = false): Promise<void> {
    outgoing.setHeader('Cache-Control', 'private, no-store');
    outgoing.setHeader('X-Content-Type-Options', 'nosniff');
    const controller = new AbortController();
    outgoing.once('close', () => {
      if (!outgoing.writableFinished) controller.abort();
    });
    const { signal } = controller;

    function reject(status: keyof typeof errors) {
      if (!waitingForContinue) discardUnreadBody(incoming);
      sendJson(outgoing, status, { error: errors[status] });
    }

    try {
      const path = incoming.url ?? '';
      if (path === `${apiPrefix}health`) {
        if (incoming.method === 'GET') return sendJson(outgoing, 200, { status: 'ok' });
        outgoing.setHeader('Allow', 'GET');
        return reject(405);
      }
      const slug = path.startsWith(apiPrefix) ? path.slice(apiPrefix.length) : '';
      const branch = dailyInsightsRoutes.get(slug);
      if (branch) {
        if (incoming.method !== 'GET') {
          outgoing.setHeader('Allow', 'GET');
          return reject(405);
        }
        const failure = await authorizePortal(incoming.headersDistinct.authorization, ['modulo_comercial'], env, fetchPortal, signal, branch);
        if (signal.aborted) return;
        if (failure) return reject(failure);
        const snapshot = await readDailyInsights?.(branch) ?? null;
        if (!signal.aborted) sendJson(outgoing, 200, { snapshot });
        return;
      }
      if (!isAiSlug(slug)) return reject(404);
      if (incoming.method !== 'POST') {
        outgoing.setHeader('Allow', 'POST');
        return reject(405);
      }

      const failure = await authorizePortal(incoming.headersDistinct.authorization, requiredModules[slug], env, fetchPortal, signal);
      if (signal.aborted) return;
      if (failure) return reject(failure);
      if (!env.OPENAI_API_KEY?.trim()) return reject(503);

      const limit = slug === 'transcribe-audio' ? audioBodyLimit : bodyLimit;
      if (Number(incoming.headers['content-length']) > limit) return reject(413);
      if (waitingForContinue) {
        outgoing.writeContinue();
        waitingForContinue = false;
      }
      const body = await readBody(incoming, limit);
      if (signal.aborted) return;
      if (!body) return reject(413);

      const originalType = incoming.headers['content-type'];
      const requestMediaType = slug === 'transcribe-audio' && typeof originalType === 'string'
        && originalType.toLowerCase().startsWith('multipart/form-data;') ? originalType : 'application/json';
      const request = new Request(`http://localhost${path}`, {
        method: 'POST',
        headers: { 'content-type': requestMediaType },
        body,
        signal,
      });
      const result = await handlers[slug](request);
      if (signal.aborted) {
        void result.body?.cancel().catch(() => {});
        return;
      }

      if (result.status >= 500) {
        void result.body?.cancel().catch(() => {});
        const error = { error: errors[500] };
        return sendJson(outgoing, result.status, slug === 'transcribe-audio' ? { ...error, success: false } : error);
      }

      const contentType = result.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
      const sse = contentType === 'text/event-stream';
      if ((result.body && !sse && contentType !== 'application/json') || (result.status >= 300 && result.status < 400)) {
        void result.body?.cancel().catch(() => {});
        return reject(500);
      }

      outgoing.statusCode = result.status;
      if (!result.body) return void outgoing.end();
      if (sse) {
        outgoing.setHeader('Content-Type', 'text/event-stream');
        outgoing.setHeader('X-Accel-Buffering', 'no');
        outgoing.flushHeaders();
      } else {
        outgoing.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      await pipeline(Readable.fromWeb(result.body), outgoing);
    } catch {
      if (signal.aborted || outgoing.destroyed) return;
      if (outgoing.headersSent) outgoing.destroy();
      else reject(500);
    }
  }

  const server = createServer({ headersTimeout: 10_000, requestTimeout: 120_000 }, (incoming, outgoing) => {
    void serve(incoming, outgoing);
  });
  server.on('checkContinue', (incoming, outgoing) => { void serve(incoming, outgoing, true); });
  return server;
}
