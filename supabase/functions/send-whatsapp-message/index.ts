import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  conversationId: string;
  content: string;
  messageType?: 'text' | 'image' | 'audio' | 'video' | 'document';
  mediaUrl?: string;
  mediaCaption?: string;
  quotedMessageId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user
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

    // Use service role for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendMessageRequest = await req.json();
    const { conversationId, content, messageType = 'text', mediaUrl, mediaCaption, quotedMessageId } = body;

    if (!conversationId || !content) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get conversation with contact and instance
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select(`
        *,
        contact:whatsapp_contacts(*),
        instance:whatsapp_instances(*)
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('Conversation not found:', convError);
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const instance = conversation.instance;
    const contact = conversation.contact;

    if (!instance) {
      return new Response(JSON.stringify({ error: 'No instance linked to conversation' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get API key from secrets
    const { data: secret, error: secretError } = await supabase
      .from('whatsapp_instance_secrets')
      .select('api_key')
      .eq('instance_id', instance.id)
      .single();

    if (secretError || !secret) {
      console.error('API key not found:', secretError);
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiUrl = instance.api_url.replace(/\/$/, '');
    const apiKey = secret.api_key;
    const instanceName = instance.instance_name;

    // Build Evolution API request
    let evolutionEndpoint: string;
    let evolutionBody: any;

    if (messageType === 'text') {
      evolutionEndpoint = `${apiUrl}/message/sendText/${instanceName}`;
      evolutionBody = {
        number: contact.phone_number,
        text: content,
      };

      // Add quoted message if replying
      if (quotedMessageId) {
        evolutionBody.quoted = {
          key: {
            id: quotedMessageId,
          },
        };
      }
    } else {
      // Media message
      evolutionEndpoint = `${apiUrl}/message/sendMedia/${instanceName}`;
      evolutionBody = {
        number: contact.phone_number,
        mediatype: messageType,
        media: mediaUrl || content,
        caption: mediaCaption,
      };
    }

    console.log(`[SendMessage] Sending to ${evolutionEndpoint}`);

    // Send to Evolution API
    const evolutionResponse = await fetch(evolutionEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(evolutionBody),
    });

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error('[SendMessage] Evolution API error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to send message', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const evolutionResult = await evolutionResponse.json();
    console.log('[SendMessage] Evolution response:', evolutionResult);

    // Extract message ID from response
    const messageId = evolutionResult.key?.id || evolutionResult.messageId || crypto.randomUUID();

    // Save message to database
    const { data: savedMessage, error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert({
        company_id: conversation.company_id,
        conversation_id: conversationId,
        contact_id: contact.id,
        message_id: messageId,
        remote_jid: contact.remote_jid,
        from_me: true,
        message_type: messageType,
        content: messageType === 'text' ? content : null,
        media_url: messageType !== 'text' ? (mediaUrl || content) : null,
        media_caption: mediaCaption,
        quoted_message_id: quotedMessageId,
        status: 'sent',
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError) {
      console.error('[SendMessage] Error saving message:', saveError);
    }

    // Update conversation
    await supabase
      .from('whatsapp_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content.slice(0, 100),
        is_from_me: true,
      })
      .eq('id', conversationId);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId,
      message: savedMessage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[SendMessage] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
