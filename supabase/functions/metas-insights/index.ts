import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { vendedores, kpis } = await req.json();
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";
const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY ou OPENAI_API_KEY não configurada");

    if (!Array.isArray(vendedores) || vendedores.length === 0) {
      return new Response(JSON.stringify({ insights: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resumoVendedores = vendedores.slice(0, 30).map((v: any) => ({
      nome: v.nome,
      meta: v.metaMensal,
      faturado: v.faturamentoMesAtual,
      pendente: v.valorPendente,
      pct_meta: v.percentualMetaFaturado,
      meta_esperada: v.metaEsperada,
    }));

    const prompt = `Você é um analista comercial sênior. Analise os dados abaixo e gere de 4 a 6 insights práticos, curtos (máx 2 linhas cada), em português, focados em ação. Use emojis sutis. Destaque: vendedores em risco, oportunidades, ritmo necessário, próximos a bater meta, líderes e quem precisa de atenção.

KPIs Gerais:
${JSON.stringify(kpis, null, 2)}

Vendedores:
${JSON.stringify(resumoVendedores, null, 2)}

Responda APENAS com JSON válido no formato: {"insights":[{"tipo":"alerta|oportunidade|info|sucesso","titulo":"...","descricao":"..."}]}`;

    const resp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI Gateway error:", resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ insights: [], error: "Limite de requisições. Tente novamente em instantes." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ insights: [], error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ insights: [], error: "IA indisponível" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify({ insights: parsed.insights || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("metas-insights error:", e);
    return new Response(JSON.stringify({ insights: [], error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
