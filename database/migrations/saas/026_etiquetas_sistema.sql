-- 026_etiquetas_sistema.sql
-- Crea el sistema de etiquetas (tags) para los trámites (entradas)

-- 1. Crear tabla de etiquetas
CREATE TABLE IF NOT EXISTS public.etiquetas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  color text NOT NULL,
  creado_en timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS en etiquetas
ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Etiquetas visibles para usuarios de la organizacion') THEN
        CREATE POLICY "Etiquetas visibles para usuarios de la organizacion" ON public.etiquetas
        FOR SELECT
        USING (organization_id = (SELECT organization_id FROM public.perfiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Etiquetas insertables por usuarios de la organizacion') THEN
        CREATE POLICY "Etiquetas insertables por usuarios de la organizacion" ON public.etiquetas
        FOR INSERT
        WITH CHECK (organization_id = (SELECT organization_id FROM public.perfiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Etiquetas actualizables por usuarios de la organizacion') THEN
        CREATE POLICY "Etiquetas actualizables por usuarios de la organizacion" ON public.etiquetas
        FOR UPDATE
        USING (organization_id = (SELECT organization_id FROM public.perfiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Etiquetas eliminables por usuarios de la organizacion') THEN
        CREATE POLICY "Etiquetas eliminables por usuarios de la organizacion" ON public.etiquetas
        FOR DELETE
        USING (organization_id = (SELECT organization_id FROM public.perfiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 3. Añadir la columna etiquetas_ids a la tabla entradas
ALTER TABLE public.entradas
ADD COLUMN IF NOT EXISTS etiquetas_ids uuid[] DEFAULT '{}';

-- 4. Actualizar las reglas de automatización para soportar la acción "etiqueta"
ALTER TABLE public.pipeline_automatizaciones
DROP CONSTRAINT IF EXISTS pipeline_automatizaciones_tipo_accion_check;

ALTER TABLE public.pipeline_automatizaciones
ADD CONSTRAINT pipeline_automatizaciones_tipo_accion_check 
CHECK (tipo_accion IN ('mensaje', 'mover_etapa', 'webhook', 'operario', 'etiqueta'));

ALTER TABLE public.pipeline_automatizaciones
ADD COLUMN IF NOT EXISTS etiqueta_id uuid REFERENCES public.etiquetas(id) ON DELETE CASCADE;
