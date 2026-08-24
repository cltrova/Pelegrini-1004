-- Add new columns to whatsapp_sentiment_analysis for comprehensive report
ALTER TABLE public.whatsapp_sentiment_analysis
ADD COLUMN IF NOT EXISTS satisfaction_level text,
ADD COLUMN IF NOT EXISTS satisfaction_score integer,
ADD COLUMN IF NOT EXISTS satisfaction_indicators jsonb,
ADD COLUMN IF NOT EXISTS sentiment_evolution text,
ADD COLUMN IF NOT EXISTS service_quality_rating integer,
ADD COLUMN IF NOT EXISTS agent_tone text,
ADD COLUMN IF NOT EXISTS empathy_level text,
ADD COLUMN IF NOT EXISTS solution_provided boolean,
ADD COLUMN IF NOT EXISTS first_contact_resolution boolean,
ADD COLUMN IF NOT EXISTS response_time_estimate text,
ADD COLUMN IF NOT EXISTS conversation_flow text,
ADD COLUMN IF NOT EXISTS message_clarity text,
ADD COLUMN IF NOT EXISTS conversation_type text,
ADD COLUMN IF NOT EXISTS urgency_level text,
ADD COLUMN IF NOT EXISTS complexity text,
ADD COLUMN IF NOT EXISTS resolution_status text,
ADD COLUMN IF NOT EXISTS recommendations jsonb,
ADD COLUMN IF NOT EXISTS key_moments jsonb,
ADD COLUMN IF NOT EXISTS customer_intent text;

-- Add comment for documentation
COMMENT ON TABLE public.whatsapp_sentiment_analysis IS 'Comprehensive conversation analysis including satisfaction, service quality, and recommendations';