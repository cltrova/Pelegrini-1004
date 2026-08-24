-- Primeiro: adicionar os novos valores ao enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerencial';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor';