// Edge function: gera insights estratégicos sobre CATEGORIAS/GRUPOS de produtos usando OpenAI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CategoriaPayload {
  chave: string;
  faturamento: number;
  quantidade: number;
  produtos: number;
  participacao?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { categorias, periodo, categoriaFoco } = await req.json() as {
      categorias: CategoriaPayload[];
      periodo?: string;
      categoriaFoco?: string | null;
    };

    if (!Array.isArray(categorias) || categorias.length === 0) {
      return new Response(
        JSON.stringify({ error: "Lista de categorias vazia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalReceita = categorias.reduce((a, c) => a + (c.faturamento || 0), 0);
    const totalQtd = categorias.reduce((a, c) => a + (c.quantidade || 0), 0);
    const totalSkus = categorias.reduce((a, c) => a + (c.produtos || 0), 0);

    const ordenadas = [...categorias].sort((a, b) => b.faturamento - a.faturamento);
    const top = ordenadas.slice(0, 15).map(c => ({
      cat: c.chave?.slice(0, 40),
      fat: Math.round(c.faturamento),
      qtd: Math.round(c.quantidade),
      skus: c.produtos,
      part: totalReceita > 0 ? +(100 * c.faturamento / totalReceita).toFixed(1) : 0,
      ticket_skuh: c.produtos > 0 ? Math.round(c.faturamento / c.produtos) : 0,
    }));
    const cauda = ordenadas.slice(-8).map(c => ({
      cat: c.chave?.slice(0, 40),
      fat: Math.round(c.faturamento),
      skus: c.produtos,
      part: totalReceita > 0 ? +(100 * c.faturamento / totalReceita).toFixed(2) : 0,
    }));

    const systemPrompt = `Você é um analista comercial sênior especializado em mix por categoria/grupo de produtos.
Analise as categorias e gere EXATAMENTE 3 insights estratégicos, acionáveis e diferentes entre si.
Cada insight deve ter:
- title: título curto (máx 4 palavras), em PT-BR
- categoria: nome curto da categoria principal do insight (ou null se geral)
- value: métrica destaque curta (ex: "R$ 5.7M", "14.8% do total", "Top #1")
- insight: análise objetiva em 1 frase (máx 130 caracteres), em PT-BR, com ação recomendada
- type: um de "oportunidade" | "alerta" | "destaque" | "risco"

Escolha 3 ângulos DIFERENTES entre:
1. Categoria líder e dependência/concentração de receita
2. Categoria com poucos SKUs mas alto faturamento (campeã de eficiência)
3. Categoria com muitos SKUs mas baixo faturamento (canibalização / mix inflado)
4. Risco de concentração no top 3 vs cauda longa
5. Categoria emergente/oportunidade na cauda
${categoriaFoco ? `\nO usuário FILTROU pela categoria "${categoriaFoco}" — todos os insights devem ser sobre essa categoria.` : ""}
Seja direto, executivo, com NÚMEROS reais.`;

    const userPrompt = `Período: ${periodo || "atual"}
Total categorias: ${categorias.length}
Faturamento total: R$ ${totalReceita.toLocaleString("pt-BR")}
Quantidade total: ${totalQtd.toLocaleString("pt-BR")}
SKUs totais: ${totalSkus.toLocaleString("pt-BR")}
${categoriaFoco ? `\nCATEGORIA EM FOCO: ${categoriaFoco}\n` : ""}
Top 15 categorias:
${JSON.stringify(top, null, 2)}

Cauda (8 menores):
${JSON.stringify(cauda, null, 2)}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_insights",
              description: "Emite os 3 insights estratégicos sobre categorias",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        categoria: { type: ["string", "null"] },
                        value: { type: "string" },
                        insight: { type: "string" },
                        type: { type: "string", enum: ["oportunidade", "alerta", "destaque", "risco"] },
                      },
                      required: ["title", "categoria", "value", "insight", "type"],
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

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Muitas requisições à OpenAI. Tente novamente em alguns segundos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (response.status === 401) {
      return new Response(JSON.stringify({ error: "Chave da OpenAI inválida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (response.status === 402 || response.status === 403) {
      return new Response(JSON.stringify({ error: "Sem créditos na OpenAI." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!response.ok) {
      const txt = await response.text();
      console.error("OpenAI error", response.status, txt);
      return new Response(JSON.stringify({ error: "Falha ao gerar insights" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments;
    if (!args) {
      return new Response(JSON.stringify({ error: "Resposta inválida da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const parsed = typeof args === "string" ? JSON.parse(args) : args;

    return new Response(
      JSON.stringify({ insights: parsed.insights, totals: { totalReceita, totalQtd, totalSkus, count: categorias.length } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("categorias-insights error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
