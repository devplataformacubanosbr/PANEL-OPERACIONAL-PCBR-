-- Migración 028: Añadir ia_workflow_id a pipeline_automatizaciones

ALTER TABLE public.pipeline_automatizaciones 
ADD COLUMN ia_workflow_id UUID REFERENCES public.ia_workflows(id) ON DELETE SET NULL;

-- Permitir que "tipo_accion" sea 'ia' si no lo era antes, aunque es un varchar(50) normalmente.
