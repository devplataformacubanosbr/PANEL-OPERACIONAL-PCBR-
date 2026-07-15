CREATE TABLE IF NOT EXISTS public.email_plantillas (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre text NOT NULL,
    asunto text NOT NULL,
    cuerpo text NOT NULL,
    creado_en timestamp with time zone DEFAULT now()
);

ALTER TABLE public.email_plantillas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total a email_plantillas" ON public.email_plantillas FOR ALL USING (true);
