-- 029. whatsapp_media: cerrar la lectura cross-tenant restante.
--
-- supabase/migrations/20260711143340_storage_rls_fixes.sql (auditoría
-- 2026-07-11) ya cerró el hueco crítico (lectura pública/no autenticada),
-- pero dejó whatsapp_media_authenticated_select sin filtro de organización
-- a propósito: los objetos ya subidos no tenían prefijo de org y aislar por
-- prefijo los habría dejado inaccesibles sin un backfill aparte.
--
-- REQUISITO PREVIO OBLIGATORIO: correr
-- database/scripts/backfill_whatsapp_media_org_prefix.mjs --apply contra
-- producción y confirmar 0 errores / 0 filas sin organization_id ANTES de
-- aplicar esta migración. Si se aplica antes del backfill, los tenants
-- pierden acceso a los medios ya subidos (siguen sin prefijo, no matchean
-- el filtro de abajo).
--
-- Mismo patrón que la policy de documentos_operacionales
-- (saas/05_configure_storage_privacy_and_rls.sql): el primer segmento del
-- path del objeto debe ser el organization_id del usuario autenticado.

DROP POLICY IF EXISTS "whatsapp_media_authenticated_select" ON storage.objects;
CREATE POLICY "whatsapp_media_authenticated_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'whatsapp_media'
  AND split_part(name, '/', 1) = public.get_user_org_id()::text
);

-- El INSERT queda abierto a "public" por ahora (n8n sube con la anon key,
-- sin sesión de usuario — ver nota en 20260711143340_storage_rls_fixes.sql).
-- Sigue pendiente actualizar el workflow n8n (workflow_n8n_v18_recibir_media.json,
-- nodo "Subir a Supabase Storage") para que el fileName que sube ya venga
-- prefijado con el organization_id resuelto (el mismo que usa
-- webhook-whatsapp-in), así los medios nuevos nacen ya aislados y este
-- backfill no hace falta repetirlo. Ese cambio de workflow requiere
-- validarse en el editor de n8n en vivo — no se tocó en esta migración.
