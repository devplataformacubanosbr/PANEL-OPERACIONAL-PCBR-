-- 025_tramites_catalogo_costo.sql
-- Agrega costo al catálogo de trámites.

ALTER TABLE public.tramites_catalogo
ADD COLUMN IF NOT EXISTS costo numeric(12,2) DEFAULT 0;
