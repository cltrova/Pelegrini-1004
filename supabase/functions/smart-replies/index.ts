import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "conversationId is required", replies: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[smart-replies] Generating replies for conversation: ${conversationId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the last 10 messages for context
    const { data: messages, error: msgError } = await supabase
      .from("whatsapp_messages")
      .select("content, from_me, message_type")
      .eq("conversation_id", conversationId)
      .order("timestamp", { ascending: false })
      .limit(10);

    if (msgError) {
      console.error("[smart-replies] Error fetching messages:", msgError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch messages", replies: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the last customer message
    const customerMessages = messages?.filter(m => !m.from_me && m.message_type === "text" && m.content) || [];
    
    if (customerMessages.length === 0) {
      // No customer messages, return default replies
      return new Response(
        JSON.stringify({ 
          replies: [
            "Olá! Como posso ajudar?",
            "Bom dia! Em que posso ser útil?",
            "Estou à disposição!"
          ]
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format conversation context
    const formattedMessages = messages
      ?.reverse()
      .filter(m => m.message_type === "text" && m.content)
      .slice(-6) // Last 6 messages for context
      .map(m => `${m.from_me ? "Atendente" : "Cliente"}: ${m.content}`)
      .join("\n") || "";

    const lastCustomerMessage = customerMessages[0]?.content || "";

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("[smart-replies] OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          error: "OpenAI API key not configured",
          replies: ["Entendi, vou verificar.", "Obrigado pelo contato!", "Um momento, por favor."]
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um assistente que gera sugestões de resposta rápida para atendentes de WhatsApp.

Baseado no histórico da conversa, gere EXATAMENTE 3 respostas curtas e profissionais que o atendente pode usar.

REGRAS:
1. Cada resposta deve ter no MÁXIMO 60 caracteres
2. Seja direto e objetivo
3. Mantenha tom profissional mas amigável
4. Respostas devem ser apropriadas ao contexto
5. Inclua variações: uma confirmação, uma solicitação de informação, uma resposta empática

Retorne APENAS um JSON no formato:
{"replies": ["resposta1", "resposta2", "resposta3"]}

Não inclua explicações, apenas o JSON.`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Última mensagem do cliente: "${lastCustomerMessage}"\n\nContexto da conversa:\n${formattedMessages}` }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("[smart-replies] OpenAI API error:", errorText);
      
      // Return fallback replies
      return new Response(
        JSON.stringify({ 
          replies: ["Entendi, vou verificar isso.", "Obrigado pelo contato!", "Posso ajudar em algo mais?"]
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiResponse.json();
    const assistantMessage = openaiData.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      console.error("[smart-replies] No response from OpenAI");
      return new Response(
        JSON.stringify({ 
          replies: ["Entendi, vou verificar.", "Agradeço o contato!", "Um momento, por favor."]
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response
    let result;
    try {
      const cleanedResponse = assistantMessage
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      result = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("[smart-replies] Failed to parse OpenAI response:", assistantMessage);
      return new Response(
        JSON.stringify({ 
          replies: ["Entendi, vou verificar.", "Agradeço o contato!", "Um momento, por favor."]
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[smart-replies] Generated replies:", result.replies);

    return new Response(
      JSON.stringify({ replies: result.replies || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[smart-replies] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        replies: ["Entendi!", "Vou verificar.", "Obrigado!"]
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
