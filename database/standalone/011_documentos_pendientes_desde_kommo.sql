-- 011_documentos_pendientes_desde_kommo.sql
-- Hasta ahora un archivo que un cliente mandaba por WhatsApp/Kommo se guardaba
-- en `mensajes` (para el chat con IA) pero nunca aparecía en la pestaña
-- "Documentos" del cliente — esa pestaña sólo lee documentos_operacionales
-- (ver src/services/storageService.js:getDocuments). documentos_pendientes ya
-- existía (con origen default 'kommo') pero nada la alimentaba ni la leía.

-- Falta tipo_contenido para poder mostrar miniatura si es imagen, igual que
-- documentos_operacionales.
ALTER TABLE public.documentos_pendientes ADD COLUMN IF NOT EXISTS tipo_contenido text;

-- Dedup robusto para no re-descargar/re-subir el mismo adjunto de Kommo en
-- cada webhook de nota nueva (antes se comparaba por texto, lo que no evitaba
-- volver a bajar el archivo antes de poder compararlo).
ALTER TABLE public.mensajes ADD COLUMN IF NOT EXISTS kommo_note_id bigint;
CREATE INDEX IF NOT EXISTS mensajes_kommo_note_id_idx ON public.mensajes (kommo_note_id) WHERE kommo_note_id IS NOT NULL;
