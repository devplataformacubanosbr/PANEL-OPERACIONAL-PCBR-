-- 07_n8n_integration.sql
-- Integración genérica con n8n: la app puede mandar eventos de salida a un
-- webhook de n8n configurado por organización, y recibir eventos de entrada
-- en un endpoint propio (n8n-webhook) protegido por secreto, igual que Kommo
-- (ver 06_kommo_webhook_secret.sql). Los eventos entrantes se guardan en un
-- log simple (eventos_n8n) para verlos en la UI de ajustes — todavía sin
-- reglas de negocio conectadas, es la base para triggers concretos después.

CREATE TABLE IF NOT EXISTS public.integraciones_n8n (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT get_user_org_id(),
  webhook_url_salida text,
  webhook_secret text,
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT integraciones_n8n_pkey PRIMARY KEY (id),
  CONSTRAINT integraciones_n8n_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id),
  CONSTRAINT integraciones_n8n_organization_id_key UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS public.eventos_n8n (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT get_user_org_id(),
  payload jsonb,
  recibido_en timestamp with time zone DEFAULT now(),
  CONSTRAINT eventos_n8n_pkey PRIMARY KEY (id),
  CONSTRAINT eventos_n8n_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integraciones_n8n_webhook_secret
  ON public.integraciones_n8n (webhook_secret)
  WHERE webhook_secret IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eventos_n8n_org_recibido
  ON public.eventos_n8n (organization_id, recibido_en DESC);

ALTER TABLE public.integraciones_n8n ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_n8n ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their organization's integraciones_n8n" ON public.integraciones_n8n;
CREATE POLICY "Users can view their organization's integraciones_n8n"
ON public.integraciones_n8n FOR SELECT
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can insert their organization's integraciones_n8n" ON public.integraciones_n8n;
CREATE POLICY "Users can insert their organization's integraciones_n8n"
ON public.integraciones_n8n FOR INSERT
WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can update their organization's integraciones_n8n" ON public.integraciones_n8n;
CREATE POLICY "Users can update their organization's integraciones_n8n"
ON public.integraciones_n8n FOR UPDATE
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can delete their organization's integraciones_n8n" ON public.integraciones_n8n;
CREATE POLICY "Users can delete their organization's integraciones_n8n"
ON public.integraciones_n8n FOR DELETE
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can view their organization's eventos_n8n" ON public.eventos_n8n;
CREATE POLICY "Users can view their organization's eventos_n8n"
ON public.eventos_n8n FOR SELECT
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can delete their organization's eventos_n8n" ON public.eventos_n8n;
CREATE POLICY "Users can delete their organization's eventos_n8n"
ON public.eventos_n8n FOR DELETE
USING (organization_id = get_user_org_id());
