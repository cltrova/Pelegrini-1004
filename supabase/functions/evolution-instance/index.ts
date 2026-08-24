import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstanceRequest {
  instanceId: string;
  action: 'status' | 'qrcode' | 'disconnect' | 'restart';
}

function normalizePhoneE164(phone: string): string | null {
  const clean = phone.replace(/[^0-9]/g, '');
  
  if (clean.startsWith('55') && clean.length >= 12 && clean.length <= 13) {
    return '+' + clean;
  }
  
  if (clean.length >= 10 && clean.length <= 11) {
    return '+55' + clean;
  }
  
  if (clean.length > 0) {
    return '+' + clean;
  }
  
  return null;
}

async function ensureSellerFromInstancePhone(
  supabase: any,
  instanceId: string,
  companyId: string,
  phoneE164: string
): Promise<string | null> {
  try {
    console.log(`[Instance] Creating seller for phone: ${phoneE164}`);

    const { data: empresa } = await supabase
      .from('empresas')
      .select('cod_empresa_bi')
      .eq('id', companyId)
      .single();

    if (!empresa?.cod_empresa_bi) {
      console.log('[Instance] Company not found');
      return null;
    }

    let { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, user_id')
      .eq('phone_e164', phoneE164)
      .single();

    let profileId: string;
    let userId: string | null = null;

    if (existingProfile) {
      profileId = existingProfile.id;
      userId = existingProfile.user_id;

      await supabase
        .from('profiles')
        .update({ cod_empresa_bi: empresa.cod_empresa_bi })
        .eq('id', profileId);
    } else {
      const placeholderEmail = `whatsapp_${phoneE164.replace('+', '')}@placeholder.local`;
      
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          email: placeholderEmail,
          nome: `Vendedor ${phoneE164}`,
          phone_e164: phoneE164,
          cod_empresa_bi: empresa.cod_empresa_bi,
          status: 'pending_login',
        })
        .select('id')
        .single();

      if (profileError || !newProfile) {
        console.error('[Instance] Error creating profile:', profileError);
        return null;
      }

      profileId = newProfile.id;
    }

    if (userId) {
      await supabase
        .from('user_roles')
        .upsert(
          { user_id: userId, role: 'vendedor' },
          { onConflict: 'user_id,role' }
        );
    }

    await supabase
      .from('seller_whitelist')
      .upsert(
        {
          company_id: companyId,
          phone_e164: phoneE164,
          profile_id: profileId,
          is_active: true,
        },
        { onConflict: 'company_id,phone_e164' }
      );

    await supabase
      .from('whatsapp_instances')
      .update({ default_seller_id: profileId })
      .eq('id', instanceId);

    console.log(`[Instance] Seller setup complete: ${profileId}`);
    return profileId;
  } catch (error) {
    console.error('[Instance] Error in ensureSellerFromInstancePhone:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: InstanceRequest = await req.json();
    const { instanceId, action } = body;

    if (!instanceId || !action) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', instanceId)
      .single();

    if (instanceError || !instance) {
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: secret, error: secretError } = await supabase
      .from('whatsapp_instance_secrets')
      .select('api_key')
      .eq('instance_id', instanceId)
      .single();

    if (secretError || !secret) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiUrl = instance.api_url.replace(/\/$/, '');
    const apiKey = secret.api_key;
    const instanceName = instance.instance_name;

    let evolutionEndpoint: string;
    let evolutionMethod = 'GET';

    switch (action) {
      case 'status':
        evolutionEndpoint = `${apiUrl}/instance/connectionState/${instanceName}`;
        break;
      
      case 'qrcode':
        evolutionEndpoint = `${apiUrl}/instance/connect/${instanceName}`;
        break;
      
      case 'disconnect':
        evolutionEndpoint = `${apiUrl}/instance/logout/${instanceName}`;
        evolutionMethod = 'DELETE';
        break;
      
      case 'restart':
        evolutionEndpoint = `${apiUrl}/instance/restart/${instanceName}`;
        evolutionMethod = 'PUT';
        break;
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    console.log(`[Instance] Action: ${action}, Endpoint: ${evolutionEndpoint}`);

    const evolutionResponse = await fetch(evolutionEndpoint, {
      method: evolutionMethod,
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
    });

    const responseText = await evolutionResponse.text();
    let evolutionResult: any;
    
    try {
      evolutionResult = JSON.parse(responseText);
    } catch {
      evolutionResult = { raw: responseText };
    }

    console.log(`[Instance] Evolution response:`, JSON.stringify(evolutionResult));

    if (!evolutionResponse.ok) {
      return new Response(JSON.stringify({ 
        error: 'Evolution API error', 
        details: evolutionResult,
      }), {
        status: evolutionResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      let status = 'disconnected';
      const state = evolutionResult.instance?.state || evolutionResult.state;
      
      if (state === 'open' || state === 'connected') {
        status = 'connected';
      } else if (state === 'connecting') {
        status = 'connecting';
      } else if (state === 'close' || state === 'disconnected') {
        status = 'disconnected';
      }

      await supabase
        .from('whatsapp_instances')
        .update({ status })
        .eq('id', instanceId);

      return new Response(JSON.stringify({
        success: true,
        status,
        data: evolutionResult,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'qrcode') {
      const state = evolutionResult.instance?.state;
      const wuid = evolutionResult.instance?.wuid;
      
      // If already connected, extract phone and create seller
      if ((state === 'open' || state === 'connected') && wuid) {
        const phoneRaw = wuid.replace('@s.whatsapp.net', '').replace('@c.us', '');
        const phoneE164 = normalizePhoneE164(phoneRaw);
        
        console.log(`[Instance] Already connected with phone: ${phoneE164}`);
        
        await supabase
          .from('whatsapp_instances')
          .update({ 
            status: 'connected',
            phone_number: phoneRaw,
            phone_e164: phoneE164,
          })
          .eq('id', instanceId);
        
        // Create seller automatically
        let sellerId: string | null = null;
        if (phoneE164) {
          sellerId = await ensureSellerFromInstancePhone(
            supabase, instanceId, instance.company_id, phoneE164
          );
        }

        return new Response(JSON.stringify({
          success: true,
          qrCode: null,
          state: 'connected',
          phone_e164: phoneE164,
          seller_id: sellerId,
          data: evolutionResult,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Extract QR code if present
      const qrCode = evolutionResult.base64 || evolutionResult.qrcode?.base64;
      
      if (qrCode) {
        await supabase
          .from('whatsapp_instances')
          .update({ 
            qr_code: qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`,
            status: 'qr_pending',
          })
          .eq('id', instanceId);
      }

      return new Response(JSON.stringify({
        success: true,
        qrCode: qrCode || null,
        state: evolutionResult.instance?.state,
        data: evolutionResult,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'disconnect') {
      await supabase
        .from('whatsapp_instances')
        .update({ 
          status: 'disconnected',
          qr_code: null,
        })
        .eq('id', instanceId);

      return new Response(JSON.stringify({
        success: true,
        status: 'disconnected',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'restart') {
      await supabase
        .from('whatsapp_instances')
        .update({ status: 'connecting' })
        .eq('id', instanceId);

      return new Response(JSON.stringify({
        success: true,
        status: 'connecting',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data: evolutionResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[Instance] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});