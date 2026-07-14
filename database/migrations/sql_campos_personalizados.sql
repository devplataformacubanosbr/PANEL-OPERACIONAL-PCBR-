-- 1. Agregar columna de configuración de campos al catálogo de trámites
ALTER TABLE public.tramites_catalogo 
ADD COLUMN IF NOT EXISTS campos_config JSONB DEFAULT '[]'::jsonb;

-- 2. Agregar columna de datos llenados a las entradas (trámites del cliente)
ALTER TABLE public.entradas 
ADD COLUMN IF NOT EXISTS datos_personalizados JSONB DEFAULT '{}'::jsonb;

-- 3. Crear tabla categorias_datos_operacionales (solucionando el error 400)
CREATE TABLE IF NOT EXISTS public.categorias_datos_operacionales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  icono TEXT DEFAULT 'Folder',
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y permitir acceso total (para entorno interno)
ALTER TABLE public.categorias_datos_operacionales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permit_all_categorias" ON public.categorias_datos_operacionales;
CREATE POLICY "permit_all_categorias" 
  ON public.categorias_datos_operacionales 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
