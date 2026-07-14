-- 014_mensajes_metadata.sql
-- Las Edge Functions enviar-whatsapp/bot-engine/webhook-whatsapp-in fueron escritas (de forma
-- consistente entre las tres) asumiendo columnas `tipo`/`proveedor`/`leido`/`operario` en
-- `mensajes` que nunca llegaron a crearse ahí, por lo que el insert de cada mensaje
-- (entrante o saliente) fallaba en silencio y bot-engine nunca disparaba (su chequeo de
-- entrada `tipo === 'entrante'` siempre era falso). Se agregan de forma aditiva —
-- `remitente`/`telefono` se mantienen sin tocar, son las que ya lee ClientWhatsApp.jsx.

ALTER TABLE public.mensajes ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.mensajes ADD COLUMN IF NOT EXISTS proveedor text;
ALTER TABLE public.mensajes ADD COLUMN IF NOT EXISTS leido boolean DEFAULT true;
ALTER TABLE public.mensajes ADD COLUMN IF NOT EXISTS operario text;
