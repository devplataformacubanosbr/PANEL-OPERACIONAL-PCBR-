-- 10_kommo_stage_activa_registro.sql
-- El nombre de trámite por etapa (kommo_stage_mappings.tramite) y el disparo de registro
-- de un cliente/trámite nuevo son dos decisiones distintas: un lead puede pasar por muchas
-- etapas mapeadas con nombre de trámite antes de llegar a la etapa que realmente decide
-- "acá es donde se registra si todavía no existe". activa_registro deja esa elección en
-- manos del usuario en vez de disparar el registro automáticamente en cualquier etapa mapeada.

ALTER TABLE public.kommo_stage_mappings
  ADD COLUMN IF NOT EXISTS activa_registro boolean NOT NULL DEFAULT false;
