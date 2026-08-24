import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CONTAS_DESP_VARIAVEIS = [
  '3.1.1.02.02.00001','3.1.1.02.02.00002','3.1.1.02.02.00003','3.1.1.02.02.00004',
  '3.1.1.02.02.00005','3.1.1.02.02.00006','3.1.1.02.02.00007','3.1.1.02.02.00008',
  '3.1.1.02.02.00009','3.1.1.02.02.00024','3.1.1.02.02.00011','3.1.1.02.02.00012',
  '3.1.1.02.02.00013','3.1.1.02.02.00014','3.1.1.02.02.00015','3.1.1.02.02.00016',
  '3.1.1.02.02.00017','3.1.1.02.02.00018','3.1.1.02.02.00019','3.1.1.02.02.00020',
  '3.1.2.01.01.00015','3.1.2.01.01.00010','3.1.2.01.01.00016','3.1.2.01.01.00014',
  '3.1.2.01.02.00001','3.1.2.01.02.00002','3.1.2.01.02.00003',
  '3.1.2.02.01.00010','3.1.2.03.01.00001','3.1.2.03.01.00002','3.1.2.04.01.00001',
];

const CONTAS_DESP_FIXAS = [
  '3.1.2.01.01.00001','3.1.2.01.01.00002','3.1.2.01.01.00003','3.1.2.01.01.00004',
  '3.1.2.01.01.00005','3.1.2.01.01.00006','3.1.2.01.01.00007','3.1.2.01.01.00008',
  '3.1.2.01.01.00011','3.1.2.01.02.00004','3.1.2.02.03.00005','3.1.2.01.02.00006',
  '3.1.2.02.01.00001','3.1.2.02.01.00002','3.1.2.02.01.00003','3.1.2.02.01.00004',
  '3.1.2.02.01.00005','3.1.2.02.01.00006','3.1.2.02.01.00007','3.1.2.02.01.00008',
  '3.1.2.02.01.00009','3.1.2.02.01.00011','3.1.2.02.02.00001','3.1.2.02.02.00002',
  '3.1.2.02.02.00003','3.1.2.02.02.00004','3.1.2.02.02.00005','3.1.2.02.02.00006',
  '3.1.2.02.02.00007','3.1.2.02.02.00008','3.1.2.02.02.00009','3.1.2.02.02.00010',
  '3.1.2.02.02.00011','3.1.2.02.02.00012','3.1.2.02.02.00013','3.1.2.02.02.00014',
  '3.1.2.02.04.00001','3.1.2.02.02.00016','3.1.2.02.02.00017','3.1.2.02.02.00038',
  '3.1.2.02.02.00019','3.1.2.02.02.00020','3.1.2.02.02.00021','3.1.2.02.02.00022',
  '3.1.2.02.02.00023','3.1.2.02.03.00006','3.1.2.02.02.00025','3.1.2.02.02.00026',
  '3.1.2.02.02.00027','3.1.2.02.02.00028','3.1.2.02.02.00029','3.1.2.02.02.00030',
  '3.1.2.02.02.00031','3.1.2.02.02.00032','3.1.2.02.03.00004','3.1.2.02.03.00002',
  '3.1.2.02.01.00013','3.1.2.02.02.00036','3.1.2.03.02.00001','3.1.2.03.02.00002',
  '3.1.2.03.02.00003','3.1.2.03.02.00004','3.1.2.03.02.00005','3.1.2.03.02.00006',
  '3.1.2.01.03.00001','3.1.2.03.01.00003','3.1.2.04.02.00002',
];

