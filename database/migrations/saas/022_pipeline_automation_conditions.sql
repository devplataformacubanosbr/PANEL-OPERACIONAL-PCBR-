-- 022_pipeline_automation_conditions.sql
-- Agrega soporte para automatizaciones condicionales (filtros)
-- Permite que una regla solo se ejecute si la entrada cumple con las condiciones especificadas (ej: servicios/trámites específicos).

ALTER TABLE public.pipeline_automatizaciones
ADD COLUMN IF NOT EXISTS condiciones jsonb DEFAULT '{}'::jsonb;

-- Ejemplo de estructura para 'condiciones':
-- {
--   "servicios": ["PASAPORTE", "PRÓRROGA"] 
-- }
-- Si servicios está vacío o no existe, aplica a todos.
