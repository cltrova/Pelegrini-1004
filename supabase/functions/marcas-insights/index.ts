// Edge function: gera insights estratégicos sobre marcas usando OpenAI (gpt-5-mini)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarcaPayload {
  marca: string;
  faturamento: number;
  lucro: number;
  margem: number;
  participacao: number;
  produtos: number;
  quantidade: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { marcas, periodo, marcaFoco } = await req.json() as {
      marcas: MarcaPayload[];
      periodo?: string;
      marcaFoco?: string | null;
    };

    if (!Array.isArray(marcas) || marcas.length === 0) {
      return new Response(
        JSON.stringify({ error: "Lista de marcas vazia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";
const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!AI_GATEWAY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI_GATEWAY_API_KEY ou OPENAI_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ranking completo (calcula posição da marca focada)
    const ranked = [...marcas].sort((a, b) => b.faturamento - a.faturamento);
    const totalReceitaPortfolio = ranked.reduce((a, m) => a + m.faturamento, 0);
    const totalLucroPortfolio = ranked.reduce((a, m) => a + m.lucro, 0);
    const margemPortfolio = totalReceitaPortfolio > 0
      ? (totalLucroPortfolio / totalReceitaPortfolio) * 100
      : 0;

    // Top 30 marcas (controla tokens)
    const top = ranked.slice(0, 30).map(m => ({
      marca: m.marca,
      faturamento: Math.round(m.faturamento),
      lucro: Math.round(m.lucro),
      margem: Number(m.margem.toFixed(1)),
      share: Number(m.participacao.toFixed(2)),
      skus: m.produtos,
      qtd: m.quantidade,
    }));

    const focoIdx = marcaFoco
      ? ranked.findIndex(m => m.marca?.toUpperCase().trim() === marcaFoco.toUpperCase().trim())
      : -1;
    const focoData = focoIdx >= 0 ? ranked[focoIdx] : null;
    const focoPosicao = focoIdx >= 0 ? focoIdx + 1 : null;

    // Garante a marca focada no payload mesmo se fora do top 30
    if (focoData && !top.some(t => t.marca?.toUpperCase().trim() === focoData.marca?.toUpperCase().trim())) {
      top.push({
        marca: focoData.marca,
        faturamento: Math.round(focoData.faturamento),
        lucro: Math.round(focoData.lucro),
        margem: Number(focoData.margem.toFixed(1)),
        share: Number(focoData.participacao.toFixed(2)),
        skus: focoData.produtos,
        qtd: focoData.quantidade,
      });
    }

    const totalReceita = top.reduce((a, m) => a + m.faturamento, 0);
    const totalLucro = top.reduce((a, m) => a + m.lucro, 0);

    const systemPrompt = marcaFoco && focoData
      ? `Você é um analista comercial sênior. O usuário FILTROU EXCLUSIVAMENTE a marca "${marcaFoco}".
TODOS os 4 insights DEVEM ser sobre essa marca específica — nunca sobre outras marcas.
Use as outras marcas APENAS como benchmark dentro do texto.

Cada insight deve ter:
- title: título curto (máx 4 palavras), em PT-BR
- marca: SEMPRE EXATAMENTE "${marcaFoco}" (obrigatório nos 4 insights)
- value: métrica destaque curta da marca focada (ex: "R$ 1.2M", "32% margem", "#3 ranking")
- insight: análise objetiva em 1 frase (máx 120 chars), em PT-BR, com ação recomendada
- type: um de "oportunidade" | "alerta" | "destaque" | "risco"

4 ângulos OBRIGATÓRIOS e DIFERENTES sobre "${marcaFoco}":
1. POSIÇÃO/REPRESENTATIVIDADE: ranking + share da marca no portfólio
2. RENTABILIDADE: margem da marca vs margem média do portfólio (${margemPortfolio.toFixed(1)}%)
3. VOLUME E MIX: SKUs ativos, quantidade vendida e ticket por SKU
4. RISCO OU OPORTUNIDADE específica desta marca
Seja direto, executivo, com NÚMEROS REAIS da marca focada.`
      : `Você é um analista comercial sênior especializado em análise de portfólio de marcas.
Analise os dados e gere EXATAMENTE 4 insights estratégicos, acionáveis e diferentes entre si.
Cada insight deve ter:
- title: título curto (máx 4 palavras), em PT-BR
- marca: nome EXATO da marca principal do insight (ou null se for geral)
- value: métrica destaque curta (ex: "R$ 1.2M", "32% margem", "5 marcas")
- insight: análise objetiva em 1 frase (máx 120 caracteres), em PT-BR, com ação recomendada
- type: um de "oportunidade" | "alerta" | "destaque" | "risco"

Tipos de insight para variar (escolha 4 diferentes):
1. Maior gerador de receita absoluta + recomendação
2. Marca com melhor rentabilidade (margem alta + volume relevante)
3. Risco/alerta: marca grande com margem baixa OU concentração excessiva
4. Oportunidade oculta: marca pequena com margem excepcional OU baixo giro
Seja direto, executivo, sem jargão. Use os dados reais fornecidos.`;

    const userPrompt = `Período: ${periodo || "atual"}
Total receita portfólio: R$ ${totalReceitaPortfolio.toLocaleString("pt-BR")}
Total lucro portfólio: R$ ${totalLucroPortfolio.toLocaleString("pt-BR")}
Margem média portfólio: ${margemPortfolio.toFixed(1)}%
${marcaFoco && focoData ? `\n=== MARCA EM FOCO (analisar EXCLUSIVAMENTE) ===
Nome: ${marcaFoco}
Posição no ranking: #${focoPosicao} de ${ranked.length}
Dados completos: ${JSON.stringify(focoData, null, 2)}
=================================================\n` : ""}
Marcas (benchmark${marcaFoco ? ' apenas' : ''}):
${JSON.stringify(top, null, 2)}`;


    const callOpenAI = () => fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_insights",
              description: "Emite os 4 insights estratégicos sobre as marcas",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    minItems: 4,
                    maxItems: 4,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        marca: { type: ["string", "null"] },
                        value: { type: "string" },
                        insight: { type: "string" },
                        type: { type: "string", enum: ["oportunidade", "alerta", "destaque", "risco"] },
                      },
                      required: ["title", "marca", "value", "insight", "type"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["insights"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_insights" } },
      }),
    });

    // Retenta em 429/5xx com backoff (respeita Retry-After)
    let response = await callOpenAI();
    for (let tentativa = 0; tentativa < 3 && (response.status === 429 || response.status >= 500); tentativa++) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const espera = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 8000)
        : 1000 * Math.pow(2, tentativa) + Math.random() * 400;
      await new Promise((r) => setTimeout(r, espera));
      response = await callOpenAI();
    }

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições atingido. Aguarde alguns segundos e tente novamente." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (response.status === 401) {
      return new Response(
        JSON.stringify({ error: "Credencial de IA inválida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (response.status === 402 || response.status === 403) {
      return new Response(
        JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace Lovable." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!response.ok) {
      const txt = await response.text();
      console.error("OpenAI error", response.status, txt);
      return new Response(
        JSON.stringify({ error: "Falha ao gerar insights" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      return new Response(
        JSON.stringify({ error: "Resposta inválida da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const parsed = typeof args === "string" ? JSON.parse(args) : args;

    return new Response(
      JSON.stringify({ insights: parsed.insights }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("marcas-insights error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
