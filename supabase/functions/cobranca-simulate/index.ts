const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Msg { role: 'user' | 'assistant' | 'system'; content: string }

interface Body {
  persona_prompt: string;
  agente_nome?: string;
  gatilho?: 'd3' | 'd1' | 'd0' | 'atrasado';
  cenario?: {
    cliente?: string;
    valor?: number;
    vencimento?: string;
    dias_atraso?: number;
    empresa?: string;
  };
  templates?: { d3?: string; d1?: string; d0?: string; atrasado?: string };
  messages: Msg[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";
    const apiKey = Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI_GATEWAY_API_KEY or OPENAI_API_KEY missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: Body = await req.json();
    if (!body.persona_prompt || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: 'invalid body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const g = body.gatilho;
    const tplMap = body.templates || {};
    const tplAtual = g ? (tplMap as any)[g] as string | undefined : undefined;

    const cenario = body.cenario || {};
    const cenarioTxt = [
      cenario.cliente && `Cliente: ${cenario.cliente}`,
      cenario.empresa && `Empresa credora: ${cenario.empresa}`,
      cenario.valor != null && `Valor em aberto: R$ ${Number(cenario.valor).toFixed(2)}`,
      cenario.vencimento && `Data de vencimento: ${cenario.vencimento}`,
      cenario.dias_atraso != null && `Dias de atraso: ${cenario.dias_atraso}`,
      g && `Gatilho do envio: ${g.toUpperCase()}`,
    ].filter(Boolean).join('\n');

    const system = [
      `Você é "${body.agente_nome || 'Agente de Cobrança'}", um agente de cobrança via WhatsApp.`,
      body.persona_prompt,
      '',
      'CENÁRIO DESTA SIMULAÇÃO:',
      cenarioTxt || '(sem cenário definido — use dados plausíveis)',
      '',
      tplAtual ? `TEMPLATE BASE PARA ESTE GATILHO (use como referência, mas adapte o tom à conversa):\n${tplAtual}` : '',
      '',
      'REGRAS GERAIS:',
      '- Responda SEMPRE como o agente de cobrança. NUNCA assuma o papel do cliente.',
      '- A primeira mensagem (se a conversa estiver vazia) deve ser a abordagem inicial baseada no template.',
      '- Use linguagem natural de WhatsApp, frases curtas, emojis com moderação.',
      '- Seja firme, cordial, ofereça canais de pagamento e negociação quando fizer sentido.',
      '- Não invente valores ou datas que conflitem com o cenário.',
      '- Não mencione que você é uma IA.',
      '',
      'LIMITES CRÍTICOS — O QUE VOCÊ *NÃO* PODE FAZER (NUNCA):',
      '- Você NÃO gera QR Code Pix, NÃO emite chave Pix, NÃO cria boleto, NÃO gera 2ª via, NÃO envia comprovante e NÃO confirma pagamentos por conta própria.',
      '- NÃO invente códigos copia-e-cola, NÃO escreva placeholders como "[QR_CODE_AQUI]", "[IMAGEM_PIX]", "[LINK_BOLETO]" — isso é proibido.',
      '- NÃO prometa "vou te enviar agora" para QR Code, boleto, comprovante ou link de pagamento. Você não tem essa capacidade.',
      '',
      'COMO AGIR QUANDO O CLIENTE PEDIR ALGO QUE VOCÊ NÃO PODE FAZER (Pix, QR Code, boleto, 2ª via, negociação, comprovante, dúvida sobre pagamento):',
      '- Reconheça o pedido com cordialidade.',
      '- Avise que vai *encaminhar para o responsável financeiro* gerar/enviar pessoalmente em instantes.',
      '- NÃO tente entregar você mesmo. NÃO peça ao cliente para esperar "uns minutos" inventando prazos — apenas confirme que o atendente humano dará sequência.',
      '- Exemplo de resposta correta: "Claro, Maria! Já estou encaminhando seu pedido de Pix para nosso financeiro. Em instantes você receberá o código por aqui mesmo. 🙏"',
      '- O sistema (módulo Acompanhamento) detecta automaticamente esse pedido e notifica um humano que responderá com o material real.',
    ].filter(Boolean).join('\n');

    const aiMessages = [
      { role: 'system', content: system },
      ...body.messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ];

    const res = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: aiMessages,
        temperature: 0.7,
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em instantes.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos no workspace.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: 'AI error', details: t.slice(0, 500) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const reply: string = data?.choices?.[0]?.message?.content ?? '';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
