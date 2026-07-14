-- Auditoría 2026-07-11 — remediación de storage.objects.
-- Ejecutado vía `supabase db push` porque `supabase db query` (Management
-- API) no tiene permisos de owner sobre storage.objects.

-- 1) documentos_operacionales: re-aplicar con el nombre de función real
-- (get_user_org_id, no get_my_organization_id). Ver
-- saas/05_configure_storage_privacy_and_rls.sql.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos_operacionales', 'documentos_operacionales', false)
ON CONFLICT (id) DO UPDATE SET public = false;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Storage organization isolation" ON storage.objects;
CREATE POLICY "Storage organization isolation" ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'documentos_operacionales'
  AND split_part(name, '/', 1) = public.get_user_org_id()::text
)
WITH CHECK (
  bucket_id = 'documentos_operacionales'
  AND split_part(name, '/', 1) = public.get_user_org_id()::text
);

-- 2) whatsapp_media: mitigación elegida por el usuario — privado + lectura
-- solo autenticada (sin prefijo de organización todavía, porque los objetos
-- ya subidos no tienen prefijo y aislar por org los dejaría inaccesibles
-- hasta un backfill aparte). Esto cierra el hueco crítico real (lectura
-- pública/no autenticada de medios de WhatsApp de cualquier tenant).
--
-- El INSERT se deja abierto a "public": verificado en
-- workflows/n8n/workflow_n8n_v18_recibir_media.json (nodo "Subir a Supabase
-- Storage") que la ingesta de medios entrantes autentica con la ANON key
-- (no service_role) y sin sesión de usuario — exigir TO authenticated aquí
-- rompería la recepción de WhatsApp. La lectura pública era el problema real
-- (cualquiera en internet podía ver fotos/audios de clientes de cualquier
-- tenant); la escritura anónima es un problema menor (spam de storage, no
-- fuga de datos) que queda pendiente para cuando n8n autentique distinto.
UPDATE storage.buckets SET public = false WHERE id = 'whatsapp_media';

DROP POLICY IF EXISTS "Public Access" ON storage.objects;

DROP POLICY IF EXISTS "whatsapp_media_authenticated_select" ON storage.objects;
CREATE POLICY "whatsapp_media_authenticated_select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'whatsapp_media');

DROP POLICY IF EXISTS "Allow Insert" ON storage.objects;
CREATE POLICY "Allow Insert" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'whatsapp_media');
