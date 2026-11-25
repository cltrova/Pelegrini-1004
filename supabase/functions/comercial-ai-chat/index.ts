import { serveLegacyAi, getOpenAiApiKey, OPENAI_CHAT_URL } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function handleAiRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, contexto } = await req.json();
    const OPENAI_API_KEY = getOpenAiApiKey();
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const system = `Você é o COPILOTO COMERCIAL — assistente executivo de inteligência comercial. Responda SEMPRE em português, tom executivo, direto e prático. Use markdown leve (negrito, listas curtas, emojis sutis). Quando citar números use formato brasileiro (R$, vírgula decimal, K/M para milhares/milhões). Baseie-se EXCLUSIVAMENTE no contexto fornecido abaixo. Se não houver dado suficiente, diga claramente.

CONTEXTO COMERCIAL ATUAL (resumo do dashboard):
${JSON.stringify(contexto).slice(0, 10000)}`;

    const resp = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: system }, ...messages],
        temperature: 0.4,
      }),
    });

    if (!resp.ok) {
      await resp.body?.cancel();
      console.error("OpenAI error:", resp.status, resp.headers.get("x-request-id"));
      return new Response(JSON.stringify({ reply: "❌ IA indisponível no momento. Tente novamente em instantes." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content || "Sem resposta.";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("comercial-ai-chat error:", e);
    return new Response(JSON.stringify({ reply: "❌ Erro: " + String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

serveLegacyAi(handleAiRequest);
