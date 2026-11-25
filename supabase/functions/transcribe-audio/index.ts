import { serveLegacyAi, getOpenAiApiKey, OPENAI_TRANSCRIPTION_URL } from "../_shared/ai-provider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function handleAiRequest(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = getOpenAiApiKey();
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      throw new Error('OpenAI API key not configured');
    }

    let audioBlob: Blob | null = null;
    if (req.headers.get('Content-Type')?.toLowerCase().startsWith('multipart/form-data;')) {
      const file = (await req.formData()).get('file');
      if (file instanceof Blob) audioBlob = file;
    } else {
      const { audio, mimeType = 'audio/webm' } = await req.json();
      if (typeof audio === 'string' && audio) {
        const binary = atob(audio);
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        audioBlob = new Blob([bytes], { type: mimeType });
      }
    }
    if (!audioBlob?.size) {
      return Response.json({ error: 'Envie um arquivo de áudio.', success: false }, { status: 400, headers: corsHeaders });
    }
    
    // Determine file extension from mime type
    const extensionMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/m4a': 'm4a',
    };
    const mimeType = audioBlob.type.split(';', 1)[0];
    const extension = extensionMap[mimeType] || 'webm';
    
    // Create form data for Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${extension}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'json');
    
    
    const response = await fetch(OPENAI_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
      signal: req.signal,
    });
    
    if (!response.ok) {
      await response.body?.cancel();
      console.error('Whisper API error:', response.status, response.headers.get("x-request-id"));
      throw new Error(`Whisper API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    return new Response(
      JSON.stringify({ 
        text: result.text,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Transcription error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

serveLegacyAi(handleAiRequest);
