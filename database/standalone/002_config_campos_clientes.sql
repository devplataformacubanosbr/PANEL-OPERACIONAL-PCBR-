-- =====================================================================
-- DASHBOARDOperacional-PCBR — standalone (single-tenant) schema
-- 002_config_campos_clientes.sql
--
-- Restores the dynamic "custom fields" catalog that Avante (the
-- multi-tenant SaaS this app was forked from) uses to let admins define
-- brand-new client fields from the UI (Configuración > Campos Base),
-- without touching code or the database by hand.
--
-- IMPORTANT — how this differs from the 13 "migratory" fields already
-- baked into `clientes` (RNM, pasaporte, carnet, etc. — see
-- src/components/clientView.constants.js, FIXED_FIELDS_CATALOG):
--   - Those 13 fields are, and remain, real fixed columns on `clientes`.
--     This table is NOT for them.
--   - `config_campos_clientes` is for fields an admin creates LATER
--     (e.g. "Profesión") that have no dedicated column. Their values are
--     stored inside `clientes.campos_personalizados` (jsonb column that
--     already exists in 001_schema.sql), keyed by `identificador`.
--
-- Modeled on the live Avante `config_campos_clientes` table (introspected
-- 2026-07-14 via `npx supabase db query --linked` against the Avante
-- project), with organization_id removed (PCBR is single-tenant):
--   - PK is simply `id` (Avante also has organization_id in the PK's
--     supporting unique index; here that collapses to a plain PK).
--   - `identificador` gets a simple UNIQUE constraint instead of the
--     composite UNIQUE (organization_id, identificador) Avante uses.
--
-- NOT applied automatically — review and run manually against the PCBR
-- database when ready.
-- =====================================================================

CREATE TABLE public.config_campos_clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre_campo text NOT NULL,
  identificador text NOT NULL,
  categoria text NOT NULL,
  tipo text DEFAULT 'text'::text,
  requerido boolean DEFAULT false,
  opciones jsonb,
  orden integer DEFAULT 0,
  activo boolean DEFAULT true,
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT config_campos_clientes_pkey PRIMARY KEY (id),
  CONSTRAINT config_campos_clientes_identificador_key UNIQUE (identificador),
  CONSTRAINT config_campos_clientes_identificador_chk CHECK (identificador ~ '^[a-z0-9_]+$')
);

ALTER TABLE public.config_campos_clientes ENABLE ROW LEVEL SECURITY;

-- Same simple pattern as every other table in 001_schema.sql: authenticated
-- users get full access, no organization-based filtering (single-tenant app).
CREATE POLICY config_campos_clientes_allow_authenticated
  ON public.config_campos_clientes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
