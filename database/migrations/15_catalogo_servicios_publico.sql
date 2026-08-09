-- ===========================================================================
-- Migración 15: catálogo de servicios visible públicamente
-- ===========================================================================
-- tramites_catalogo solo daba RLS a `authenticated`, pero se lee tanto desde
-- el portal logueado (ServiciosTab.jsx) como desde la vista pública sin login
-- (PublicCatalogView.jsx) -- ambas corren como `anon`. A diferencia de
-- entradas/notas/documentos (datos privados de cada cliente, resueltos con
-- funciones SECURITY DEFINER en las migraciones 12/14), el catálogo de
-- servicios activos es información pública por diseño, así que acá alcanza
-- con una policy de lectura para `anon` en vez de una función.
-- ===========================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tramites_catalogo' AND policyname = 'tramites_catalogo_public_read') THEN
        CREATE POLICY tramites_catalogo_public_read
          ON public.tramites_catalogo FOR SELECT TO anon USING (activo = true);
    END IF;
END $$;
