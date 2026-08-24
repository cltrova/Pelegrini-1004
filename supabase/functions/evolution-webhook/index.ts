import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionEvent {
  event: string;
  instance: string;
  data: any;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: EvolutionEvent = await req.json();
    console.log(`[Webhook] Event: ${payload.event}, Instance: ${payload.instance}`);

    // Find instance by name - include phone_e164 and default_seller_id
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, company_id, status, phone_e164, default_seller_id')
      .eq('instance_name', payload.instance)
      .single();

    if (instanceError || !instance) {
      console.error(`[Webhook] Instance not found: ${payload.instance}`);
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instanceId = instance.id;
    const companyId = instance.company_id;

    switch (payload.event) {
      case 'messages.upsert':
        await handleMessageUpsert(supabase, payload.data, instanceId, companyId, instance.default_seller_id);
        break;

      case 'messages.update':
        await handleMessageUpdate(supabase, payload.data);
        break;

      case 'connection.update':
        await handleConnectionUpdate(supabase, payload.data, instanceId, companyId);
        break;

      case 'qrcode.updated':
        await handleQRCodeUpdate(supabase, payload.data, instanceId);
        break;

      default:
        console.log(`[Webhook] Unhandled event: ${payload.event}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[Webhook] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Normalize phone to E.164 format
function normalizePhoneE164(phone: string): string | null {
  const clean = phone.replace(/\D/g, '');
  
  // Brazilian format: 55 + DDD (2) + number (8-9) = 12-13 digits
  if (clean.length >= 12 && clean.startsWith('55')) {
    return '+' + clean;
  }
  // Without country code: DDD (2) + number (8-9) = 10-11 digits
  if (clean.length >= 10 && clean.length <= 11) {
    return '+55' + clean;
  }
  // Other international formats
  if (clean.length >= 10) {
    return '+' + clean;
  }
  return null;
}

// Auto-register seller from connected instance phone - uses whitelist as source of truth
async function ensureSellerFromInstancePhone(
  supabase: any,
  instanceId: string,
  companyId: string,
  phoneE164: string
): Promise<string | null> {
  try {
    console.log(`[Webhook] Registering seller phone: ${phoneE164}`);

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
      
      console.log(`[Webhook] Linked existing profile: ${existingProfile.id}`);
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
      console.error('[Webhook] Error adding to whitelist:', whitelistError);
      return null;
    }

    console.log(`[Webhook] Added to whitelist: ${phoneE164}`);
    return null; // No profile yet, but whitelist entry created
  } catch (error) {
    console.error('[Webhook] Error in ensureSellerFromInstancePhone:', error);
    return null;
  }
}

async function handleMessageUpsert(
  supabase: any,
  data: any,
  instanceId: string,
  companyId: string,
  defaultSellerId: string | null
) {
  const message = data.message || data;
  const key = message.key || data.key;
  
  if (!key) {
    console.error('[Webhook] No key in message data');
    return;
  }

  const remoteJid = key.remoteJid;
  const fromMe = key.fromMe || false;
  const messageId = key.id;

  // Skip group messages
  if (remoteJid?.endsWith('@g.us')) {
    console.log('[Webhook] Skipping group message');
    return;
  }

  // Extract phone number from JID
  const phoneNumber = remoteJid?.replace('@s.whatsapp.net', '').replace('@c.us', '');

  // ── AGENT ROUTER ─────────────────────────────────────────────────────────
  // Se esta instância é o número de um agente ativo, e a mensagem é de um membro
  // (não from_me), redireciona para o agent-router e PARA o fluxo normal de cliente.
  if (!fromMe && phoneNumber) {
    const { data: agent } = await supabase
      .from('whatsapp_agents')
      .select('id, name, company_id, is_active')
      .eq('instance_id', instanceId)
      .eq('is_active', true)
      .maybeSingle();

    if (agent) {
      const messageContentEarly = extractMessageContent(message);
      const text = messageContentEarly.content || messageContentEarly.caption || '';
      const sourcePhone = '+' + phoneNumber;
      const sourceName = message.pushName || data.pushName || null;

      // Detecta comando interno (ex: /assumir <id>, /pausar)
      if (text.trim().startsWith('/')) {
        try {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-command-handler`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              agent_id: agent.id,
              source_phone_e164: sourcePhone,
              source_name: sourceName,
              command: text.trim(),
            }),
          });
        } catch (e) {
          console.error('[Webhook→agent-command-handler] failed', e);
        }
        return; // não cria conversa de cliente
      }

      // Caso normal: dispara router
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/agent-router`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            agent_id: agent.id,
            source_phone_e164: sourcePhone,
            source_name: sourceName,
            content: text,
            message_type: 'text',
            triggered_by: 'internal_chat',
          }),
        });
      } catch (e) {
        console.error('[Webhook→agent-router] failed', e);
      }
      return; // ignora fluxo normal de cliente para mensagens recebidas no número-agente
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  
  // Get or create contact
  let contact = await getOrCreateContact(supabase, {
    companyId,
    instanceId,
    remoteJid,
    phoneNumber,
    pushName: message.pushName || data.pushName,
  });

  // Get or create conversation
  let conversation = await getOrCreateConversation(supabase, {
    companyId,
    instanceId,
    contactId: contact.id,
  });

  // Determine message type and content
  const messageContent = extractMessageContent(message);
  
  // Check if message already exists
  const { data: existingMsg } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('message_id', messageId)
    .single();

  if (existingMsg) {
    console.log(`[Webhook] Message already exists: ${messageId}`);
    return;
  }

  // Insert message
  const { error: msgError } = await supabase
    .from('whatsapp_messages')
    .insert({
      company_id: companyId,
      conversation_id: conversation.id,
      contact_id: contact.id,
      message_id: messageId,
      remote_jid: remoteJid,
      from_me: fromMe,
      message_type: messageContent.type,
      content: messageContent.content,
      media_url: messageContent.mediaUrl,
      media_mimetype: messageContent.mimetype,
      media_caption: messageContent.caption,
      quoted_message_id: message.contextInfo?.stanzaId || null,
      quoted_content: message.contextInfo?.quotedMessage?.conversation || null,
      status: fromMe ? 'sent' : 'delivered',
      timestamp: new Date(data.messageTimestamp * 1000 || Date.now()).toISOString(),
    });

  if (msgError) {
    console.error('[Webhook] Error inserting message:', msgError);
    return;
  }

  // ── COBRANÇA: detecta intenção em mensagens recebidas (cliente -> empresa)
  if (!fromMe && messageContent.content && messageContent.content.length > 2) {
    try {
      const { data: empresaRow } = await supabase
        .from('empresas')
        .select('cod_empresa_bi, modulo_resumo')
        .eq('id', companyId)
        .maybeSingle();
      if (empresaRow?.cod_empresa_bi && empresaRow?.modulo_resumo) {
        // últimas mensagens da conversa para contexto
        const { data: history } = await supabase
          .from('whatsapp_messages')
          .select('content, from_me')
          .eq('conversation_id', conversation.id)
          .order('timestamp', { ascending: false })
          .limit(8);
        const last_messages = (history || [])
          .reverse()
          .filter(m => m.content)
          .map(m => ({ role: m.from_me ? 'agente' : 'cliente', content: m.content as string }));

        // dispara em background
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/cobranca-detect-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            cod_empresa_bi: empresaRow.cod_empresa_bi,
            conversation_id: conversation.id,
            contact_phone: phoneNumber ? '+' + phoneNumber : null,
            cliente_nome: contact.name || contact.push_name || null,
            ultima_mensagem_cliente: messageContent.content,
            last_messages,
          }),
        }).catch(e => console.error('[cobranca-detect-intent] fail', e));
      }
    } catch (e) {
      console.error('[cobranca-detect-intent setup] fail', e);
    }
  }

  // Update conversation
  const updateData: any = {
    last_message_at: new Date().toISOString(),
    last_message_preview: messageContent.content?.slice(0, 100) || '[Mídia]',
    is_from_me: fromMe,
  };

  // AUTO-ASSIGN: If message is from_me and we have a default seller, assign conversation
  if (fromMe && defaultSellerId) {
    // Get the user_id from the profile for assignment
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', defaultSellerId)
      .single();

    if (sellerProfile?.user_id && !conversation.assigned_to) {
      updateData.assigned_to = sellerProfile.user_id;
      updateData.status = 'active';
      console.log(`[Webhook] Auto-assigned conversation to seller: ${sellerProfile.user_id}`);
    }
  }

  // Increment unread count if message is not from me
  if (!fromMe) {
    updateData.unread_count = (conversation.unread_count || 0) + 1;
    
    // If no one assigned, check assignment rules
    if (!conversation.assigned_to) {
      const assignedTo = await applyAssignmentRules(supabase, companyId, instanceId);
      if (assignedTo) {
        updateData.assigned_to = assignedTo;
        updateData.status = 'active';
      } else {
        updateData.status = 'queue';
      }
    }
  }

  await supabase
    .from('whatsapp_conversations')
    .update(updateData)
    .eq('id', conversation.id);

  console.log(`[Webhook] Message saved: ${messageId}`);
}

async function handleMessageUpdate(supabase: any, data: any) {
  const updates = Array.isArray(data) ? data : [data];

  for (const update of updates) {
    const messageId = update.key?.id || update.id;
    const status = update.update?.status || update.status;
    
    if (!messageId || !status) continue;

    // Map Evolution status to our status
    let newStatus = 'sent';
    if (status === 2 || status === 'DELIVERY_ACK') newStatus = 'sent';
    if (status === 3 || status === 'READ') newStatus = 'delivered';
    if (status === 4 || status === 'PLAYED') newStatus = 'read';

    const { error } = await supabase
      .from('whatsapp_messages')
      .update({ status: newStatus })
      .eq('message_id', messageId);

    if (!error) {
      console.log(`[Webhook] Message status updated: ${messageId} -> ${newStatus}`);
    }
  }
}

async function handleConnectionUpdate(
  supabase: any, 
  data: any, 
  instanceId: string,
  companyId: string
) {
  let status = 'disconnected';
  
  if (data.state === 'open' || data.connection === 'open') {
    status = 'connected';
  } else if (data.state === 'connecting' || data.connection === 'connecting') {
    status = 'connecting';
  } else if (data.state === 'close' || data.connection === 'close') {
    status = 'disconnected';
  }

  const updateData: any = { status };

  // Extract phone number from multiple possible sources
  let rawPhone = data.instance?.wuid || 
                 data.wuid || 
                 data.ownerJid || 
                 data.instance?.owner;

  if (rawPhone) {
    // Clean up the phone format
    rawPhone = rawPhone.replace('@s.whatsapp.net', '').replace('@c.us', '');
    const phoneE164 = normalizePhoneE164(rawPhone);
    
    if (phoneE164) {
      updateData.phone_number = rawPhone;
      updateData.phone_e164 = phoneE164;
      
      console.log(`[Webhook] Phone extracted: ${rawPhone} -> ${phoneE164}`);
      
      // AUTO-REGISTER SELLER: When connected, create/link seller automatically
      if (status === 'connected') {
        await ensureSellerFromInstancePhone(supabase, instanceId, companyId, phoneE164);
      }
    }
  }

  await supabase
    .from('whatsapp_instances')
    .update(updateData)
    .eq('id', instanceId);

  console.log(`[Webhook] Connection updated: ${status}, phone: ${updateData.phone_e164 || 'unknown'}`);
}

async function handleQRCodeUpdate(supabase: any, data: any, instanceId: string) {
  const qrCode = data.qrcode?.base64 || data.base64 || data.qr;
  
  if (!qrCode) {
    console.log('[Webhook] No QR code in payload');
    return;
  }

  await supabase
    .from('whatsapp_instances')
    .update({
      qr_code: qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`,
      status: 'qr_pending',
    })
    .eq('id', instanceId);

  console.log('[Webhook] QR Code updated');
}

