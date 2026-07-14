-- 012_pipeline_automations.sql
-- Kommo-style per-stage automations: "when a card ENTERS this stage, do X".
-- v1 supports two actions: send a WhatsApp message (via the existing enviar-whatsapp edge
-- function) or auto-move the card to another stage. Time/inactivity-based triggers are not
-- included here — they'd need a scheduled job (pg_cron) and are a separate, bigger feature.
-- Every rule is created with activo = false so nothing sends real messages until a human
-- reviews and turns it on from the UI.

CREATE TABLE IF NOT EXISTS public.pipeline_automatizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT get_user_org_id() REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.pipeline_etapas(id) ON DELETE CASCADE,
  tipo_accion text NOT NULL CHECK (tipo_accion IN ('mensaje', 'mover_etapa')),
  mensaje_texto text,
  etapa_destino_id uuid REFERENCES public.pipeline_etapas(id) ON DELETE SET NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT false,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  actualizado_en timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_automatizaciones_stage_id ON public.pipeline_automatizaciones(stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_automatizaciones_organization_id ON public.pipeline_automatizaciones(organization_id);

ALTER TABLE public.pipeline_automatizaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.pipeline_automatizaciones;
CREATE POLICY tenant_isolation_policy ON public.pipeline_automatizaciones
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());
