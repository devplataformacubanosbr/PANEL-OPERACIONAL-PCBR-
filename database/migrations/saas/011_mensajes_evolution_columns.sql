-- 011_mensajes_evolution_columns.sql
-- La tabla mensajes tenía solo el esquema legacy (remitente, telefono,
-- media_*) del flujo n8n/Kommo. Las edge functions de Evolution API
-- (enviar-whatsapp, webhook-whatsapp-in) ya insertan tipo/proveedor/leido/
-- operario, que no existían — toda inserción fallaba en silencio.

ALTER TABLE public.mensajes
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS proveedor TEXT,
  ADD COLUMN IF NOT EXISTS leido BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS operario TEXT;
