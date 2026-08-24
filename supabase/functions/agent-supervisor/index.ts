// Cron supervisor — varre conversas ativas e dispara regras configuradas em cada agente
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Rule {
  id: string;
  type: 'no_response' | 'negative_sentiment' | 'keyword' | 'unassigned';
  minutes?: number;
  keywords?: string[];
  target_group_id: string;
  message_template?: string;
}

async function dispatchToGroup(
  agentId: string,
  groupId: string,
  text: string,
  conversationId: string,
) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-router`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      agent_id: agentId,
      target_group_id: groupId,
      content: text,
      message_type: 'text',
      triggered_by: 'client_supervision',
      related_conversation_id: conversationId,
      source_phone_e164: '',
      source_name: '🤖 Supervisor',
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { data: agents } = await supabase
      .from('whatsapp_agents')
      .select('*')
      .eq('is_active', true)
      .eq('supervises_clients', true);

    let triggered = 0;

    for (const agent of agents || []) {
      const rules: Rule[] = (agent.rules as any) || [];
      if (!rules.length) continue;

      // Conversas ativas da empresa
      const { data: convs } = await supabase
        .from('whatsapp_conversations')
        .select('id, last_message_at, is_from_me, assigned_to, last_message_preview, sentiment, contact_id')
        .eq('company_id', agent.company_id)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })
        .limit(500);

      for (const conv of convs || []) {
        for (const rule of rules) {
          if (!rule.target_group_id) continue;

          // Evita disparar regra mais de uma vez para a mesma conversa nas últimas 6h
          const { data: recent } = await supabase
            .from('whatsapp_agent_interventions')
            .select('id')
            .eq('agent_id', agent.id)
            .eq('conversation_id', conv.id)
            .eq('rule_triggered', rule.type)
            .gte('created_at', new Date(Date.now() - 6 * 3600 * 1000).toISOString())
            .limit(1);
          if (recent && recent.length > 0) continue;

          let shouldTrigger = false;
          let summary = '';

          if (rule.type === 'no_response' && rule.minutes) {
            const lastTs = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
            const ageMin = (Date.now() - lastTs) / 60000;
            if (!conv.is_from_me && lastTs && ageMin >= rule.minutes) {
              shouldTrigger = true;
              summary = `⏰ Cliente sem resposta há ${Math.round(ageMin)}min.\nÚltima mensagem: "${conv.last_message_preview || ''}"\nResponda com */assumir ${conv.id.slice(0, 8)}* para pegar a conversa.`;
            }
          } else if (rule.type === 'negative_sentiment') {
            if (conv.sentiment === 'negative') {
              shouldTrigger = true;
              summary = `😟 Sentimento negativo detectado.\nÚltima mensagem: "${conv.last_message_preview || ''}"\nUse */assumir ${conv.id.slice(0, 8)}*.`;
            }
          } else if (rule.type === 'keyword' && rule.keywords?.length) {
            const txt = (conv.last_message_preview || '').toLowerCase();
            if (rule.keywords.some(k => txt.includes(k.toLowerCase()))) {
              shouldTrigger = true;
              summary = `🔑 Palavra-chave detectada.\nMensagem: "${conv.last_message_preview || ''}"\n*/assumir ${conv.id.slice(0, 8)}*`;
            }
          } else if (rule.type === 'unassigned') {
            if (!conv.assigned_to && !conv.is_from_me) {
              shouldTrigger = true;
              summary = `🆕 Nova conversa sem atendente.\n"${conv.last_message_preview || ''}"\n*/assumir ${conv.id.slice(0, 8)}*`;
            }
          }

          if (shouldTrigger) {
            await dispatchToGroup(agent.id, rule.target_group_id, summary, conv.id);
            await supabase.from('whatsapp_agent_interventions').insert({
              agent_id: agent.id,
              conversation_id: conv.id,
              company_id: agent.company_id,
              rule_triggered: rule.type,
              action_taken: `Notificou grupo ${rule.target_group_id}`,
              details: { rule_id: rule.id, preview: conv.last_message_preview },
            });
            triggered++;
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, triggered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[agent-supervisor]', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
