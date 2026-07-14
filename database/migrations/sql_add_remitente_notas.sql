-- Añadir columna para saber quién envió el mensaje
ALTER TABLE public.notas_kommo 
ADD COLUMN IF NOT EXISTS remitente text DEFAULT 'incoming';
