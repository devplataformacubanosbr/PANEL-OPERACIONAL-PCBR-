-- Agregar columnas para manejar archivos multimedia
ALTER TABLE public.notas_kommo
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT,
ADD COLUMN IF NOT EXISTS media_name TEXT;
