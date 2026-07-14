-- 09_kommo_stage_mappings.sql
-- Mapea cada combinación (pipeline, etapa) de Kommo a un nombre de trámite local. Hace
-- falta por combinación porque cada pipeline de Kommo (una línea de negocio distinta)
-- tiene sus propias etapas — no hay una correspondencia única "nombre de columna = trámite".
-- Cuando llega un webhook leads[status] (el lead cambió de etapa en Kommo), kommo-webhook
-- busca el mapeo acá y, si existe, actualiza entradas.servicio y clientes.tramite.

CREATE TABLE IF NOT EXISTS public.kommo_stage_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT get_user_org_id(),
  kommo_pipeline_id text NOT NULL,
  kommo_pipeline_name text,
  kommo_stage_id text NOT NULL,
  kommo_stage_name text,
  tramite text NOT NULL,
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT kommo_stage_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT kommo_stage_mappings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id),
  CONSTRAINT kommo_stage_mappings_unique UNIQUE (organization_id, kommo_pipeline_id, kommo_stage_id)
);

ALTER TABLE public.kommo_stage_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their organization's kommo_stage_mappings" ON public.kommo_stage_mappings;
CREATE POLICY "Users can view their organization's kommo_stage_mappings"
ON public.kommo_stage_mappings FOR SELECT
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can insert their organization's kommo_stage_mappings" ON public.kommo_stage_mappings;
CREATE POLICY "Users can insert their organization's kommo_stage_mappings"
ON public.kommo_stage_mappings FOR INSERT
WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can update their organization's kommo_stage_mappings" ON public.kommo_stage_mappings;
CREATE POLICY "Users can update their organization's kommo_stage_mappings"
ON public.kommo_stage_mappings FOR UPDATE
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can delete their organization's kommo_stage_mappings" ON public.kommo_stage_mappings;
CREATE POLICY "Users can delete their organization's kommo_stage_mappings"
ON public.kommo_stage_mappings FOR DELETE
USING (organization_id = get_user_org_id());
