import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  cod_empresa_bi: string;
  phone_e164: string;
  content: string;
  duplicata_id?: string;
  cod_cliente?: string;
  cliente_nome?: string;
  gatilho: 'd3' | 'd1' | 'd0' | 'atrasado';
  valor?: number;
  data_vencimento?: string;
  dias_atraso?: number;
}

function normalize(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const auth = req.headers.get('Authorization');
    if (!auth) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body: Body = await req.json();

    if (!body.cod_empresa_bi || !body.phone_e164 || !body.content || !body.gatilho) {
      return new Response(JSON.stringify({ error: 'missing fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve empresa.id
    const { data: empresa } = await supabase
      .from('empresas').select('id').eq('cod_empresa_bi', body.cod_empresa_bi).maybeSingle();
    if (!empresa) {
      return new Response(JSON.stringify({ error: 'empresa not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pick first connected instance for the company
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, api_url, status')
      .eq('company_id', empresa.id)
      .order('created_at', { ascending: false });

    const instance = (instances || []).find((i: any) => i.status === 'connected') || (instances || [])[0];
    if (!instance) {
      return new Response(JSON.stringify({ error: 'Nenhuma instância WhatsApp configurada para esta empresa' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: secret } = await supabase
      .from('whatsapp_instance_secrets').select('api_key').eq('instance_id', instance.id).maybeSingle();
    if (!secret) {
      return new Response(JSON.stringify({ error: 'API key da instância não configurada' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const number = normalize(body.phone_e164);
    const apiUrl = instance.api_url.replace(/\/$/, '');
    const endpoint = `${apiUrl}/message/sendText/${instance.instance_name}`;

    const evoRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: secret.api_key },
      body: JSON.stringify({ number, text: body.content }),
    });

    const evoText = await evoRes.text();
    let logStatus = evoRes.ok ? 'sent' : 'failed';
    let logErro: string | null = evoRes.ok ? null : evoText.slice(0, 500);

    await supabase.from('cobranca_envios').insert({
      cod_empresa_bi: body.cod_empresa_bi,
      duplicata_id: body.duplicata_id ?? null,
      cod_cliente: body.cod_cliente ?? null,
      cliente_nome: body.cliente_nome ?? null,
      phone_e164: '+' + number,
      gatilho: body.gatilho,
      valor: body.valor ?? null,
      data_vencimento: body.data_vencimento ?? null,
      dias_atraso: body.dias_atraso ?? null,
      conteudo: body.content,
      status: logStatus,
      erro: logErro,
      enviado_por: user.id,
    });

    if (!evoRes.ok) {
      return new Response(JSON.stringify({ error: 'Falha ao enviar pela Evolution', details: logErro }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
