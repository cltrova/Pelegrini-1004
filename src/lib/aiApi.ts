import { supabase } from '@/integrations/supabase/client';
import type { DailyInsightSnapshot, InsightsBranch } from '../../services/ia/daily-insight-types';

type JsonSlug =
  | 'ai-compose'
  | 'assistente-estoque'
  | 'assistente-estoque-brain'
  | 'assistente-estoque-insights'
  | 'campanhas-insights'
  | 'categorias-insights'
  | 'cobranca-simulate'
  | 'comercial-ai-chat'
  | 'comercial-ai-feed'
  | 'marcas-insights'
  | 'produtos-insights'
  | 'smart-replies'
  | 'transcribe-audio';

type StreamSlug = 'assistente-dre' | 'assistente-financeiro' | 'assistente-variacao';

class AiApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'AiApiError';
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const data: { error?: unknown; message?: unknown } | null = await response.json().catch(() => null);
  return [data?.error, data?.message].find(
    (message): message is string => typeof message === 'string' && message.trim().length > 0,
  ) ?? fallback;
}

async function getPortalToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new AiApiError(401, 'Sessão expirada. Faça login novamente.');
  }
  return session.access_token;
}

async function postAi(
  slug: JsonSlug | StreamSlug,
  payload: object,
  accept: string,
  errorFallback?: string,
): Promise<Response> {
  const headers = new Headers({ Accept: accept, Authorization: `Bearer ${await getPortalToken()}` });
  const isMultipart = payload instanceof FormData;
  if (!isMultipart) headers.set('Content-Type', 'application/json');

  const response = await fetch(`/api/ia/${slug}`, {
    method: 'POST',
    mode: 'same-origin',
    headers,
    body: isMultipart ? payload : JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await readErrorMessage(response, errorFallback ?? `Erro: ${response.status}`);
    throw new AiApiError(response.status, message);
  }
  return response;
}

export async function postAiJson<T>(slug: JsonSlug, payload: object): Promise<T> {
  const response = await postAi(slug, payload, 'application/json');
  return response.json();
}

export async function getDailyCommercialInsights(filial: InsightsBranch, signal?: AbortSignal): Promise<DailyInsightSnapshot | null> {
  const response = await fetch(`/api/ia/metas-insights-${filial}`, {
    method: 'GET',
    mode: 'same-origin',
    headers: { Accept: 'application/json', Authorization: `Bearer ${await getPortalToken()}` },
    signal,
  });
  if (!response.ok) throw new AiApiError(response.status, 'Análises diárias indisponíveis.');
  const { snapshot } = await response.json();
  return snapshot;
}

interface StreamHandlers<T> {
  onDelta: (delta: string) => void;
  onToolAction?: (action: T) => void;
  onDone: () => void;
  onError: (message: string) => void;
  creditError?: string;
}

interface StreamEvent<T> {
  choices?: Array<{ delta?: { content?: string } }>;
  tool_action?: T;
}

async function readAiStream<T>(body: ReadableStream<Uint8Array>, { onDelta, onToolAction }: StreamHandlers<T>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      if (!done) buffer = lines.pop() ?? '';

      // The assistants send one JSON object per SSE data line.
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;

        let event: StreamEvent<T> | null;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }

        if (event?.tool_action) {
          onToolAction?.(event.tool_action);
          continue;
        }
        const delta = event?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) onDelta(delta);
      }

      if (done) return;
    }
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function streamAi<T = never>(slug: StreamSlug, payload: object, handlers: StreamHandlers<T>): Promise<void> {
  const contentType = 'text/event-stream';
  const fallback = 'Erro ao conectar com o assistente';

  try {
    const response = await postAi(slug, payload, contentType, fallback);
    if (!response.body || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== contentType) {
      throw new AiApiError(response.status, await readErrorMessage(response, fallback));
    }

    await readAiStream(response.body, handlers);
    handlers.onDone();
  } catch (error) {
    if (error instanceof AiApiError) {
      if (error.status === 429) {
        handlers.onError('Limite de requisições excedido. Aguarde um momento.');
      } else if (error.status === 402) {
        handlers.onError(handlers.creditError ?? 'Créditos esgotados. Adicione créditos à sua conta.');
      } else {
        handlers.onError(error.message);
      }
      return;
    }

    console.error('Stream error:', error);
    handlers.onError('Erro de conexão. Tente novamente.');
  }
}
