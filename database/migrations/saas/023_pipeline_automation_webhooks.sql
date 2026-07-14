-- 023_pipeline_automation_webhooks.sql
-- Habilita soporte para disparar Webhooks desde las automatizaciones.

-- 1. Eliminar el constraint anterior (tipo_accion IN ('mensaje', 'mover_etapa'))
ALTER TABLE public.pipeline_automatizaciones
DROP CONSTRAINT IF EXISTS pipeline_automatizaciones_tipo_accion_check;

-- 2. Crear el nuevo constraint agregando 'webhook'
ALTER TABLE public.pipeline_automatizaciones
ADD CONSTRAINT pipeline_automatizaciones_tipo_accion_check 
CHECK (tipo_accion IN ('mensaje', 'mover_etapa', 'webhook'));

-- 3. Agregar la columna para guardar la URL del webhook
ALTER TABLE public.pipeline_automatizaciones
ADD COLUMN IF NOT EXISTS webhook_url text;
