-- 01_create_organizations.sql
-- Corregido: la tabla real en producción es `organizaciones` (español), no
-- `organizations`. La versión original de este archivo creaba una tabla
-- `organizations` que nunca existió en producción real — un typo que se
-- arrastró a `02`, `03`, `04` y parte de `007`. Ver auditoría 2026-07-11.
--
-- CREATE TABLE IF NOT EXISTS es un no-op si `organizaciones` ya existe (caso
-- real hoy), así que este archivo es seguro de re-ejecutar. Solo declara las
-- columnas mínimas — el resto (branding, onboarding_completado, etc.) se
-- añade incrementalmente en migraciones posteriores (015, 016, 019, 009...).
CREATE TABLE IF NOT EXISTS public.organizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed default fallback tenant (ya existe en producción; ON CONFLICT lo hace no-op ahí)
INSERT INTO public.organizaciones (id, nombre)
VALUES ('00000000-0000-0000-0000-000000000000', 'Agencia Inicial')
ON CONFLICT (id) DO NOTHING;
