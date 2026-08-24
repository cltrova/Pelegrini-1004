import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ActionType = 'rewrite' | 'expand' | 'formalize' | 'friendly' | 'grammar' | 'translate';

const getSystemPrompt = (action: ActionType): string => {
  const prompts: Record<ActionType, string> = {
    rewrite: `Você é um assistente especializado em reescrever textos. 
    Reformule o texto do usuário mantendo o mesmo sentido, mas com palavras e estrutura diferentes.
    Mantenha o mesmo tom e nível de formalidade.
    Responda APENAS com o texto reformulado, sem explicações.`,
    
    expand: `Você é um assistente especializado em expandir textos.
    Adicione mais detalhes e informações ao texto do usuário, tornando-o mais completo e informativo.
    Mantenha a coerência e o tom original.
    Responda APENAS com o texto expandido, sem explicações.`,
    
    formalize: `Você é um assistente especializado em formalizar textos.
    Transforme o texto do usuário em uma versão mais profissional e formal.
    Use linguagem corporativa adequada.
    Responda APENAS com o texto formalizado, sem explicações.`,
    
    friendly: `Você é um assistente especializado em tornar textos mais amigáveis.
    Transforme o texto do usuário em uma versão mais calorosa, simpática e acolhedora.
    Adicione emojis quando apropriado.
    Responda APENAS com o texto amigável, sem explicações.`,
    
    grammar: `Você é um revisor de texto profissional.
    Corrija todos os erros gramaticais, ortográficos e de pontuação do texto.
    Mantenha o sentido e estilo originais.
    Responda APENAS com o texto corrigido, sem explicações.`,
    
    translate: `Você é um tradutor profissional português-inglês.
    Traduza o texto do usuário para inglês de forma natural e fluente.
    Mantenha o tom e intenção originais.
    Responda APENAS com a tradução, sem explicações.`,
  };
  
  return prompts[action] || prompts.rewrite;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, action } = await req.json() as { text: string; action: ActionType };
    
    if (!text || !action) {
      return new Response(
        JSON.stringify({ error: "Missing text or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: getSystemPrompt(action) },
          { role: "user", content: text }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to process text with AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const transformedText = data.choices?.[0]?.message?.content?.trim();

    if (!transformedText) {
      throw new Error("No response from AI");
    }

    return new Response(
      JSON.stringify({ transformedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ai-compose error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
