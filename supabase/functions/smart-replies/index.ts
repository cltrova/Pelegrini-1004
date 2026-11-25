import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { suggestSmartReplies } from "../_shared/smart-replies.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "conversationId is required", replies: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[smart-replies] Generating replies for conversation: ${conversationId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the last 10 messages for context
    const { data: messages, error: msgError } = await supabase
      .from("whatsapp_messages")
      .select("content, from_me, message_type")
      .eq("conversation_id", conversationId)
      .order("timestamp", { ascending: false })
      .limit(10);

    if (msgError) {
      console.error("[smart-replies] Error fetching messages:", msgError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch messages", replies: [] }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return Response.json(await suggestSmartReplies(messages ?? [], req.signal), { headers: corsHeaders });

  } catch (error) {
    console.error("[smart-replies] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        replies: ["Entendi!", "Vou verificar.", "Obrigado!"]
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
