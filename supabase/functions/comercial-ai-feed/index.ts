import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { contexto } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const prompt = `Você é um copiloto comercial executivo. Com base nos dados abaixo, gere de 5 a 7 INSIGHTS curtos (1 frase, no máximo 90 caracteres cada), em PORTUGUÊS, tom executivo e direto, focados em ação ou padrão detectado. Use emojis sutis no início (📈 📉 🔥 ⚠️ 💡 🎯 ⭐). Cite filiais, vendedores, categorias ou clientes quando possível.

DADOS:
${JSON.stringify(contexto).slice(0, 8000)}

Responda APENAS com JSON válido no formato: {"insights":[{"emoji":"📈","texto":"...","tipo":"positivo|alerta|info"}]}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
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
      const t = await resp.text();
      console.error("OpenAI error:", resp.status, t);
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
});
