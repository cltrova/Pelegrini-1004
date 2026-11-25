import { getOpenAiApiKey, OPENAI_CHAT_URL } from './ai-provider.ts';

export interface SmartReplyMessage {
  content: string | null;
  from_me: boolean;
  message_type: string;
}

const fallback = ['Entendi, vou verificar.', 'Agradeço o contato!', 'Um momento, por favor.'];
const greeting = ['Olá! Como posso ajudar?', 'Bom dia! Em que posso ser útil?', 'Estou à disposição!'];

const prompt = `Você é um assistente que gera sugestões de resposta rápida para atendentes de WhatsApp.

Com base no histórico da conversa, gere exatamente três respostas profissionais de até 60 caracteres. Seja objetivo e amigável. Inclua uma confirmação, uma solicitação de informação e uma resposta empática.

Retorne apenas um JSON no formato {"replies":["resposta1","resposta2","resposta3"]}.`;

function isText(message: unknown): message is SmartReplyMessage & { content: string } {
  if (!message || typeof message !== 'object') return false;
  const item = message as Partial<SmartReplyMessage>;
  return item.message_type === 'text' && typeof item.from_me === 'boolean' && typeof item.content === 'string' && item.content.length > 0;
}

export async function suggestSmartReplies(recentMessages: readonly unknown[], signal?: AbortSignal) {
  const messages = recentMessages.slice(0, 10).filter(isText);
  const lastCustomerMessage = messages.find(message => !message.from_me)?.content;
  if (!lastCustomerMessage) return { replies: greeting };

  const apiKey = getOpenAiApiKey();
  if (!apiKey) return { error: 'A chave de IA precisa ser configurada.', replies: fallback };

  const formattedMessages = messages.slice(0, 6).reverse()
    .map(message => `${message.from_me ? 'Atendente' : 'Cliente'}: ${message.content}`)
    .join('\n');

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Última mensagem do cliente: "${lastCustomerMessage}"\n\nContexto da conversa:\n${formattedMessages}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 200,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      console.error('Falha nas sugestões para WhatsApp:', response.status, response.headers.get('x-request-id'));
      return { replies: fallback };
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return { replies: fallback };
    const parsed = JSON.parse(content);
    const replies = Array.isArray(parsed?.replies)
      ? parsed.replies.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0).slice(0, 3)
      : [];
    return { replies: replies.length ? replies : fallback };
  } catch {
    return { replies: fallback };
  }
}

export async function handleSmartReplyRequest(request: Request): Promise<Response> {
  const input = await request.json().catch(() => null);
  if (!Array.isArray(input?.messages)) {
    return Response.json({ error: 'Envie o histórico recente da conversa.' }, { status: 400 });
  }
  return Response.json(await suggestSmartReplies(input.messages, request.signal));
}
