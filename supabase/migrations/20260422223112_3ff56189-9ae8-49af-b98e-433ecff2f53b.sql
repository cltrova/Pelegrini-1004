-- Adiciona campo 'modo' para suportar 3 modos de cálculo por linha da DFC
ALTER TABLE public.dfc_line_config
  ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'grupo';

-- Migrar valores existentes: fonte 'banco' -> modo 'grupo', fonte 'contas' -> modo 'contas'
UPDATE public.dfc_line_config
SET modo = CASE WHEN fonte = 'contas' THEN 'contas' ELSE 'grupo' END;

-- Constraint para garantir valores válidos
ALTER TABLE public.dfc_line_config
  DROP CONSTRAINT IF EXISTS dfc_line_config_modo_check;
ALTER TABLE public.dfc_line_config
  ADD CONSTRAINT dfc_line_config_modo_check
  CHECK (modo IN ('grupo', 'grupo_mais_contas', 'contas'));