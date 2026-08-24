import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `Você é uma assistente especializada em validação e configuração da DFC (Demonstração do Fluxo de Caixa).

SUAS CAPACIDADES:
1. Analisar dados de fluxo de caixa e identificar inconsistências
2. Gerenciar a configuração de sinais da DFC (quais grupos invertem sinal, quais são ativos operacionais)
3. Explicar a lógica de sinais: Ativo subiu → subtrai do caixa; Ativo desceu → soma ao caixa; Passivo subiu → soma; Passivo desceu → subtrai
4. Interpretar screenshots/prints de tabelas financeiras
5. Recomendar inclusão/exclusão de grupos nas listas de configuração

LISTAS DE CONFIGURAÇÃO ATUAIS:

📌 GRUPOS COM INVERSÃO DE SINAL (gruposInverterSinal):
Grupos cujos valores são multiplicados por -1 na exibição da DFC.
{GRUPOS_INVERTER_SINAL}

📌 GRUPOS DE ATIVOS OPERACIONAIS (gruposAtivosOperacionais):
Grupos classificados como ativos operacionais. Ativo subindo = saída de caixa (negativo).
{GRUPOS_ATIVOS_OPERACIONAIS}

REGRAS DE RESPOSTA:
1. SEMPRE analise os dados fornecidos no contexto - nunca invente números
2. Cite grupos e valores específicos
3. Use formatação monetária brasileira (R$ X.XXX,XX)
4. Quando o usuário pedir para adicionar/remover grupos de uma lista, USE A TOOL manage_dfc_config
5. Seja conciso mas completo nas análises
6. Ao receber uma imagem, analise-a cuidadosamente e identifique dados financeiros

REGRAS PARA GRÁFICOS:
- SOMENTE liste dados para gráfico se o usuário PEDIR EXPLICITAMENTE
- Use EXATAMENTE os nomes das categorias que existem nos dados

QUANDO NÃO TIVER DADOS:
- Informe claramente que não há dados carregados
- Sugira verificar se o módulo está habilitado`;