const systemPrompt = `Você é uma assistente especializada em validação e análise de dados contábeis de DRE (Demonstrativo de Resultado do Exercício). Seu papel é ser uma **validadora de dados, conselheira e auxiliar** — ajudando o usuário a verificar classificações, identificar inconsistências e tomar decisões sobre a estrutura dos dados.

## SUAS CAPACIDADES PRINCIPAIS:

### 1. Validação de Classificação de Contas
- Verificar se uma conta específica está nas **Despesas Fixas** ou **Despesas Variáveis**
- Confirmar se contas existem ou não nas listas configuradas
- Recomendar inclusão/exclusão/reclassificação de contas

### 2. GERENCIAMENTO DE CONTAS (IMPORTANTE!)
- Quando o usuário pedir para **incluir** contas em despesas fixas ou variáveis, use a tool \`manage_accounts\` com action "add"
- Quando o usuário pedir para **excluir/remover** contas de despesas fixas ou variáveis, use a tool \`manage_accounts\` com action "remove"
- SEMPRE use a tool quando o usuário expressar intenção de incluir ou excluir contas, mesmo que implicitamente
- Após usar a tool, confirme textualmente quais contas foram afetadas

### 3. Análise de Consistência
- Identificar valores zerados ou nulos que parecem inconsistentes
- Detectar contas duplicadas entre fixas e variáveis
- Verificar se contas estão no grupo correto
- Alertar sobre valores negativos inesperados

### 4. Análise de Dados Críticos
- Identificar as maiores variações e explicar possíveis causas
- Analisar a composição de cada grupo
- Comparar períodos e identificar tendências
- Calcular totalizadores e margens

### 5. Interpretação de Prints/Imagens
- Quando o usuário enviar uma imagem (print de tabela/relatório), analise os dados visíveis
- Compare os dados da imagem com os dados carregados no sistema
- Identifique discrepâncias entre o print e os dados do sistema

## CONFIGURAÇÃO ATUAL DE CONTAS:

### Contas de DESPESAS VARIÁVEIS (${CONTAS_DESP_VARIAVEIS.length} contas):
${CONTAS_DESP_VARIAVEIS.join(', ')}

### Contas de DESPESAS FIXAS (${CONTAS_DESP_FIXAS.length} contas):
${CONTAS_DESP_FIXAS.join(', ')}

## REGRAS DE RESPOSTA:
1. SEMPRE analise os dados fornecidos no contexto — nunca invente números
2. Cite códigos de conta específicos ao responder sobre classificações
3. Use formatação monetária brasileira (R$ X.XXX,XX)
4. Seja direta, objetiva e prática
5. Quando o usuário perguntar se uma conta existe em fixas/variáveis, responda com SIM/NÃO e em qual lista está
6. Se o usuário pedir para incluir/excluir contas, USE A TOOL manage_accounts e depois confirme a ação
7. Ao identificar inconsistências, explique o problema e sugira correção
8. Use tabelas markdown quando listar múltiplas contas para melhor visualização

## QUANDO NÃO TIVER DADOS:
- Informe que não há dados de DRE carregados
- Sugira que o usuário verifique os filtros aplicados

Quando receber dados, analise-os cuidadosamente antes de responder. Você tem acesso a TODOS os registros da DRE com código, descrição, grupo e valor.`;

