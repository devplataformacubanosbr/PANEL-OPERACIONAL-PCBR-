-- ==============================================================================
-- Modificación: Función de Equipo de Trabajo, Historial y Chat
-- Propósito: Manejo de usuarios, auditoría global y chat interno.
-- ==============================================================================
--
-- DEPRECADO PARCIALMENTE 2026-07-11 — este archivo es anterior a la
-- multi-tenencia y tenía dos problemas si se re-ejecuta hoy:
--
-- 1. Sus policies RLS abrían perfiles/historial_clientes/chat_equipo a
--    "todos los autenticados" (USING(true)), sin filtro de organización.
--    Las tres tablas ya están en la lista de 27 de
--    saas/03_create_rls_helpers_and_policies.sql, que aplica
--    tenant_isolation_policy real — se removieron las policies de aquí.
--
-- 2. Recreaba handle_new_user() en una versión SIN organization_id — mucho
--    más vieja que saas/04_recreate_onboarding_trigger.sql. Re-ejecutar esto
--    HOY pisaría el trigger real de onboarding y dejaría de asignar
--    organización a los usuarios nuevos. Se removió esa función/trigger de
--    aquí; la versión autoritativa vive en
--    saas/04_recreate_onboarding_trigger.sql.
--
-- Se conservan solo las CREATE TABLE (siguen siendo válidas para provisionar
-- un entorno desde cero) y el bloque de Realtime (inofensivo). Ver auditoría
-- 2026-07-11.

-- 1. Tabla de Perfiles
-- Se vincula a auth.users para guardar información pública de cada miembro.
CREATE TABLE IF NOT EXISTS public.perfiles (
    id uuid references auth.users on delete cascade not null primary key,
    nombre text not null default 'Usuario',
    email text,
    rol text default 'miembro', -- 'admin' o 'miembro'
    creado_en timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: habilitar aquí es seguro (no otorga acceso por sí solo); las policies
-- reales las aplica saas/03_create_rls_helpers_and_policies.sql. El trigger
-- de creación de perfil al registrarse vive en
-- saas/04_recreate_onboarding_trigger.sql (con soporte de organization_id).
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 2. Tabla de Historial Global por Cliente (Auditoría)
CREATE TABLE IF NOT EXISTS public.historial_clientes (
    id uuid default gen_random_uuid() primary key,
    cliente_id bigint references public.clientes(id) on delete cascade not null,
    usuario_id uuid references public.perfiles(id) on delete set null,
    accion text not null, -- Ej. "MODIFICACION", "CREACION", "ELIMINACION"
    descripcion text not null, -- Ej. "Cambió el nombre a Juan"
    creado_en timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.historial_clientes ENABLE ROW LEVEL SECURITY;

-- 3. Tabla de Chat de Equipo
CREATE TABLE IF NOT EXISTS public.chat_equipo (
    id uuid default gen_random_uuid() primary key,
    usuario_id uuid references public.perfiles(id) on delete cascade not null,
    mensaje text not null,
    creado_en timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.chat_equipo ENABLE ROW LEVEL SECURITY;

-- Habilitar Realtime para el chat de equipo y el historial
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_equipo'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_equipo;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'historial_clientes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.historial_clientes;
  END IF;
END $$;
