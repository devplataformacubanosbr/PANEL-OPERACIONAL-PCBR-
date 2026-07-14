-- ==============================================================================
-- Tabla: notas_tramite
-- Propósito: Almacenar el historial de notas/actualizaciones de cada trámite.
-- Ejecutar en Supabase → SQL Editor
-- ==============================================================================
--
-- RLS DEPRECADA 2026-07-11 — la sección de policies de este archivo abría la
-- tabla a "anon, authenticated" con USING(true), sin filtro de organización.
-- notas_tramite ya está en la lista de 27 tablas de
-- saas/03_create_rls_helpers_and_policies.sql, que aplica
-- tenant_isolation_policy real. La CREATE TABLE de abajo sigue siendo válida
-- (útil para provisionar un entorno desde cero); solo se removieron las
-- policies USING(true). Ver auditoría 2026-07-11.

CREATE TABLE IF NOT EXISTS public.notas_tramite (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entrada_id uuid NOT NULL REFERENCES public.entradas(id) ON DELETE CASCADE,
  texto text NOT NULL,
  creado_en timestamptz DEFAULT now(),
  creado_por text DEFAULT 'operador'
);

-- Índice para consultas por trámite
CREATE INDEX IF NOT EXISTS idx_notas_tramite_entrada_id ON public.notas_tramite(entrada_id);

-- RLS: habilitar aquí es seguro (no otorga acceso por sí solo); las policies
-- reales las aplica saas/03_create_rls_helpers_and_policies.sql.
ALTER TABLE public.notas_tramite ENABLE ROW LEVEL SECURITY;
