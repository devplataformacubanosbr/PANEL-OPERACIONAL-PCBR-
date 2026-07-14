-- DEPRECADO 2026-07-11 — este script deja el bucket whatsapp_media público
-- (public: true) y con lectura/escritura abiertas sin ningún filtro de
-- organización. La configuración real y vigente en producción está en
-- supabase/migrations/20260711143340_storage_rls_fixes.sql, que pone el
-- bucket en privado y restringe SELECT a usuarios autenticados. NO
-- reejecutar este archivo: volvería a abrir la lectura pública de fotos y
-- audios de WhatsApp de todos los tenants. Ver auditoría 2026-07-11.

-- 1. Crear el bucket si no existe (normalmente debes hacerlo desde el panel de Supabase si falla este insert)
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp_media', 'whatsapp_media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Permitir lectura pública a cualquier usuario
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp_media');

-- 3. Permitir subida de archivos
DROP POLICY IF EXISTS "Allow Insert" ON storage.objects;
CREATE POLICY "Allow Insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp_media');
