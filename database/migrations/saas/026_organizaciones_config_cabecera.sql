-- 026_organizaciones_config_cabecera.sql
-- Agrega configuración de cabecera de cliente a las organizaciones.

ALTER TABLE public.organizaciones
ADD COLUMN IF NOT EXISTS config_cabecera_cliente jsonb DEFAULT '["cpf", "email", "telefono", "origen"]'::jsonb;
