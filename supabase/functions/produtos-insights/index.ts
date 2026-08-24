// Edge function: gera insights estratégicos sobre TOP PRODUTOS usando OpenAI (gpt-5-mini)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProdutoPayload {
  cod_produto: string | number;
  descricao: string;
  marca?: string | null;
  faturamento: number;
  quantidade: number;
  participacao?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { produtos, periodo, marcaFoco } = await req.json() as {
      produtos: ProdutoPayload[];
      periodo?: string;
      marcaFoco?: string | null;
    };

    if (!Array.isArray(produtos) || produtos.length === 0) {
      return new Response(
        JSON.stringify({ error: "Lista de produtos vazia" }),
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

    const totalReceita = produtos.reduce((a, p) => a + (p.faturamento || 0), 0);
    const totalQtd = produtos.reduce((a, p) => a + (p.quantidade || 0), 0);
    const ticketMedio = produtos.length > 0 ? totalReceita / produtos.length : 0;

    // Top 30 + amostra de cauda longa para a IA enxergar oportunidades ocultas
    const ordenados = [...produtos].sort((a, b) => b.faturamento - a.faturamento);
    const top = ordenados.slice(0, 25).map(p => ({
      cod: String(p.cod_produto),
      desc: p.descricao?.slice(0, 60),
      marca: p.marca || null,
      fat: Math.round(p.faturamento),
      qtd: Math.round(p.quantidade),
      ticket: p.quantidade > 0 ? Math.round(p.faturamento / p.quantidade) : 0,
    }));
    const cauda = ordenados.slice(-10).map(p => ({
      cod: String(p.cod_produto),
      desc: p.descricao?.slice(0, 60),
      marca: p.marca || null,
      fat: Math.round(p.faturamento),
      qtd: Math.round(p.quantidade),
    }));

    const systemPrompt = `Você é um analista comercial sênior especializado em mix de produtos.
Analise o ranking de produtos e gere EXATAMENTE 3 insights estratégicos, acionáveis e diferentes entre si.
Cada insight deve ter:
- title: título curto (máx 4 palavras), em PT-BR
- produto: descrição curta do produto principal do insight (ou null se for geral)
- value: métrica destaque curta (ex: "R$ 1.2M", "32% do total", "Top #1")
- insight: análise objetiva em 1 frase (máx 130 caracteres), em PT-BR, com ação recomendada
- type: um de "oportunidade" | "alerta" | "destaque" | "risco"

Escolha 3 ângulos DIFERENTES entre:
1. Produto-líder e dependência/concentração de receita
2. Ticket médio: SKU com ticket muito acima da média (premium) ou muito abaixo
3. Risco de concentração no top 5 vs cauda longa
4. Oportunidade oculta na cauda (giro baixo / produto candidato a remoção ou impulso)
5. Comparativo de marca dominante no ranking
${marcaFoco ? `\nO usuário FILTROU pela marca "${marcaFoco}" — todos os insights devem ser sobre essa marca.` : ""}
Seja direto, executivo, com NÚMEROS reais.`;

    const userPrompt = `Período: ${periodo || "atual"}
Total produtos: ${produtos.length}
Faturamento total: R$ ${totalReceita.toLocaleString("pt-BR")}
Quantidade total: ${totalQtd.toLocaleString("pt-BR")}
Ticket médio por SKU: R$ ${ticketMedio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
${marcaFoco ? `\nMARCA EM FOCO: ${marcaFoco}\n` : ""}
Top 25 produtos:
${JSON.stringify(top, null, 2)}

Cauda longa (10 menores):
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
              description: "Emite os 3 insights estratégicos sobre os produtos",
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
                        produto: { type: ["string", "null"] },
                        value: { type: "string" },
                        insight: { type: "string" },
                        type: { type: "string", enum: ["oportunidade", "alerta", "destaque", "risco"] },
                      },
                      required: ["title", "produto", "value", "insight", "type"],
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
      return new Response(
        JSON.stringify({ error: "Muitas requisições à OpenAI. Tente novamente em alguns segundos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (response.status === 401) {
      return new Response(
        JSON.stringify({ error: "Chave da OpenAI inválida. Verifique o secret OPENAI_API_KEY." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (response.status === 402 || response.status === 403) {
      return new Response(
        JSON.stringify({ error: "Sem créditos na OpenAI. Adicione saldo em platform.openai.com → Billing." }),
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
      JSON.stringify({ insights: parsed.insights, totals: { totalReceita, totalQtd, ticketMedio, count: produtos.length } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("produtos-insights error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
