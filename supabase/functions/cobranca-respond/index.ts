import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  intervencao_id: string;
  message?: string;        // texto livre do gerente para enviar ao cliente
  attachment_url?: string; // url pública (anexo já em storage)
  attachment_type?: string;// image | document | etc.
  mark_resolved?: boolean; // só fecha sem enviar
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
    if (!auth) return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const supabase = createClient(supabaseUrl, serviceKey);
    const body: Body = await req.json();
    if (!body.intervencao_id) return new Response(JSON.stringify({ error: 'missing intervencao_id' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const { data: interv } = await supabase
      .from('cobranca_intervencoes')
      .select('*')
      .eq('id', body.intervencao_id)
      .maybeSingle();

    if (!interv) return new Response(JSON.stringify({ error: 'intervencao not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    // só fechar
    if (body.mark_resolved && !body.message && !body.attachment_url) {
      await supabase.from('cobranca_intervencoes').update({
        status: 'resolvido',
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      }).eq('id', interv.id);
      return new Response(JSON.stringify({ success: true, resolved: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!interv.contact_phone) {
      return new Response(JSON.stringify({ error: 'sem telefone do cliente' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: empresa } = await supabase
      .from('empresas').select('id').eq('cod_empresa_bi', interv.cod_empresa_bi).maybeSingle();
    if (!empresa) return new Response(JSON.stringify({ error: 'empresa not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, api_url, status')
      .eq('company_id', empresa.id)
      .order('created_at', { ascending: false });
    const instance = (instances || []).find((i: any) => i.status === 'connected') || (instances || [])[0];
    if (!instance) return new Response(JSON.stringify({ error: 'sem instância WhatsApp' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const { data: secret } = await supabase
      .from('whatsapp_instance_secrets').select('api_key').eq('instance_id', instance.id).maybeSingle();
    if (!secret) return new Response(JSON.stringify({ error: 'sem api key' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const number = normalize(interv.contact_phone);
    const apiUrl = instance.api_url.replace(/\/$/, '');

    let evoRes: Response;
    if (body.attachment_url) {
      const isImg = (body.attachment_type || '').startsWith('image') || /\.(png|jpe?g|webp|gif)$/i.test(body.attachment_url);
      const endpoint = `${apiUrl}/message/sendMedia/${instance.instance_name}`;
      evoRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: secret.api_key },
        body: JSON.stringify({
          number,
          mediatype: isImg ? 'image' : 'document',
          mimetype: body.attachment_type || (isImg ? 'image/png' : 'application/pdf'),
          caption: body.message || '',
          media: body.attachment_url,
          fileName: body.attachment_url.split('/').pop() || 'arquivo',
        }),
      });
    } else {
      const endpoint = `${apiUrl}/message/sendText/${instance.instance_name}`;
      evoRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: secret.api_key },
        body: JSON.stringify({ number, text: body.message || '' }),
      });
    }

    const evoText = await evoRes.text();
    if (!evoRes.ok) {
      return new Response(JSON.stringify({ error: 'envio falhou', details: evoText.slice(0, 400) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('cobranca_intervencoes').update({
      user_response: body.message ?? null,
      attachment_url: body.attachment_url ?? null,
      attachment_type: body.attachment_type ?? null,
      status: body.mark_resolved ? 'resolvido' : 'respondido',
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    }).eq('id', interv.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
