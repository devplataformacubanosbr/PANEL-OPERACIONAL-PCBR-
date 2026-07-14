-- Script para crear la tabla de Notas de Kommo
CREATE TABLE IF NOT EXISTS public.notas_kommo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id bigint REFERENCES public.clientes(id) ON DELETE CASCADE,
  texto text NOT NULL,
  fecha_recepcion timestamp with time zone DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.notas_kommo ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso para lectura y escritura a los usuarios autenticados
CREATE POLICY "Permitir select a autenticados" ON public.notas_kommo
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir insert a autenticados" ON public.notas_kommo
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir update a autenticados" ON public.notas_kommo
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir delete a autenticados" ON public.notas_kommo
  FOR DELETE USING (auth.role() = 'authenticated');
