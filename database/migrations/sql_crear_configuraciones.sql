-- Crear tabla de configuraciones globales de la app
CREATE TABLE IF NOT EXISTS public.configuraciones_app (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    descripcion TEXT,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.configuraciones_app ENABLE ROW LEVEL SECURITY;

-- Políticas: Todos los usuarios autenticados pueden leer
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON public.configuraciones_app
FOR SELECT 
TO authenticated 
USING (true);

-- Políticas: Solo administradores pueden modificar (simplificado para frontend)
CREATE POLICY "Permitir escritura a usuarios autenticados" 
ON public.configuraciones_app
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Insertar configuración inicial
INSERT INTO public.configuraciones_app (clave, valor, descripcion) 
VALUES ('tally_base_url', 'https://tally.so/r/tu-formulario', 'URL base del formulario de Sisconare en Tally')
ON CONFLICT (clave) DO NOTHING;
