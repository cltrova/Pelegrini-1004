import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildEnrichedIndicators,
  OPENAI_REQUEST_DEFAULTS,
  parseAnalysisResponse,
  resolveFinalResolutionStatus,
  SYSTEM_PROMPT,
} from "./_lib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId } = await req.json();

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "conversationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[analyze-sentiment] Starting comprehensive analysis for conversation: ${conversationId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the conversation to get company_id
    const { data: conversation, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("id, company_id, contact_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error("[analyze-sentiment] Conversation not found:", convError);
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the last 50 messages for the conversation
    const { data: messages, error: msgError } = await supabase
      .from("whatsapp_messages")
      .select("content, from_me, timestamp, message_type")
      .eq("conversation_id", conversationId)
      .order("timestamp", { ascending: false })
      .limit(50);

    if (msgError) {
      console.error("[analyze-sentiment] Error fetching messages:", msgError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch messages" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!messages || messages.length === 0) {
      console.log("[analyze-sentiment] No messages found");
      return new Response(
        JSON.stringify({ 
          sentiment: "neutral", 
          confidence: 0, 
          topics: [], 
          summary: "Sem mensagens para analisar" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format messages for the prompt
    const formattedMessages = messages
      .reverse() // Put in chronological order
      .filter(m => m.message_type === "text" && m.content)
      .map(m => `${m.from_me ? "Atendente" : "Cliente"}: ${m.content}`)
      .join("\n");

    console.log(`[analyze-sentiment] Analyzing ${messages.length} messages`);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("[analyze-sentiment] OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...OPENAI_REQUEST_DEFAULTS,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Conversa para análise completa:\n\n${formattedMessages}` }
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("[analyze-sentiment] OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to analyze with OpenAI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiResponse.json();
    const assistantMessage = openaiData.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      console.error("[analyze-sentiment] No response from OpenAI");
      return new Response(
        JSON.stringify({ error: "No response from OpenAI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response
    let analysis;
    try {
      analysis = parseAnalysisResponse(assistantMessage);
    } catch (parseError) {
      console.error("[analyze-sentiment] Failed to parse OpenAI response:", assistantMessage);
      return new Response(
        JSON.stringify({ error: "Failed to parse analysis result" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[analyze-sentiment] Comprehensive analysis result:", JSON.stringify(analysis, null, 2));

    // Update the conversation with sentiment data
    const { error: updateError } = await supabase
      .from("whatsapp_conversations")
      .update({
        sentiment: analysis.sentiment?.overall || "neutral",
        sentiment_score: analysis.sentiment?.confidence,
        topics: analysis.topics,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (updateError) {
      console.error("[analyze-sentiment] Error updating conversation:", updateError);
    }

    // Build enriched satisfaction_indicators (preserves legacy array + adds sales sub-object)
    const ctx = analysis.conversation_context || {};
    const enrichedIndicators = buildEnrichedIndicators(analysis);

    // Map sales_stage → resolution_status (overrides AI's value for sales conversations to keep KPIs consistent)
    const finalResolutionStatus = resolveFinalResolutionStatus(analysis);

    // Insert comprehensive analysis into history
    const { error: historyError } = await supabase
      .from("whatsapp_sentiment_analysis")
      .insert({
        company_id: conversation.company_id,
        conversation_id: conversationId,
        // Basic sentiment
        sentiment: analysis.sentiment?.overall || "neutral",
        confidence_score: analysis.sentiment?.confidence,
        topics: analysis.topics,
        summary: analysis.summary,
        analyzed_messages_count: messages.length,
        analyzed_at: new Date().toISOString(),
        // Satisfaction (now enriched object instead of plain array)
        satisfaction_level: analysis.customer_satisfaction?.level,
        satisfaction_score: analysis.customer_satisfaction?.score,
        satisfaction_indicators: enrichedIndicators,
        sentiment_evolution: analysis.sentiment?.evolution,
        // Service quality
        service_quality_rating: analysis.service_quality?.rating,
        agent_tone: analysis.service_quality?.agent_tone,
        empathy_level: analysis.service_quality?.empathy_level,
        solution_provided: analysis.service_quality?.solution_provided,
        first_contact_resolution: analysis.service_quality?.first_contact_resolution,
        // Response metrics
        response_time_estimate: analysis.response_metrics?.agent_response_time_estimate,
        conversation_flow: analysis.response_metrics?.conversation_flow,
        message_clarity: analysis.response_metrics?.message_clarity,
        // Context
        conversation_type: ctx.type,
        urgency_level: ctx.urgency,
        complexity: ctx.complexity,
        // Resolution (mapped from sales_stage when applicable)
        resolution_status: finalResolutionStatus,
        recommendations: analysis.recommendations,
        key_moments: analysis.key_moments,
        customer_intent: analysis.customer_intent,
      });

    if (historyError) {
      console.error("[analyze-sentiment] Error saving analysis history:", historyError);
    }

    console.log("[analyze-sentiment] Comprehensive analysis completed successfully");

    // Return full analysis result
    return new Response(
      JSON.stringify({
        // Basic
        sentiment: analysis.sentiment?.overall,
        confidence: analysis.sentiment?.confidence,
        sentimentEvolution: analysis.sentiment?.evolution,
        topics: analysis.topics,
        summary: analysis.summary,
        messagesAnalyzed: messages.length,
        // Satisfaction
        satisfactionLevel: analysis.customer_satisfaction?.level,
        satisfactionScore: analysis.customer_satisfaction?.score,
        satisfactionIndicators: analysis.customer_satisfaction?.indicators,
        // Service quality
        serviceQualityRating: analysis.service_quality?.rating,
        agentTone: analysis.service_quality?.agent_tone,
        empathyLevel: analysis.service_quality?.empathy_level,
        solutionProvided: analysis.service_quality?.solution_provided,
        firstContactResolution: analysis.service_quality?.first_contact_resolution,
        // Response metrics
        responseTimeEstimate: analysis.response_metrics?.agent_response_time_estimate,
        conversationFlow: analysis.response_metrics?.conversation_flow,
        messageClarity: analysis.response_metrics?.message_clarity,
        // Context
        conversationType: analysis.conversation_context?.type,
        urgencyLevel: analysis.conversation_context?.urgency,
        complexity: analysis.conversation_context?.complexity,
        // Resolution
        resolutionStatus: analysis.resolution_status,
        recommendations: analysis.recommendations,
        keyMoments: analysis.key_moments,
        customerIntent: analysis.customer_intent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[analyze-sentiment] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
