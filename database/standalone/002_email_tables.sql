-- Crear tabla de Plantillas de Email
CREATE TABLE IF NOT EXISTS public.email_plantillas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  nombre TEXT NOT NULL,
  asunto TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  destinatario TEXT,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para email_plantillas
ALTER TABLE public.email_plantillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_email_plantillas" ON public.email_plantillas
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    OR 
    current_setting('app.current_org_id', true) IS NULL
  );


-- Crear tabla de Mensajes de Email (Historial)
CREATE TABLE IF NOT EXISTS public.mensajes_email (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE,
  destinatario TEXT NOT NULL,
  asunto TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  estado TEXT DEFAULT 'enviado', -- 'enviado', 'fallido'
  leido BOOLEAN DEFAULT false,
  tiene_adjuntos BOOLEAN DEFAULT false,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para mensajes_email
ALTER TABLE public.mensajes_email ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_mensajes_email" ON public.mensajes_email
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
    OR 
    current_setting('app.current_org_id', true) IS NULL
  );

-- Trigger para heredar organization_id en mensajes_email
CREATE OR REPLACE FUNCTION public.set_organization_id_from_client_email()
RETURNS trigger AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL AND NEW.organization_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    SELECT organization_id INTO NEW.organization_id FROM public.clientes WHERE id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_org_mensajes_email BEFORE INSERT ON public.mensajes_email
FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_client_email();