async function getOrCreateContact(
  supabase: any,
  data: {
    companyId: string;
    instanceId: string;
    remoteJid: string;
    phoneNumber: string;
    pushName?: string;
  }
) {
  // Try to find existing contact
  const { data: existing } = await supabase
    .from('whatsapp_contacts')
    .select('*')
    .eq('company_id', data.companyId)
    .eq('remote_jid', data.remoteJid)
    .single();

  if (existing) {
    // Update push_name if changed
    if (data.pushName && data.pushName !== existing.push_name) {
      await supabase
        .from('whatsapp_contacts')
        .update({ push_name: data.pushName })
        .eq('id', existing.id);
    }
    return existing;
  }

  // Create new contact
  const { data: newContact, error } = await supabase
    .from('whatsapp_contacts')
    .insert({
      company_id: data.companyId,
      instance_id: data.instanceId,
      remote_jid: data.remoteJid,
      phone_number: data.phoneNumber,
      push_name: data.pushName,
      is_group: false,
    })
    .select()
    .single();

  if (error) {
    console.error('[Webhook] Error creating contact:', error);
    throw error;
  }

  return newContact;
}

async function getOrCreateConversation(
  supabase: any,
  data: {
    companyId: string;
    instanceId: string;
    contactId: string;
  }
) {
  // Try to find existing conversation
  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('company_id', data.companyId)
    .eq('contact_id', data.contactId)
    .single();

  if (existing) return existing;

  // Create new conversation
  const { data: newConv, error } = await supabase
    .from('whatsapp_conversations')
    .insert({
      company_id: data.companyId,
      instance_id: data.instanceId,
      contact_id: data.contactId,
      status: 'queue',
      unread_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[Webhook] Error creating conversation:', error);
    throw error;
  }

  return newConv;
}

async function applyAssignmentRules(
  supabase: any,
  companyId: string,
  instanceId: string
): Promise<string | null> {
  // Find active rule for this instance or company default
  const { data: rule } = await supabase
    .from('assignment_rules')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or(`instance_id.eq.${instanceId},instance_id.is.null`)
    .order('instance_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .single();

  if (!rule) return null;

  if (rule.rule_type === 'fixed_agent' && rule.fixed_agent_id) {
    return rule.fixed_agent_id;
  }

  if (rule.rule_type === 'round_robin' && rule.participating_agents?.length > 0) {
    const agents = rule.participating_agents;
    const nextIndex = (rule.last_assigned_index + 1) % agents.length;
    const nextAgent = agents[nextIndex];

    // Update index for next assignment
    await supabase
      .from('assignment_rules')
      .update({ last_assigned_index: nextIndex })
      .eq('id', rule.id);

    return nextAgent;
  }

  return null;
}

function extractMessageContent(message: any): {
  type: string;
  content?: string;
  mediaUrl?: string;
  mimetype?: string;
  caption?: string;
} {
  // Text message
  if (message.conversation || message.extendedTextMessage?.text) {
    return {
      type: 'text',
      content: message.conversation || message.extendedTextMessage?.text,
    };
  }

  // Image
  if (message.imageMessage) {
    return {
      type: 'image',
      mediaUrl: message.imageMessage.url,
      mimetype: message.imageMessage.mimetype,
      caption: message.imageMessage.caption,
    };
  }

  // Audio
  if (message.audioMessage) {
    return {
      type: 'audio',
      mediaUrl: message.audioMessage.url,
      mimetype: message.audioMessage.mimetype,
    };
  }

  // Video
  if (message.videoMessage) {
    return {
      type: 'video',
      mediaUrl: message.videoMessage.url,
      mimetype: message.videoMessage.mimetype,
      caption: message.videoMessage.caption,
    };
  }

  // Document
  if (message.documentMessage) {
    return {
      type: 'document',
      mediaUrl: message.documentMessage.url,
      mimetype: message.documentMessage.mimetype,
      caption: message.documentMessage.fileName,
    };
  }

  // Sticker
  if (message.stickerMessage) {
    return {
      type: 'sticker',
      mediaUrl: message.stickerMessage.url,
      mimetype: message.stickerMessage.mimetype,
    };
  }

  // Location
  if (message.locationMessage) {
    return {
      type: 'location',
      content: `${message.locationMessage.degreesLatitude},${message.locationMessage.degreesLongitude}`,
    };
  }

  // Contact
  if (message.contactMessage) {
    return {
      type: 'contact',
      content: message.contactMessage.displayName,
    };
  }

  // Reaction
  if (message.reactionMessage) {
    return {
      type: 'reaction',
      content: message.reactionMessage.text,
    };
  }

  // Default to text
  return {
    type: 'text',
    content: JSON.stringify(message),
  };
}
