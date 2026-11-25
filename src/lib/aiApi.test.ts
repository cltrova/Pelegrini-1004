import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { postAiJson, streamAi } from './aiApi';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession } },
}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'portal-token' } } });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('browser AI API', () => {
  it('sends the current session token and unchanged JSON to the same-origin endpoint', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ text: 'Áudio' }));
    const payload = { audio: 'YXVkaW8=', mimeType: 'audio/webm' };

    await expect(postAiJson('transcribe-audio', payload)).resolves.toEqual({ text: 'Áudio' });

    expect(fetchMock).toHaveBeenCalledWith('/api/ia/transcribe-audio', expect.objectContaining({
      method: 'POST',
      mode: 'same-origin',
      body: JSON.stringify(payload),
    }));
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(Object.fromEntries(headers)).toEqual({
      accept: 'application/json',
      authorization: 'Bearer portal-token',
      'content-type': 'application/json',
    });
  });

  it('sends the Estoque file as FormData so the browser sets the multipart boundary', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ text: 'Estoque', success: true }));
    const payload = new FormData();
    payload.append('file', new Blob(['audio'], { type: 'audio/webm' }), 'audio.webm');

    await expect(postAiJson('transcribe-audio', payload)).resolves.toEqual({ text: 'Estoque', success: true });

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ia/transcribe-audio');
    expect(request?.body).toBe(payload);
    expect(new Headers(request?.headers).has('content-type')).toBe(false);
  });

  it('requires a portal session before sending a request', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } });

    await expect(postAiJson('ai-compose', { text: 'Olá', action: 'formal' })).rejects.toThrow(/login/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps application errors in successful JSON and reports failed HTTP responses', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'Sem dados' }));
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'Tente novamente' }, { status: 429 }));
    fetchMock.mockResolvedValueOnce(new Response('Unavailable', { status: 502 }));

    await expect(postAiJson('metas-insights', {})).resolves.toEqual({ error: 'Sem dados' });
    await expect(postAiJson('metas-insights', {})).rejects.toThrow('Tente novamente');
    await expect(postAiJson('metas-insights', {})).rejects.toThrow('502');
  });

  it('delivers split UTF-8 deltas and tool actions before completion and stops at [DONE]', async () => {
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start: (stream) => { controller = stream; } });
    fetchMock.mockResolvedValueOnce(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
    const handlers = { onDelta: vi.fn(), onToolAction: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
    const payload = { messages: [{ role: 'user', content: 'Olá' }], dreData: [] };
    const completion = streamAi('assistente-dre', payload, handlers);
    const encoder = new TextEncoder();

    const chunk = encoder.encode(': keepalive\r\n\r\ndata: {"choices":[{"delta":{"content":"Olá"}}]}\r');
    const utf8Split = chunk.indexOf(0xc3) + 1;
    controller.enqueue(chunk.slice(0, utf8Split));
    controller.enqueue(chunk.slice(utf8Split));
    controller.enqueue(encoder.encode('\n\r\ndata: {"tool_action":{"action":"update"}}\r\n\r\n'));

    await vi.waitFor(() => expect(handlers.onToolAction).toHaveBeenCalledWith({ action: 'update' }));
    expect(handlers.onDelta).toHaveBeenCalledExactlyOnceWith('Olá');
    expect(handlers.onDone).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/ia/assistente-dre', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(payload),
    }));
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Accept')).toBe('text/event-stream');

    controller.enqueue(encoder.encode('data: [DO'));
    controller.enqueue(encoder.encode('NE]\n\ndata: {"choices":[{"delta":{"content":"Extra"}}]}\n\n'));
    await completion;

    expect(handlers.onDelta).toHaveBeenCalledTimes(1);
    expect(handlers.onDone).toHaveBeenCalledOnce();
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('consumes a final data line when the response closes without a newline', async () => {
    fetchMock.mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"content":"Fim"}}]}', {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    }));
    const handlers = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };

    await streamAi('assistente-financeiro', {}, handlers);

    expect(handlers.onDelta).toHaveBeenCalledExactlyOnceWith('Fim');
    expect(handlers.onDone).toHaveBeenCalledOnce();
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it.each([
    [429, 'Limite de requisições excedido. Aguarde um momento.'],
    [402, 'Créditos esgotados. Adicione créditos à sua conta.'],
    [403, 'Acesso negado'],
  ])('reports stream HTTP %i through the existing error callback', async (status, message) => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'Acesso negado' }, { status }));
    const handlers = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };

    await streamAi('assistente-variacao', {}, handlers);

    expect(handlers.onError).toHaveBeenCalledExactlyOnceWith(message);
    expect(handlers.onDone).not.toHaveBeenCalled();
  });
});