const manageAccountsTool = {
  type: "function",
  function: {
    name: "manage_accounts",
    description: "Incluir ou excluir contas contábeis das listas de Despesas Fixas ou Despesas Variáveis. Use quando o usuário pedir para adicionar ou remover contas.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["add", "remove"],
          description: "Ação: 'add' para incluir contas, 'remove' para excluir contas"
        },
        list: {
          type: "string",
          enum: ["fixas", "variaveis"],
          description: "Lista alvo: 'fixas' para Despesas Fixas, 'variaveis' para Despesas Variáveis"
        },
        codes: {
          type: "array",
          items: { type: "string" },
          description: "Array de códigos contábeis (ex: ['3.1.2.01.01.00004', '3.1.2.02.01.00005'])"
        }
      },
      required: ["action", "list", "codes"],
      additionalProperties: false
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, dreData } = await req.json();
    
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";
const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!AI_GATEWAY_API_KEY) {
      throw new Error("AI_GATEWAY_API_KEY ou OPENAI_API_KEY não está configurada");
    }

    // Build data context
    let dataContext = "";
    
    if (dreData && dreData.length > 0) {
      const periodosSet = new Set<string>();
      dreData.forEach((item: any) => periodosSet.add(String(item.ano_mes)));
      const periodos = Array.from(periodosSet).sort();
      
      dataContext += `\n\n=== DADOS DRE COMPLETOS ===`;
      dataContext += `\nTotal de registros: ${dreData.length}`;
      dataContext += `\nPeríodos: ${periodos.join(', ')}`;
      dataContext += `\n\nLISTA COMPLETA DE CONTAS (código | descrição | grupo | valor | nível):`;
      
      dreData.forEach((item: any) => {
        const valor = (item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        dataContext += `\n${item.codigo} | ${item.descricao} | ${item.grupo} | R$ ${valor} | N${item.nivel}`;
      });

      const codigosNoDados = new Set(dreData.map((r: any) => r.codigo));
      const fixasPresentes = CONTAS_DESP_FIXAS.filter(c => codigosNoDados.has(c));
      const fixasAusentes = CONTAS_DESP_FIXAS.filter(c => !codigosNoDados.has(c));
      const variaveisPresentes = CONTAS_DESP_VARIAVEIS.filter(c => codigosNoDados.has(c));
      const variaveisAusentes = CONTAS_DESP_VARIAVEIS.filter(c => !codigosNoDados.has(c));
      
      dataContext += `\n\n=== STATUS DAS CONTAS CONFIGURADAS ===`;
      dataContext += `\nDespesas Fixas presentes nos dados: ${fixasPresentes.length}/${CONTAS_DESP_FIXAS.length}`;
      if (fixasAusentes.length > 0) dataContext += `\nDespesas Fixas ausentes: ${fixasAusentes.join(', ')}`;
      dataContext += `\nDespesas Variáveis presentes nos dados: ${variaveisPresentes.length}/${CONTAS_DESP_VARIAVEIS.length}`;
      if (variaveisAusentes.length > 0) dataContext += `\nDespesas Variáveis ausentes: ${variaveisAusentes.join(', ')}`;
    } else {
      dataContext += `\n\n⚠️ Nenhum dado de DRE foi carregado.`;
    }

    const fullSystemPrompt = systemPrompt + dataContext;

    // Process messages - handle multimodal content
    const processedMessages = messages.map((m: any) => {
      if (m.imageBase64) {
        return {
          role: m.role,
          content: [
            { type: "text", text: m.content || "Analise esta imagem:" },
            { type: "image_url", image_url: { url: m.imageBase64 } },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    // First call with tools
    const firstResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...processedMessages,
        ],
        tools: [manageAccountsTool],
        tool_choice: "auto",
      }),
    });

    if (!firstResponse.ok) {
      const errorText = await firstResponse.text();
      console.error("AI gateway error:", firstResponse.status, errorText);
      
      if (firstResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Aguarde um momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (firstResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${firstResponse.status}`);
    }

    const firstResult = await firstResponse.json();
    const choice = firstResult.choices?.[0];
    
    // Check if there's a tool call
    if (choice?.message?.tool_calls?.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      
      // Send the tool action as a special SSE event, then continue with a follow-up
      const toolAction = {
        action: args.action,
        list: args.list,
        codes: args.codes,
      };

      // Build follow-up messages including tool result
      const followUpMessages = [
        { role: "system", content: fullSystemPrompt },
        ...processedMessages,
        choice.message,
        {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            success: true,
            message: `Ação "${args.action}" executada para ${args.codes.length} conta(s) na lista "${args.list}". Aguardando confirmação do usuário no frontend.`
          }),
        },
      ];

      // Second call to get the text confirmation (streaming)
      const secondResponse = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${AI_GATEWAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: followUpMessages,
          stream: true,
        }),
      });

      if (!secondResponse.ok) {
        throw new Error(`AI gateway follow-up error: ${secondResponse.status}`);
      }

      // Create a custom stream that prepends the tool action
      const encoder = new TextEncoder();
      const actionEvent = `data: ${JSON.stringify({ tool_action: toolAction })}\n\n`;
      
      const transformStream = new TransformStream({
        start(controller) {
          controller.enqueue(encoder.encode(actionEvent));
        },
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
      });

      secondResponse.body!.pipeThrough(transformStream);

      return new Response(transformStream.readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // No tool call — stream the regular response
    // Re-do as streaming since first call was non-streaming
    const streamResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...processedMessages,
        ],
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      throw new Error(`AI gateway stream error: ${streamResponse.status}`);
    }

    return new Response(streamResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Assistente DRE error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
