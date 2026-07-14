-- 011_pipelines_and_stages.sql
-- Adds editable, multi-pipeline support (like Kommo's funnels): each organization can have
-- several pipelines, each with its own ordered, renameable, colorable stages.
-- Additive only: does NOT touch entradas.estado_tramite or its CHECK constraint, so every
-- existing feature that reads estado_tramite (ClientViewTramites.jsx, Badge.jsx, etc.) keeps
-- working unchanged. This migration also backfills a default pipeline per organization that
-- already has trámites, mirroring today's 5 hardcoded Kanban stages 1:1, so no board changes
-- visually until someone edits it.

-- 1. Pipelines
CREATE TABLE IF NOT EXISTS public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT get_user_org_id() REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  orden integer NOT NULL DEFAULT 0,
  es_predeterminado boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  actualizado_en timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Etapas (stages) per pipeline
CREATE TABLE IF NOT EXISTS public.pipeline_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT get_user_org_id() REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  codigo text,
  color text NOT NULL DEFAULT '#7c3aed',
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipelines_organization_id ON public.pipelines(organization_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_etapas_pipeline_id ON public.pipeline_etapas(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_etapas_organization_id ON public.pipeline_etapas(organization_id);

-- 3. Link entradas to a pipeline + stage (additive, nullable, estado_tramite untouched)
ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL;
ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.pipeline_etapas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_entradas_pipeline_id ON public.entradas(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_entradas_stage_id ON public.entradas(stage_id);

-- 4. RLS — same tenant_isolation_policy pattern as every other business table
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.pipelines;
CREATE POLICY tenant_isolation_policy ON public.pipelines
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

ALTER TABLE public.pipeline_etapas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.pipeline_etapas;
CREATE POLICY tenant_isolation_policy ON public.pipeline_etapas
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- 5. Backfill: one default pipeline per organization that already has entradas, with the
--    5 stages that are hardcoded today in HomeView.jsx's KANBAN_STAGES, in the same order.
DO $$
DECLARE
  org record;
  new_pipeline_id uuid;
  stage_entrante uuid;
  stage_esperando_cliente uuid;
  stage_esperando uuid;
  stage_cobranza uuid;
  stage_logrado uuid;
BEGIN
  FOR org IN
    SELECT DISTINCT organization_id FROM public.entradas WHERE organization_id IS NOT NULL
  LOOP
    IF EXISTS (SELECT 1 FROM public.pipelines WHERE organization_id = org.organization_id) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.pipelines (organization_id, nombre, orden, es_predeterminado)
    VALUES (org.organization_id, 'Pipeline principal', 0, true)
    RETURNING id INTO new_pipeline_id;

    INSERT INTO public.pipeline_etapas (pipeline_id, organization_id, nombre, codigo, color, orden)
    VALUES (new_pipeline_id, org.organization_id, 'Clientes Entrantes', 'entrante', '#378ADD', 0)
    RETURNING id INTO stage_entrante;

    INSERT INTO public.pipeline_etapas (pipeline_id, organization_id, nombre, codigo, color, orden)
    VALUES (new_pipeline_id, org.organization_id, 'Esperando por el cliente', 'esperando_cliente', '#ef4444', 1)
    RETURNING id INTO stage_esperando_cliente;

    INSERT INTO public.pipeline_etapas (pipeline_id, organization_id, nombre, codigo, color, orden)
    VALUES (new_pipeline_id, org.organization_id, 'Esperando', 'esperando', '#ef4444', 2)
    RETURNING id INTO stage_esperando;

    INSERT INTO public.pipeline_etapas (pipeline_id, organization_id, nombre, codigo, color, orden)
    VALUES (new_pipeline_id, org.organization_id, 'Realizar Cobranza', 'cobranza', '#1D9E75', 3)
    RETURNING id INTO stage_cobranza;

    INSERT INTO public.pipeline_etapas (pipeline_id, organization_id, nombre, codigo, color, orden)
    VALUES (new_pipeline_id, org.organization_id, 'Logrado con Éxito', 'logrado', '#10b981', 4)
    RETURNING id INTO stage_logrado;

    -- Map every existing entrada's legacy estado_tramite to the matching new stage_id
    UPDATE public.entradas SET pipeline_id = new_pipeline_id,
      stage_id = CASE
        WHEN lower(estado_tramite) IN ('pendiente', 'en_proceso') THEN stage_entrante
        WHEN lower(estado_tramite) IN ('esperando_docs', 'requiere_atencion') THEN stage_esperando_cliente
        WHEN lower(estado_tramite) = 'procesando' THEN stage_esperando
        WHEN lower(estado_tramite) = 'cancelada' THEN stage_cobranza
        WHEN lower(estado_tramite) = 'completada' THEN stage_logrado
        ELSE stage_entrante
      END
    WHERE organization_id = org.organization_id;
  END LOOP;
END $$;
