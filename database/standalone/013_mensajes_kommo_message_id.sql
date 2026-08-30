-- 013_mensajes_kommo_message_id.sql
-- Descubrimos con un payload real que Kommo manda los mensajes de chat
-- (WhatsApp) como evento `message[add]` (Chats API), NO como `leads[note][add]`
-- (webhook clásico de notas) que es lo que kommo-webhook escuchaba hasta ahora
-- — por eso nada se estaba guardando. El id de este evento es un UUID
-- (ej. "dfae7426-577b-4536-a94d-ae375815f501"), no encaja en `kommo_note_id`
-- (bigint, pensado para el id numérico de la Notes API clásica).

ALTER TABLE public.mensajes ADD COLUMN IF NOT EXISTS kommo_message_id text;
CREATE INDEX IF NOT EXISTS mensajes_kommo_message_id_idx ON public.mensajes (kommo_message_id) WHERE kommo_message_id IS NOT NULL;
