import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Seller registration - uses whitelist as source of truth
async function ensureSellerFromInstancePhone(
  supabase: any,
  instanceId: string,
  companyId: string,
  phoneE164: string
): Promise<string | null> {
  try {
    console.log(`[SyncPhone] Registering seller phone: ${phoneE164}`);

    // 1. Check if profile with this phone already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, user_id')
      .eq('phone_e164', phoneE164)
      .single();

    // 2. If profile exists, link as default_seller
    if (existingProfile) {
      await supabase
        .from('whatsapp_instances')
        .update({ default_seller_id: existingProfile.id })
        .eq('id', instanceId);
      
      console.log(`[SyncPhone] Linked existing profile: ${existingProfile.id}`);
      return existingProfile.id;
    }

    // 3. If no profile, register only in whitelist (no placeholder profile)
    const { error: whitelistError } = await supabase
      .from('seller_whitelist')
      .upsert({
        company_id: companyId,
        phone_e164: phoneE164,
        name: `Vendedor ${phoneE164}`,
        is_active: true,
      }, { onConflict: 'company_id,phone_e164' });

    if (whitelistError) {
      console.error('[SyncPhone] Error adding to whitelist:', whitelistError);
      return null;
    }

    console.log(`[SyncPhone] Added to whitelist: ${phoneE164}`);
    return null; // No profile yet, but whitelist entry created
  } catch (error) {
    console.error('[SyncPhone] Error in ensureSellerFromInstancePhone:', error);
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

    const { instanceId } = await req.json();
    if (!instanceId) {
      return new Response(JSON.stringify({ error: 'Missing instanceId' }), {
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

    const { data: secret } = await supabase
      .from('whatsapp_instance_secrets')
      .select('api_key')
      .eq('instance_id', instanceId)
      .single();

    if (!secret?.api_key) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiUrl = instance.api_url.replace(/\/$/, '');
    const apiKey = secret.api_key;

    console.log(`[SyncPhone] Fetching instances from: ${apiUrl}`);

    let ownerJid: string | null = null;

    // Strategy 1: Try fetchInstances endpoint
    const fetchInstancesUrl = `${apiUrl}/instance/fetchInstances`;
    console.log(`[SyncPhone] Trying fetchInstances: ${fetchInstancesUrl}`);
    
    const fetchResponse = await fetch(fetchInstancesUrl, {
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
    });

    if (fetchResponse.ok) {
      const allInstances = await fetchResponse.json();
      console.log(`[SyncPhone] fetchInstances response:`, JSON.stringify(allInstances));

      const matchingInstance = Array.isArray(allInstances)
        ? allInstances.find((i: any) => 
            i.instance?.instanceName === instance.instance_name ||
            i.instanceName === instance.instance_name ||
            i.name === instance.instance_name
          )
        : null;

      if (matchingInstance) {
        ownerJid = 
          matchingInstance.instance?.owner ||
          matchingInstance.instance?.wuid ||
          matchingInstance.owner ||
          matchingInstance.wuid ||
          matchingInstance.instance?.ownerJid ||
          matchingInstance.ownerJid;
        
        console.log(`[SyncPhone] Found owner from fetchInstances: ${ownerJid}`);
      }
    }

    // Strategy 2: Try connectionState endpoint if no owner found
    if (!ownerJid) {
      const stateUrl = `${apiUrl}/instance/connectionState/${instance.instance_name}`;
      console.log(`[SyncPhone] Trying connectionState: ${stateUrl}`);
      
      const stateResponse = await fetch(stateUrl, {
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      });

      if (stateResponse.ok) {
        const stateData = await stateResponse.json();
        console.log(`[SyncPhone] connectionState response:`, JSON.stringify(stateData));
        
        ownerJid = 
          stateData.instance?.wuid ||
          stateData.instance?.owner ||
          stateData.wuid ||
          stateData.owner;
      }
    }

    // Strategy 3: Try connect endpoint (might return owner if already connected)
    if (!ownerJid) {
      const connectUrl = `${apiUrl}/instance/connect/${instance.instance_name}`;
      console.log(`[SyncPhone] Trying connect endpoint: ${connectUrl}`);
      
      const connectResponse = await fetch(connectUrl, {
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      });

      if (connectResponse.ok) {
        const connectData = await connectResponse.json();
        console.log(`[SyncPhone] connect response:`, JSON.stringify(connectData));
        
        if (connectData.instance?.state === 'open' || connectData.instance?.state === 'connected') {
          ownerJid = connectData.instance?.wuid || connectData.instance?.owner;
        }
      }
    }

    if (!ownerJid) {
      return new Response(JSON.stringify({ 
        error: 'Phone number not found',
        message: 'A instância não está conectada ou o número não foi encontrado. Verifique se o QR code foi escaneado.',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const phoneRaw = ownerJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
    const phoneE164 = normalizePhoneE164(phoneRaw);

    if (!phoneE164) {
      return new Response(JSON.stringify({ 
        error: 'Invalid phone format',
        raw: phoneRaw,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[SyncPhone] Normalized phone: ${phoneE164}`);

    await supabase
      .from('whatsapp_instances')
      .update({
        phone_number: phoneRaw,
        phone_e164: phoneE164,
        status: 'connected',
      })
      .eq('id', instanceId);

    const sellerId = await ensureSellerFromInstancePhone(
      supabase,
      instanceId,
      instance.company_id,
      phoneE164
    );

    return new Response(JSON.stringify({
      success: true,
      phone_e164: phoneE164,
      seller_id: sellerId,
      status: 'connected',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[SyncPhone] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});