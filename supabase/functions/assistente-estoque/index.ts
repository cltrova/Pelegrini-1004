const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";
const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("OPENAI_API_KEY");

const DOCUMENT_TOOL = {
  type: "function",
  function: {
    name: "generate_document",
    description: "Gera um documento formatado (pedido de compra, relatório de estoque, análise) para download em PDF ou Word. Use quando o usuário pedir para gerar, criar, montar ou exportar um documento, pedido de compra, relatório ou análise formal.",
    parameters: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: ["pedido_compra", "relatorio_estoque", "relatorio_giro", "analise_geral"],
          description: "Tipo do documento",
        },
        titulo: { type: "string", description: "Título do documento" },
        numero: { type: "string", description: "Número do documento (ex: PC-2024-EATON-001)" },
        data: { type: "string", description: "Data do documento no formato DD/MM/YYYY" },
        fornecedor: { type: "string", description: "Nome do fornecedor (para pedidos de compra)" },
        solicitante: { type: "string", description: "Quem solicita (ex: Gerente de Estoque)" },
        status: { type: "string", description: "Status do documento (ex: Aguardando Aprovação)" },
        itens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              cod_produto: { type: "string" },
              produto: { type: "string" },
              quantidade: { type: "number" },
              custo_unitario: { type: "number" },
              subtotal: { type: "number" },
              marca: { type: "string" },
              grupo: { type: "string" },
              observacao: { type: "string" },
            },
            required: ["produto", "quantidade"],
          },
          description: "Lista de itens/produtos do documento",
        },
        total_quantidade: { type: "number" },
        total_valor: { type: "number" },
        observacoes: { type: "string", description: "Observações gerais do documento" },
        resumo: { type: "string", description: "Resumo executivo (para relatórios)" },
        secoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              conteudo: { type: "string" },
            },
            required: ["titulo", "conteudo"],
          },
          description: "Seções adicionais do relatório",
        },
      },
      required: ["tipo", "titulo", "data", "itens"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, context, customPrompt } = await req.json();

    const basePrompt = `Você é um gerente de estoque sênior altamente experiente. Você tem acesso COMPLETO a todos os dados de estoque e movimentação (giro) da empresa.

IMPORTANTE — COMO OS DADOS SÃO ORGANIZADOS:
Os dados foram enviados como RESUMOS AGREGADOS (totais por marca, grupo, fornecedor, empresa, curva ABC) e duas listas de TOP 50 produtos (por valor e por tempo parado). Você DEVE usar esses dados para responder.

Quando o usuário perguntar sobre uma MARCA específica (ex: "Eaton", "Bosch", "SKF"):
- Procure na seção "TODAS AS MARCAS" a linha correspondente (parcial ou total, case-insensitive)
- Mostre os totais: quantidade de itens, quantidade em estoque, valor, custo médio ponderado, itens parados
- Se a marca aparecer no "GIRO POR MARCA", mostre também vendas e compras

Quando o usuário perguntar sobre um GRUPO específico:
- Procure na seção "TODOS OS GRUPOS" 

Quando o usuário perguntar sobre FORNECEDOR:
- Procure na seção "TODOS OS FORNECEDORES"

Quando o usuário perguntar sobre um PRODUTO específico:
- Procure nos TOP 50 por valor ou TOP 50 parados
- Se não encontrar, informe os totais da marca/grupo do produto

Quando o usuário perguntar sobre GIRO ou MOVIMENTAÇÃO:
- Use a seção "GIRO POR MARCA" para totais de vendas, compras e transferências

GERAÇÃO DE DOCUMENTOS:
Quando o usuário pedir para GERAR, CRIAR, MONTAR, EXPORTAR um documento, pedido de compra, relatório ou análise:
- Use a ferramenta generate_document para criar o documento estruturado
- Preencha TODOS os campos relevantes com dados reais do estoque
- Para pedidos de compra: inclua cod_produto, produto, quantidade sugerida, custo_unitario, subtotal, marca
- Para relatórios: use seções para organizar a análise e inclua itens relevantes
- Sempre calcule total_quantidade e total_valor
- Adicione observações úteis
- IMPORTANTE: Também escreva uma mensagem textual resumindo o documento gerado

REGRAS DE RESPOSTA:
- Sempre responda em português brasileiro
- Use formatação markdown para organizar
- Quando falar de valores, use R$ e formato brasileiro
- Seja objetivo e direto
- NUNCA diga que não tem acesso aos dados — você TEM todos os dados agregados
- Se o usuário mencionar qualquer marca, grupo, produto ou fornecedor, SEMPRE procure nos dados antes de responder
- Se não encontrar resultados para um filtro, informe que não há dados para aquele critério específico e sugira alternativas similares
- Quando listar dados, mostre em tabela markdown quando possível
- Calcule totalizadores quando relevante

SEÇÕES DISPONÍVEIS NOS DADOS:
- RESUMO GERAL: totais globais
- POR EMPRESA: totais por filial
- CURVA ABC: distribuição A/B/C
- TODAS AS MARCAS: agregado completo por marca (itens, qtd, valor, custo médio, parados, última venda)
- TODOS OS GRUPOS: agregado por grupo
- TODOS OS FORNECEDORES: agregado por fornecedor
- GIRO POR MARCA: vendas, compras, transferências por marca
- TOP 50 PRODUTOS POR VALOR: os 50 produtos mais valiosos em estoque
- TOP 50 PRODUTOS PARADOS: os 50 produtos sem venda há mais tempo`;

    const customInstructions = customPrompt ? `\n\nINSTRUÇÕES PERSONALIZADAS DO USUÁRIO:\n${customPrompt}` : '';

    const systemPrompt = `${basePrompt}${customInstructions}

DADOS DO ESTOQUE DA EMPRESA:
${context}`;

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
          ...messages.slice(-10),
        ],
        tools: [DOCUMENT_TOOL],
        max_tokens: 4000,
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${status}`);
    }

    const result = await aiResponse.json();
    const choice = result.choices?.[0]?.message;
    const textContent = choice?.content || "";
    let documentData = null;

    // Check for tool calls
    if (choice?.tool_calls?.length) {
      for (const tc of choice.tool_calls) {
        if (tc.function?.name === 'generate_document') {
          try {
            const args = typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments;
            documentData = args;
          } catch (e) {
            console.error("Error parsing tool call:", e);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        response: textContent || (documentData ? "Documento gerado com sucesso! Use os botões abaixo para baixar." : "Não consegui processar sua pergunta."),
        document: documentData,
      }),
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
