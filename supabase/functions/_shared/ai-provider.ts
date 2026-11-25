export const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
export const OPENAI_TRANSCRIPTION_URL = 'https://api.openai.com/v1/audio/transcriptions';

type AiHandler = (request: Request) => Promise<Response>;
const runtime = globalThis as typeof globalThis & {
  Deno?: { env: { get(name: string): string | undefined }; serve(handler: AiHandler): unknown };
  process?: { env: Record<string, string | undefined> };
};

function readEnv(name: string) {
  const value = runtime.Deno ? runtime.Deno.env.get(name) : runtime.process?.env[name];
  return value?.trim() || undefined;
}

export function getOpenAiApiKey() {
  return readEnv('OPENAI_API_KEY');
}

export function getChatProvider() {
  if (runtime.Deno) {
    const url = readEnv('AI_GATEWAY_URL');
    const apiKey = readEnv('AI_GATEWAY_API_KEY');
    const endpoint = url ? URL.parse(url) : null;
    if (apiKey && endpoint?.protocol === 'https:' && endpoint.hostname !== 'api.openai.com') {
      return { url: endpoint.href, apiKey, model: 'google/gemini-2.5-flash' };
    }
  }

  return { url: OPENAI_CHAT_URL, apiKey: getOpenAiApiKey(), model: 'gpt-4o-mini' };
}

export function serveLegacyAi(handler: AiHandler) {
  runtime.Deno?.serve(handler);
}
