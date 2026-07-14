-- ==============================================================================
-- Tabla: biblioteca_multimedia
-- Propósito: Almacenar audios y videos pregrabados para el panel de entrega
-- de documentos (WhatsApp).
-- ==============================================================================
--
-- RLS DEPRECADA 2026-07-11 — la sección de policies de este archivo abría la
-- tabla a cualquiera (sin cláusula TO) con USING(true)/WITH CHECK(true). El
-- comentario original decía "lista global", pero saas/02 y saas/03 ya la
-- convirtieron en una tabla con organization_id + tenant_isolation_policy
-- (está en la lista de 27 tablas), así que hoy es per-organización, no
-- global. La CREATE TABLE de abajo sigue siendo válida; solo se removieron
-- las policies USING(true). Ver auditoría 2026-07-11.

CREATE TABLE IF NOT EXISTS public.biblioteca_multimedia (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    nombre text NOT NULL,
    tipo_contenido text NOT NULL, -- ej: 'audio/mpeg', 'video/mp4'
    url_archivo text NOT NULL,
    tamano integer, -- tamaño en bytes
    creado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT biblioteca_multimedia_pkey PRIMARY KEY (id)
);

-- RLS: habilitar aquí es seguro (no otorga acceso por sí solo); las policies
-- reales las aplica saas/03_create_rls_helpers_and_policies.sql.
ALTER TABLE public.biblioteca_multimedia ENABLE ROW LEVEL SECURITY;
