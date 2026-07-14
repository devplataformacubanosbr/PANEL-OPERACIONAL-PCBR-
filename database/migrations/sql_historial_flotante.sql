-- ==============================================================================
-- Modificación: Historial Flotante
-- Propósito: Permitir guardar mensajes de prospectos no registrados.
-- ==============================================================================

-- 1. Agregar columna telefono a notas_kommo para guardar el remitente original
ALTER TABLE public.notas_kommo 
ADD COLUMN IF NOT EXISTS telefono text;

-- 2. Asegurarnos de que cliente_id permita valores nulos (por si estaba como NOT NULL)
ALTER TABLE public.notas_kommo 
ALTER COLUMN cliente_id DROP NOT NULL;
