-- 024_pipeline_automation_operario.sql
-- Habilita soporte para la acción "Cambiar Responsable" en automatizaciones.

-- 1. Eliminar el constraint anterior
ALTER TABLE public.pipeline_automatizaciones
DROP CONSTRAINT IF EXISTS pipeline_automatizaciones_tipo_accion_check;

-- 2. Crear el nuevo constraint agregando 'operario'
ALTER TABLE public.pipeline_automatizaciones
ADD CONSTRAINT pipeline_automatizaciones_tipo_accion_check 
CHECK (tipo_accion IN ('mensaje', 'mover_etapa', 'webhook', 'operario'));

-- 3. Agregar la columna para guardar el operario asignado
ALTER TABLE public.pipeline_automatizaciones
ADD COLUMN IF NOT EXISTS operario_nombre text;
