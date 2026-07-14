-- 06_kommo_webhook_secret.sql
-- kommo-webhook trusted only an unauthenticated ?org_id= query param, so anyone
-- who obtained an org's UUID (visible in KommoSettings.jsx's webhook URL) could
-- forge requests and write arbitrary clientes/entradas_tramites/notas_tramite
-- data. Add a per-organization secret, following the same pattern already used
-- for integraciones_whatsapp (see 010_whatsapp_webhook_secret_unique.sql):
-- kommo-webhook now resolves the organization strictly from this secret.
--
-- Unlike integraciones_whatsapp, integraciones_kommo/kommo_field_mappings
-- never actually existed in the live database (this Kommo integration is new,
-- unreleased work) — so this migration creates them from scratch, RLS
-- included, rather than assuming they pre-exist.

CREATE TABLE IF NOT EXISTS public.integraciones_kommo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT get_user_org_id(),
  subdominio text,
  token text,
  webhook_secret text,
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT integraciones_kommo_pkey PRIMARY KEY (id),
  CONSTRAINT integraciones_kommo_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id),
  CONSTRAINT integraciones_kommo_organization_id_key UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS public.kommo_field_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT get_user_org_id(),
  kommo_entity text NOT NULL,
  kommo_field_id text NOT NULL,
  kommo_field_name text,
  local_field text NOT NULL,
  local_field_type text NOT NULL,
  is_identifier boolean DEFAULT false,
  CONSTRAINT kommo_field_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT kommo_field_mappings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id)
);

-- Cubre también el caso de un entorno donde integraciones_kommo ya exista
-- (creada a mano, como pasó con otras tablas de este proyecto) pero sin esta
-- columna todavía.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'integraciones_kommo' AND column_name = 'webhook_secret'
    ) THEN
        ALTER TABLE public.integraciones_kommo ADD COLUMN webhook_secret text;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_integraciones_kommo_webhook_secret
  ON public.integraciones_kommo (webhook_secret)
  WHERE webhook_secret IS NOT NULL;

-- Estas dos tablas las lee/escribe el frontend directo con la anon key
-- (KommoSettings.jsx), así que la confidencialidad del token de Kommo depende
-- por completo de que RLS esté activo y correctamente scopeado por
-- organización.

ALTER TABLE public.integraciones_kommo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kommo_field_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their organization's integraciones_kommo" ON public.integraciones_kommo;
CREATE POLICY "Users can view their organization's integraciones_kommo"
ON public.integraciones_kommo FOR SELECT
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can insert their organization's integraciones_kommo" ON public.integraciones_kommo;
CREATE POLICY "Users can insert their organization's integraciones_kommo"
ON public.integraciones_kommo FOR INSERT
WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can update their organization's integraciones_kommo" ON public.integraciones_kommo;
CREATE POLICY "Users can update their organization's integraciones_kommo"
ON public.integraciones_kommo FOR UPDATE
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can delete their organization's integraciones_kommo" ON public.integraciones_kommo;
CREATE POLICY "Users can delete their organization's integraciones_kommo"
ON public.integraciones_kommo FOR DELETE
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can view their organization's kommo_field_mappings" ON public.kommo_field_mappings;
CREATE POLICY "Users can view their organization's kommo_field_mappings"
ON public.kommo_field_mappings FOR SELECT
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can insert their organization's kommo_field_mappings" ON public.kommo_field_mappings;
CREATE POLICY "Users can insert their organization's kommo_field_mappings"
ON public.kommo_field_mappings FOR INSERT
WITH CHECK (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can update their organization's kommo_field_mappings" ON public.kommo_field_mappings;
CREATE POLICY "Users can update their organization's kommo_field_mappings"
ON public.kommo_field_mappings FOR UPDATE
USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "Users can delete their organization's kommo_field_mappings" ON public.kommo_field_mappings;
CREATE POLICY "Users can delete their organization's kommo_field_mappings"
ON public.kommo_field_mappings FOR DELETE
USING (organization_id = get_user_org_id());
