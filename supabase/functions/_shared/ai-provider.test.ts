import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getChatProvider, getOpenAiApiKey, OPENAI_CHAT_URL } from './ai-provider.ts';
import { handleAiRequest as estoque } from '../assistente-estoque/index.ts';
import { handleAiRequest as dre } from '../assistente-dre/index.ts';
import { handleAiRequest as comercial } from '../comercial-ai-chat/index.ts';
import { handleAiRequest as transcricao } from '../transcribe-audio/index.ts';
import { handleSmartReplyRequest } from './smart-replies.ts';

test('the Pelegrini runtime uses the shared OpenAI key and an OpenAI model', () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = ' test-project-key ';
  try {
    assert.equal(getOpenAiApiKey(), 'test-project-key');
    assert.deepEqual(getChatProvider(), {
      url: OPENAI_CHAT_URL,
      apiKey: 'test-project-key',
      model: 'gpt-4o-mini',
    });
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test('estoque, financeiro, comercial e WhatsApp enviam a mesma chave somente à OpenAI', async (t) => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalGateway = process.env.AI_GATEWAY_URL;
  process.env.OPENAI_API_KEY = 'test-project-key';
  process.env.AI_GATEWAY_URL = 'https://old-gateway.example.test/';
  t.after(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalGateway === undefined) delete process.env.AI_GATEWAY_URL;
    else process.env.AI_GATEWAY_URL = originalGateway;
  });

  const captured: { url: URL; init?: RequestInit }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    captured.push({ url, init });
    if (url.pathname.endsWith('/transcriptions')) return Response.json({ text: 'Áudio fictício.' });
    const payload = JSON.parse(String(init?.body));
    if (payload.stream) return new Response('data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    if (payload.response_format?.type === 'json_object') {
      return Response.json({ choices: [{ message: { content: '{"replies":["Vou verificar."]}' } }] });
    }
    return Response.json({ choices: [{ message: { content: 'Resposta de teste.' } }] });
  });

  const messages = [{ role: 'user', content: 'Mostre um exemplo fictício.' }];
  function request(body: object) {
    return new Request('http://pelegrini.example.test/api/ia/', { method: 'POST', body: JSON.stringify(body) });
  }

  assert.deepEqual(await (await estoque(request({ messages, context: 'Dados fictícios' }))).json(),
    { response: 'Resposta de teste.', document: null });
  assert.deepEqual(await (await comercial(request({ messages, contexto: {} }))).json(), { reply: 'Resposta de teste.' });
  const stream = await dre(request({ messages, dreData: [] }));
  assert.match(stream.headers.get('Content-Type') ?? '', /^text\/event-stream/);
  assert.equal(await stream.text(), 'data: [DONE]\n\n');
  assert.deepEqual(await (await transcricao(request({ audio: 'b2k=', mimeType: 'audio/webm' }))).json(),
    { text: 'Áudio fictício.', success: true });
  const audioForm = new FormData();
  audioForm.append('file', new Blob(['Áudio fictício'], { type: 'audio/webm' }), 'audio.webm');
  const audioRequest = new Request('http://pelegrini.example.test/api/ia/transcribe-audio', { method: 'POST', body: audioForm });
  assert.deepEqual(await (await transcricao(audioRequest)).json(), { text: 'Áudio fictício.', success: true });
  assert.deepEqual(await (await handleSmartReplyRequest(request({
    messages: [{ content: 'Mensagem fictícia.', from_me: false, message_type: 'text' }],
  }))).json(), { replies: ['Vou verificar.'] });

  assert.equal(captured.length, 7);
  for (const { url, init } of captured) {
    assert.equal(url.origin, 'https://api.openai.com');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-project-key');
    if (url.pathname.endsWith('/completions')) assert.equal(JSON.parse(String(init?.body)).model, 'gpt-4o-mini');
    else assert.ok((init?.body as FormData).get('model'));
  }
});
