// Interpreta comandos enviados ao número-agente (ex: /assumir <conv_id>)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const norm = (p: string) => (p || '').replace(/\D/g, '');

async function reply(supabase: any, agent: any, toPhone: string, text: string) {
  const { data: instance } = await supabase
    .from('whatsapp_instances').select('*').eq('id', agent.instance_id).single();
  if (!instance) return;
  const { data: secret } = await supabase
    .from('whatsapp_instance_secrets').select('api_key').eq('instance_id', instance.id).single();
  if (!secret) return;
  const apiUrl = (instance.api_url as string).replace(/\/$/, '');
  await fetch(`${apiUrl}/message/sendText/${instance.instance_name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: secret.api_key },
    body: JSON.stringify({ number: norm(toPhone), text }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { agent_id, source_phone_e164, source_name, command } = await req.json();

    const { data: agent } = await supabase
      .from('whatsapp_agents').select('*').eq('id', agent_id).single();
    if (!agent) {
      return new Response(JSON.stringify({ error: 'agent not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (cmd === '/status') {
      await reply(supabase, agent, source_phone_e164,
        `🤖 ${agent.name}\nStatus: ${agent.is_active ? 'ativo' : 'pausado'}\nSupervisor: ${agent.supervises_clients ? 'sim' : 'não'}`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (cmd === '/assumir' && arg) {
      // Tenta achar a conversa pelo id da intervenção mais recente OU pelo prefixo do uuid
      const { data: convs } = await supabase
        .from('whatsapp_conversations')
        .select('id, company_id')
        .ilike('id', `${arg}%`)
        .eq('company_id', agent.company_id)
        .limit(1);

      const conv = convs?.[0];
      if (!conv) {
        await reply(supabase, agent, source_phone_e164, `❌ Conversa "${arg}" não encontrada.`);
      } else {
        // Acha o user_id pelo telefone do solicitante
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, nome')
          .eq('phone_e164', source_phone_e164)
          .maybeSingle();

        if (!profile?.user_id) {
          await reply(supabase, agent, source_phone_e164,
            `⚠️ Seu telefone não está vinculado a um usuário do sistema. Peça ao admin para cadastrar.`);
        } else {
          await supabase
            .from('whatsapp_conversations')
            .update({ assigned_to: profile.user_id, status: 'active' })
            .eq('id', conv.id);

          await supabase
            .from('whatsapp_agent_interventions')
            .update({ resolved_by: profile.user_id, resolved_at: new Date().toISOString() })
            .eq('conversation_id', conv.id)
            .is('resolved_at', null);

          await reply(supabase, agent, source_phone_e164,
            `✅ Conversa assumida por ${source_name || profile.nome || 'você'}.`);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (cmd === '/ajuda' || cmd === '/help') {
      await reply(supabase, agent, source_phone_e164,
        `Comandos disponíveis:\n/status — status do agente\n/assumir <id> — assumir conversa\n/ajuda — esta lista`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await reply(supabase, agent, source_phone_e164,
      `Comando "${cmd}" desconhecido. Use /ajuda.`);
    return new Response(JSON.stringify({ ok: true, unknown: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[agent-command-handler]', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
