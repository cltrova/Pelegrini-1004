import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, contexto } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const system = `Você é o COPILOTO COMERCIAL — assistente executivo de inteligência comercial. Responda SEMPRE em português, tom executivo, direto e prático. Use markdown leve (negrito, listas curtas, emojis sutis). Quando citar números use formato brasileiro (R$, vírgula decimal, K/M para milhares/milhões). Baseie-se EXCLUSIVAMENTE no contexto fornecido abaixo. Se não houver dado suficiente, diga claramente.

CONTEXTO COMERCIAL ATUAL (resumo do dashboard):
${JSON.stringify(contexto).slice(0, 10000)}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: system }, ...messages],
        temperature: 0.4,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("OpenAI error:", resp.status, t);
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
});
