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
    const { currentPrompt, userRequest } = await req.json();

    const systemPrompt = `Você é um especialista em engenharia de prompts para assistentes de gestão de estoque.
O usuário tem um assistente de estoque com um prompt customizável (o "cérebro" da IA).
Ele vai te descrever um problema ou uma melhoria que deseja, e você deve sugerir alterações no prompt atual.

REGRAS:
- Retorne o prompt COMPLETO já corrigido/melhorado, pronto para uso
- Explique brevemente o que mudou e por quê
- Mantenha o tom profissional e técnico
- O prompt deve sempre ser em português brasileiro
- Foque em tornar o assistente mais útil para gestão de estoque
- Se o prompt atual estiver vazio, crie um prompt completo do zero baseado na necessidade do usuário

Use a tool suggest_prompt_change para retornar a sugestão.`;

    const userPrompt = `PROMPT ATUAL DO ASSISTENTE:
${currentPrompt || '(vazio - nenhum prompt configurado ainda)'}

SOLICITAÇÃO DO USUÁRIO:
${userRequest}

Sugira a alteração usando a tool.`;

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
              name: "suggest_prompt_change",
              description: "Sugere alteração no prompt do assistente de estoque",
              parameters: {
                type: "object",
                properties: {
                  suggested_prompt: {
                    type: "string",
                    description: "O prompt completo sugerido, pronto para uso",
                  },
                  explanation: {
                    type: "string",
                    description: "Explicação curta do que foi alterado e por quê (2-3 frases)",
                  },
                },
                required: ["suggested_prompt", "explanation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_prompt_change" } },
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
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
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    let suggestion = { suggested_prompt: '', explanation: '' };

    if (toolCall?.function?.arguments) {
      try {
        const args = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
        suggestion = args;
      } catch (e) {
        console.error("Error parsing tool call:", e);
      }
    }

    return new Response(
      JSON.stringify(suggestion),
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
