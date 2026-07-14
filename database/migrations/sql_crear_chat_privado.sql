-- ==========================================
-- SCRIPT: chat_privado
-- Creación de tabla para chat 1 a 1 entre miembros
-- ==========================================

CREATE TABLE IF NOT EXISTS public.chat_privado (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    emisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receptor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mensaje TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configuración de Row Level Security (RLS)
ALTER TABLE public.chat_privado ENABLE ROW LEVEL SECURITY;

-- Política de lectura: Los usuarios pueden ver los mensajes donde son emisores o receptores
CREATE POLICY "Los usuarios pueden ver sus propios mensajes" 
    ON public.chat_privado FOR SELECT 
    USING (auth.uid() = emisor_id OR auth.uid() = receptor_id);

-- Política de inserción: Los usuarios pueden enviar mensajes donde ellos sean el emisor
CREATE POLICY "Los usuarios pueden enviar mensajes" 
    ON public.chat_privado FOR INSERT 
    WITH CHECK (auth.uid() = emisor_id);

-- Otorga permisos básicos
GRANT ALL ON TABLE public.chat_privado TO authenticated;
GRANT ALL ON TABLE public.chat_privado TO service_role;
