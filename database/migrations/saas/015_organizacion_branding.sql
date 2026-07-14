-- 015_organizacion_branding.sql
-- White-label: logo y color de marca por organización (sección "Marca" en Configuración)

ALTER TABLE public.organizaciones
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS color_primario TEXT;

-- Permite que un admin/admin_plus actualice el logo/color de su propia organización.
-- No se toca ENABLE ROW LEVEL SECURITY aquí: si la tabla organizaciones no tiene RLS
-- habilitado en producción, esta policy queda inerte y no cambia el comportamiento actual;
-- si sí lo tiene, esta policy habilita puntualmente este UPDATE sin abrir nada más.
DROP POLICY IF EXISTS marca_update_policy ON public.organizaciones;
CREATE POLICY marca_update_policy ON public.organizaciones
  FOR UPDATE TO authenticated
  USING (id = public.get_user_org_id())
  WITH CHECK (
    id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol IN ('admin', 'admin_plus')
    )
  );

-- Bucket público dedicado a assets de marca (logo). A diferencia de
-- documentos_operacionales (privado), el logo debe poder mostrarse sin sesión
-- (pantalla de login, favicon, etc.), por eso es su propio bucket público.
INSERT INTO storage.buckets (id, name, public)
VALUES ('marca', 'marca', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Marca lectura publica" ON storage.objects;
CREATE POLICY "Marca lectura publica" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'marca');

DROP POLICY IF EXISTS "Marca escritura organizacion" ON storage.objects;
CREATE POLICY "Marca escritura organizacion" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marca' AND split_part(name, '/', 1) = public.get_user_org_id()::text);

DROP POLICY IF EXISTS "Marca actualizacion organizacion" ON storage.objects;
CREATE POLICY "Marca actualizacion organizacion" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'marca' AND split_part(name, '/', 1) = public.get_user_org_id()::text)
  WITH CHECK (bucket_id = 'marca' AND split_part(name, '/', 1) = public.get_user_org_id()::text);

DROP POLICY IF EXISTS "Marca eliminacion organizacion" ON storage.objects;
CREATE POLICY "Marca eliminacion organizacion" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'marca' AND split_part(name, '/', 1) = public.get_user_org_id()::text);
