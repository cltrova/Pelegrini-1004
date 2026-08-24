CREATE TABLE public.estoque_assistant_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cod_empresa_bi TEXT NOT NULL UNIQUE,
  credits_used INTEGER NOT NULL DEFAULT 0,
  credits_limit INTEGER NOT NULL DEFAULT 5000,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('month', now()),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.estoque_assistant_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read credits"
ON public.estoque_assistant_credits
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert credits"
ON public.estoque_assistant_credits
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update credits"
ON public.estoque_assistant_credits
FOR UPDATE TO authenticated
USING (true);

-- Function to increment credits and check limit
CREATE OR REPLACE FUNCTION public.increment_assistant_credit(p_cod_empresa_bi TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record estoque_assistant_credits%ROWTYPE;
  v_current_period TIMESTAMP WITH TIME ZONE := date_trunc('month', now());
BEGIN
  -- Upsert: create record if not exists, reset if new period
  INSERT INTO estoque_assistant_credits (cod_empresa_bi, credits_used, period_start)
  VALUES (p_cod_empresa_bi, 0, v_current_period)
  ON CONFLICT (cod_empresa_bi) DO UPDATE
  SET credits_used = CASE
    WHEN estoque_assistant_credits.period_start < v_current_period THEN 0
    ELSE estoque_assistant_credits.credits_used
  END,
  period_start = CASE
    WHEN estoque_assistant_credits.period_start < v_current_period THEN v_current_period
    ELSE estoque_assistant_credits.period_start
  END,
  updated_at = now();

  -- Get current state
  SELECT * INTO v_record FROM estoque_assistant_credits WHERE cod_empresa_bi = p_cod_empresa_bi;

  -- Check limit
  IF v_record.credits_used >= v_record.credits_limit THEN
    RETURN json_build_object('allowed', false, 'credits_used', v_record.credits_used, 'credits_limit', v_record.credits_limit);
  END IF;

  -- Increment
  UPDATE estoque_assistant_credits
  SET credits_used = credits_used + 1, updated_at = now()
  WHERE cod_empresa_bi = p_cod_empresa_bi;

  RETURN json_build_object('allowed', true, 'credits_used', v_record.credits_used + 1, 'credits_limit', v_record.credits_limit);
END;
$$;