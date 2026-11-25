import { serveLegacyAi, getOpenAiApiKey, OPENAI_CHAT_URL } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function handleAiRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { contexto } = await req.json();
    const OPENAI_API_KEY = getOpenAiApiKey();
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const prompt = `Você é um copiloto comercial executivo. Com base nos dados abaixo, gere de 5 a 7 INSIGHTS curtos (1 frase, no máximo 90 caracteres cada), em PORTUGUÊS, tom executivo e direto, focados em ação ou padrão detectado. Use emojis sutis no início (📈 📉 🔥 ⚠️ 💡 🎯 ⭐). Cite filiais, vendedores, categorias ou clientes quando possível.

DADOS:
${JSON.stringify(contexto).slice(0, 8000)}

Responda APENAS com JSON válido no formato: {"insights":[{"emoji":"📈","texto":"...","tipo":"positivo|alerta|info"}]}`;

    const resp = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.5,
      }),
    });

    if (!resp.ok) {
      await resp.body?.cancel();
      console.error("OpenAI error:", resp.status, resp.headers.get("x-request-id"));
      return new Response(JSON.stringify({ insights: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return new Response(JSON.stringify({ insights: parsed.insights || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("comercial-ai-feed error:", e);
    return new Response(JSON.stringify({ insights: [], error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

serveLegacyAi(handleAiRequest);
