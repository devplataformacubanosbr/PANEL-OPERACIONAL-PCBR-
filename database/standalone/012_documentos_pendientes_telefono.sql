-- 012_documentos_pendientes_telefono.sql
-- `mensajes` ya guarda el teléfono de origen además de cliente_id.
-- `documentos_pendientes` sólo guardaba cliente_id — se agrega `telefono`
-- para que el documento quede identificado por el mismo teléfono que decidió
-- a qué cliente ("usuario principal") se le asignó (ver kommo-webhook), y no
-- dependa únicamente de esa resolución para saber de dónde vino.

ALTER TABLE public.documentos_pendientes ADD COLUMN IF NOT EXISTS telefono text;
CREATE INDEX IF NOT EXISTS documentos_pendientes_telefono_idx ON public.documentos_pendientes (telefono);
