-- ==============================================================================
-- Tabla: operarios
-- Propósito: Almacenar la lista de operadores / equipo interno.
-- Ejecutar en Supabase → SQL Editor
-- ==============================================================================
--
-- RLS DEPRECADA 2026-07-11 — la sección de policies de este archivo abría la
-- tabla a "anon, authenticated" con USING(true), sin filtro de organización.
-- operarios ya está en la lista de 27 tablas de
-- saas/03_create_rls_helpers_and_policies.sql, que aplica
-- tenant_isolation_policy real. La CREATE TABLE/seed de abajo sigue siendo
-- válida; solo se removieron las policies USING(true). Ver auditoría
-- 2026-07-11.
--
-- Nota: el INSERT de nombres fijos de abajo (MARCOS, SOPHIA...) es un seed de
-- un solo tenant específico, no genérico para un SaaS multi-org — no
-- re-ejecutar contra una organización nueva sin revisarlo.

CREATE TABLE IF NOT EXISTS public.operarios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL UNIQUE,
  iniciales text,
  activo boolean DEFAULT true,
  creado_en timestamptz DEFAULT now()
);

-- RLS: habilitar aquí es seguro (no otorga acceso por sí solo); las policies
-- reales las aplica saas/03_create_rls_helpers_and_policies.sql.
ALTER TABLE public.operarios ENABLE ROW LEVEL SECURITY;
