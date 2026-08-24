import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  cod_empresa_bi: string;
  conversation_id?: string;
  contact_phone?: string;
  cliente_nome?: string;
  cod_cliente?: string;
  duplicata_id?: string;
  pedido_numero?: string;
  valor?: number;
  data_vencimento?: string;
  last_messages?: { role: 'cliente' | 'agente'; content: string }[];
  ultima_mensagem_cliente?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body: Body = await req.json();
    if (!body.cod_empresa_bi) {
      return new Response(JSON.stringify({ error: 'missing cod_empresa_bi' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";
    const aiGatewayKey = Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!aiGatewayKey) {
      return new Response(JSON.stringify({ error: 'AI key missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transcript = (body.last_messages || [])
      .map(m => `${m.role === 'cliente' ? 'CLIENTE' : 'AGENTE'}: ${m.content}`)
      .join('\n')
      || `CLIENTE: ${body.ultima_mensagem_cliente || ''}`;

    const sys = `Você analisa conversas de cobrança no WhatsApp para detectar quando o cliente faz uma SOLICITAÇÃO que precisa de ação humana do gerente financeiro.
Categorias possíveis:
- "pix": cliente pediu chave/QR Code Pix para pagar
- "boleto": cliente pediu boleto / 2ª via de boleto
- "segunda_via": cliente pediu segunda via de NF / fatura
- "negociacao": cliente quer negociar prazo, parcelamento ou desconto
- "comprovante": cliente enviou comprovante de pagamento
- "outro": outra solicitação relevante que exige ação humana
- "nenhum": nenhuma ação humana necessária

Responda APENAS em JSON: {"acao_necessaria": boolean, "tipo": string, "prioridade": "baixa"|"normal"|"alta", "resumo": string (1 frase em português, direta para o gerente)}`;

    const aiRes = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiGatewayKey}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: transcript.slice(0, 4000) },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: 'AI failed', details: t }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { /* ignore */ }

    if (!parsed.acao_necessaria || !parsed.tipo || parsed.tipo === 'nenhum') {
      return new Response(JSON.stringify({ skipped: true, parsed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // dedupe: se já existe pendente para mesmo telefone+tipo nas últimas 6h, não cria
    if (body.contact_phone) {
      const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('cobranca_intervencoes')
        .select('id')
        .eq('cod_empresa_bi', body.cod_empresa_bi)
        .eq('contact_phone', body.contact_phone)
        .eq('tipo', parsed.tipo)
        .eq('status', 'pendente')
        .gte('created_at', since)
        .limit(1);
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ skipped: 'duplicate', existing_id: existing[0].id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: inserted, error } = await supabase
      .from('cobranca_intervencoes')
      .insert({
        cod_empresa_bi: body.cod_empresa_bi,
        conversation_id: body.conversation_id ?? null,
        contact_phone: body.contact_phone ?? null,
        cliente_nome: body.cliente_nome ?? null,
        cod_cliente: body.cod_cliente ?? null,
        pedido_numero: body.pedido_numero ?? null,
        duplicata_id: body.duplicata_id ?? null,
        valor: body.valor ?? null,
        data_vencimento: body.data_vencimento ?? null,
        tipo: parsed.tipo,
        prioridade: parsed.prioridade || 'normal',
        agent_summary: parsed.resumo || '',
        ultima_mensagem_cliente: body.ultima_mensagem_cliente || null,
        status: 'pendente',
        metadata: { ai_raw: parsed },
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, intervencao: inserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
