ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS filial_id TEXT,
  ADD COLUMN IF NOT EXISTS filiais_permitidas TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.user_module_permissions
  ADD COLUMN IF NOT EXISTS modulo_operacional BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS modulo_resumo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permissoes_paginas JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerencial';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor';

NOTIFY pgrst, 'reload schema';
