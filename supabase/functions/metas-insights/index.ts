import { serveLegacyAi, getChatProvider } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function handleAiRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { vendedores, kpis } = await req.json();
    const { url: AI_GATEWAY_URL, apiKey: AI_GATEWAY_API_KEY, model: providerModel } = getChatProvider();
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

    const prompt = `Você é um analista comercial. Escreva de 4 a 6 análises curtas, em português do Brasil, para o gestor. Use títulos de até 70 caracteres e uma frase de até 220 caracteres por descrição. Baseie cada análise nos números informados e sugira uma ação concreta. Respeite o período e a fonte. Não invente métricas, tendências, resultados ou causas. Use ícones somente na interface, mantenha o texto sem emojis.

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
        model: providerModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
      signal: req.signal,
    });

    if (!resp.ok) {
      await resp.body?.cancel();
      console.error("AI Gateway error:", resp.status, resp.headers.get("x-request-id"));
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
    console.error("metas-insights error:", e instanceof Error ? e.name : "unknown");
    return new Response(JSON.stringify({ insights: [], error: "IA indisponível" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

serveLegacyAi(handleAiRequest);
