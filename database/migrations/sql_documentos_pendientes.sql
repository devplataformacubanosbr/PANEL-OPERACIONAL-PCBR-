-- Script para ejecutar en el SQL Editor de Supabase

-- 1. Crear la tabla de documentos pendientes
CREATE TABLE IF NOT EXISTS public.documentos_pendientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id bigint REFERENCES public.clientes(id) ON DELETE CASCADE,
  url_archivo text NOT NULL,
  nombre_archivo text NOT NULL,
  origen text DEFAULT 'kommo',
  fecha_recepcion timestamp with time zone DEFAULT now(),
  verificado boolean DEFAULT false
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.documentos_pendientes ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acceso (Permitir lectura y escritura a usuarios autenticados)
CREATE POLICY "Permitir select a autenticados" ON public.documentos_pendientes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir insert a autenticados" ON public.documentos_pendientes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir update a autenticados" ON public.documentos_pendientes
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir delete a autenticados" ON public.documentos_pendientes
  FOR DELETE USING (auth.role() = 'authenticated');
