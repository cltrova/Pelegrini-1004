ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS filiais_permitidas TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
