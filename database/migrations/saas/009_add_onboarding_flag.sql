-- 009_add_onboarding_flag.sql
ALTER TABLE public.organizaciones ADD COLUMN IF NOT EXISTS onboarding_completado BOOLEAN DEFAULT false;
-- Para la organización por defecto, asumimos que ya está lista
UPDATE public.organizaciones SET onboarding_completado = true WHERE id = '00000000-0000-0000-0000-000000000000';
