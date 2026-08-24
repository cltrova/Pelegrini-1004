const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";
const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("OPENAI_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { context } = await req.json();

    const systemPrompt = `Você é um GERENTE DE ESTOQUE SÊNIOR com 20 anos de experiência. Analise os dados do estoque e gere insights acionáveis.

Seu papel é manter a SAÚDE DO ESTOQUE impecável. Você deve analisar:
1. **Giro de estoque**: itens que giram rápido vs parados
2. **Custos**: variações de custo médio, oportunidades de negociação com fornecedores
3. **Risco de ruptura**: itens classe A com estoque baixo
4. **Excesso**: capital parado em itens sem venda
5. **Fornecedores**: concentração, dependência, custo comparativo
6. **Curva ABC**: se a distribuição de valor está saudável
7. **Sugestões de compra**: baseado em giro e tendência
8. **Performance por marca/grupo**: quais performam e quais não

REGRAS IMPORTANTES:
- Seja DIRETO e ESPECÍFICO — cite produtos, marcas e valores reais dos dados
- Cada insight deve ter uma AÇÃO clara que o colaborador pode tomar
- Use severidade correta: critical (ação urgente), warning (atenção), success (bom desempenho), info (informativo)
- Gere entre 6 e 12 insights variados cobrindo diferentes aspectos
- Valores monetários sempre em formato R$ brasileiro`;

    const userPrompt = `Analise estes dados de estoque e retorne insights acionáveis:

${context}

Retorne usando a tool generate_insights.`;

    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
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
              name: "generate_insights",
              description: "Gera uma lista de insights de estoque categorizados",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: {
                          type: "string",
                          enum: ["giro", "custo", "ruptura", "excesso", "compra", "performance", "abc"],
                          description: "Categoria do insight",
                        },
                        title: {
                          type: "string",
                          description: "Título curto e impactante do insight (máx 60 chars)",
                        },
                        description: {
                          type: "string",
                          description: "Descrição resumida do problema ou oportunidade (1-2 frases)",
                        },
                        severity: {
                          type: "string",
                          enum: ["critical", "warning", "success", "info"],
                          description: "Gravidade: critical=ação urgente, warning=atenção, success=bom, info=informativo",
                        },
                        details: {
                          type: "string",
                          description: "Detalhes em markdown com dados específicos e ação recomendada",
                        },
                      },
                      required: ["category", "title", "description", "severity", "details"],
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
        tool_choice: { type: "function", function: { name: "generate_insights" } },
        temperature: 0.4,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${status}`);
    }

    const result = await aiResponse.json();
    
    // Extract tool call arguments
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    let insights: any[] = [];
    
    if (toolCall?.function?.arguments) {
      try {
        const args = typeof toolCall.function.arguments === 'string' 
          ? JSON.parse(toolCall.function.arguments) 
          : toolCall.function.arguments;
        insights = args.insights || [];
      } catch (e) {
        console.error("Error parsing tool call:", e);
      }
    }

    return new Response(
      JSON.stringify({ insights }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