const tools = [
  {
    type: "function",
    function: {
      name: "manage_dfc_config",
      description: "Adicionar ou remover grupos das listas de configuração da DFC (inversão de sinal ou ativos operacionais). Use quando o usuário pedir para incluir, excluir, adicionar ou remover grupos.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["add_inverter_sinal", "remove_inverter_sinal", "add_ativo_operacional", "remove_ativo_operacional"],
            description: "Ação a executar na configuração"
          },
          groups: {
            type: "array",
            items: { type: "string" },
            description: "Nomes dos grupos a adicionar/remover"
          }
        },
        required: ["action", "groups"],
        additionalProperties: false
      }
    }
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, variacaoData, gruposInverterSinal, gruposAtivosOperacionais } = await req.json();
    
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";
const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!AI_GATEWAY_API_KEY) {
      throw new Error("AI_GATEWAY_API_KEY ou OPENAI_API_KEY não está configurada");
    }

    // Build system prompt with current config
    let fullSystemPrompt = systemPrompt
      .replace("{GRUPOS_INVERTER_SINAL}", (gruposInverterSinal || []).map((g: string) => `- ${g}`).join("\n") || "Nenhum configurado")
      .replace("{GRUPOS_ATIVOS_OPERACIONAIS}", (gruposAtivosOperacionais || []).map((g: string) => `- ${g}`).join("\n") || "Nenhum configurado");

    // Add data context
    if (variacaoData && variacaoData.length > 0) {
      const periodosSet = new Set<string>();
      variacaoData.forEach((item: any) => periodosSet.add(String(item.ano_mes || item.Periodo)));
      const periodos = Array.from(periodosSet).sort();
      
      const gruposSet = new Set<string>();
      variacaoData.forEach((item: any) => { if (item.Grupo) gruposSet.add(item.Grupo); });
      
      const totaisPorGrupo: Record<string, number> = {};
      variacaoData.forEach((item: any) => {
        const grupo = item.Grupo || "Sem Grupo";
        totaisPorGrupo[grupo] = (totaisPorGrupo[grupo] || 0) + (item.Valor || 0);
      });
      
      fullSystemPrompt += `\n\n=== DADOS VARIAÇÃO/DFC ===`;
      fullSystemPrompt += `\nTotal de registros: ${variacaoData.length}`;
      fullSystemPrompt += `\nPeríodos: ${periodos.join(', ')}`;
      fullSystemPrompt += `\nGrupos disponíveis: ${Array.from(gruposSet).sort().join(', ')}`;
      fullSystemPrompt += `\n\n📋 TOTAIS POR GRUPO:`;
      Object.entries(totaisPorGrupo)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .forEach(([grupo, total]) => {
          fullSystemPrompt += `\n  ${grupo}: R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        });
    } else {
      fullSystemPrompt += `\n\n⚠️ Nenhum dado de Variação/DFC carregado.`;
    }

    // Build messages array (support multimodal)
    const apiMessages = [
      { role: "system", content: fullSystemPrompt },
      ...messages.map((m: any) => {
        if (m.imageBase64) {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content || "Analise esta imagem:" },
              { type: "image_url", image_url: { url: m.imageBase64 } }
            ]
          };
        }
        return { role: m.role, content: m.content };
      })
    ];

    // First call with tools
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: apiMessages,
        tools,
        tool_choice: "auto",
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Aguarde um momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Read the stream to check for tool calls
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let toolCalls: any[] = [];
    let currentToolCall: any = null;
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) fullContent += delta.content;
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                currentToolCall = { id: tc.id, function: { name: tc.function?.name || "", arguments: tc.function?.arguments || "" } };
                toolCalls.push(currentToolCall);
              } else if (currentToolCall && tc.function?.arguments) {
                currentToolCall.function.arguments += tc.function.arguments;
              }
            }
          }
        } catch { /* partial */ }
      }
    }

    // If tool calls detected, send action event then continue with text response
    if (toolCalls.length > 0) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          for (const tc of toolCalls) {
            try {
              const args = JSON.parse(tc.function.arguments);
              // Send tool action as special SSE event
              const actionEvent = `data: ${JSON.stringify({ tool_action: { action: args.action, groups: args.groups } })}\n\n`;
              controller.enqueue(encoder.encode(actionEvent));
            } catch (e) {
              console.error("Failed to parse tool args:", e);
            }
          }

          // Now do a follow-up call to get text response
          const toolResults = toolCalls.map(tc => {
            try {
              const args = JSON.parse(tc.function.arguments);
              return {
                role: "tool" as const,
                tool_call_id: tc.id,
                content: JSON.stringify({ success: true, message: `Ação ${args.action} para grupos ${args.groups.join(', ')} enviada para confirmação do usuário.` })
              };
            } catch {
              return { role: "tool" as const, tool_call_id: tc.id, content: '{"success": true}' };
            }
          });

          const followUpMessages = [
            ...apiMessages,
            { role: "assistant", content: fullContent || null, tool_calls: toolCalls.map(tc => ({ id: tc.id, type: "function", function: { name: tc.function.name, arguments: tc.function.arguments } })) },
            ...toolResults
          ];

          const followUpResp = await fetch(AI_GATEWAY_URL, {
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

          if (followUpResp.ok && followUpResp.body) {
            const reader2 = followUpResp.body.getReader();
            while (true) {
              const { done, value } = await reader2.read();
              if (done) break;
              controller.enqueue(value);
            }
          }

          controller.close();
        }
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    // No tool calls - reconstruct stream from collected content
    const encoder = new TextEncoder();
    const reconstructedStream = new ReadableStream({
      start(controller) {
        if (fullContent) {
          const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: fullContent } }] })}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    });

    return new Response(reconstructedStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (error) {
    console.error("Assistente Variação error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
