import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { campanhas } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    if (!Array.isArray(campanhas) || campanhas.length === 0) {
      return new Response(JSON.stringify({ insights: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resumo = campanhas.map((c: any) => ({
      nome: c.nome,
      marca: c.marca,
      meta: c.meta_valor,
      realizado: c.realizado,
      progresso_pct: c.progresso,
      dias_restantes: c.diasRestantes,
      dias_totais: c.diasTotais,
      premiacao: c.premiacao,
    }));

    const prompt = `Você é um analista comercial sênior. Analise as campanhas abaixo e gere de 3 a 5 insights práticos, curtos (máx 2 linhas cada), em português, focados em ação. Use emojis sutis. Destaque: campanhas em risco, oportunidades, ritmo necessário, próximas a bater meta.

Dados:
${JSON.stringify(resumo, null, 2)}

Responda APENAS com JSON válido no formato: {"insights":[{"tipo":"alerta|oportunidade|info","titulo":"...","descricao":"..."}]}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("OpenAI error:", resp.status, t);
      return new Response(JSON.stringify({ insights: [], error: "AI indisponível" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify({ insights: parsed.insights || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("campanhas-insights error:", e);
    return new Response(JSON.stringify({ insights: [], error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
