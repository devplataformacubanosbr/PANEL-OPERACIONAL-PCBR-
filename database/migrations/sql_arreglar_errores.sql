-- 1. Quitar la restricción estricta de palabras en las relaciones
ALTER TABLE public.relaciones_clientes 
DROP CONSTRAINT IF EXISTS relaciones_clientes_tipo_relacion_check;

-- 2. Asegurarnos de que exista la columna remitente para el chat de WhatsApp
ALTER TABLE public.notas_kommo 
ADD COLUMN IF NOT EXISTS remitente text DEFAULT 'incoming';
