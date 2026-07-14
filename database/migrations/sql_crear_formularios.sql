-- Crear tabla de formularios de clientes
CREATE TABLE IF NOT EXISTS public.formularios_clientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    entrada_id BIGINT REFERENCES public.entradas(id) ON DELETE SET NULL,
    tipo_formulario TEXT NOT NULL,
    estado TEXT DEFAULT 'Completado',
    respuestas JSONB NOT NULL DEFAULT '{}'::jsonb,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.formularios_clientes ENABLE ROW LEVEL SECURITY;

-- Crear políticas básicas para permitir lectura/escritura (asumiendo que tu frontend tiene acceso autenticado)
CREATE POLICY "Permitir todo a usuarios autenticados en formularios_clientes" 
ON public.formularios_clientes
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Para n8n usando la Service Role Key, podrá hacer bypass al RLS.
-- Si prefieres que el webhook (anon) pueda insertar, usa la siguiente política (descomentar si la necesitas):
/*
CREATE POLICY "Permitir insert público" 
ON public.formularios_clientes
FOR INSERT 
TO anon 
WITH CHECK (true);
*/
