-- 008_whatsapp_config_and_triggers.sql
-- Create WhatsApp and Bot configuration tables per tenant

-- 1. Table for WhatsApp Integrations
CREATE TABLE IF NOT EXISTS public.integraciones_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  proveedor TEXT NOT NULL DEFAULT 'evolution_api',  -- 'evolution_api', 'cloud_api'
  api_url TEXT NOT NULL,           
  api_key TEXT NOT NULL,           
  instancia TEXT NOT NULL,         
  numero_whatsapp TEXT,            
  activo BOOLEAN DEFAULT true,
  webhook_secret TEXT,             
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- RLS for integraciones_whatsapp
ALTER TABLE public.integraciones_whatsapp ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON public.integraciones_whatsapp
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- 2. Table for Bot Configuration
CREATE TABLE IF NOT EXISTS public.configuracion_bot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  bot_activo BOOLEAN DEFAULT true,
  horario_inicio TIME DEFAULT '09:00',
  horario_fin TIME DEFAULT '18:00',
  dias_laborales TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  zona_horaria TEXT DEFAULT 'America/Sao_Paulo',
  template_respuesta TEXT DEFAULT 'Hola {nombre}, en breve el equipo de {org} se pondrá en contacto.',
  template_fuera_horario TEXT DEFAULT 'Nuestro horario de atención es de {inicio} a {fin}.',
  umbral_spam INTEGER DEFAULT 3,
  ventana_spam_minutos INTEGER DEFAULT 60,
  cooldown_respuesta_segundos INTEGER DEFAULT 60,
  prompt_ai TEXT,                  
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- RLS for configuracion_bot
ALTER TABLE public.configuracion_bot ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON public.configuracion_bot
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- 3. Universal Trigger for organization_id
CREATE OR REPLACE FUNCTION public.auto_set_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := (
      SELECT organization_id FROM public.perfiles 
      WHERE id = auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to tables that have organization_id
-- We only apply this to tables where records are commonly inserted from the frontend

DROP TRIGGER IF EXISTS trg_set_org_clientes ON public.clientes;
CREATE TRIGGER trg_set_org_clientes
  BEFORE INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_entradas ON public.entradas;
CREATE TRIGGER trg_set_org_entradas
  BEFORE INSERT ON public.entradas
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_mensajes ON public.mensajes;
CREATE TRIGGER trg_set_org_mensajes
  BEFORE INSERT ON public.mensajes
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

DROP TRIGGER IF EXISTS trg_set_org_documentos_operacionales ON public.documentos_operacionales;
CREATE TRIGGER trg_set_org_documentos_operacionales
  BEFORE INSERT ON public.documentos_operacionales
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_organization_id();

-- Seed initial config for the default org (optional, assuming ID 0000...)
INSERT INTO public.configuracion_bot (organization_id, bot_activo, template_respuesta)
VALUES ('00000000-0000-0000-0000-000000000000', true, 'Hola {nombre}, en breve nos pondremos en contacto.')
ON CONFLICT (organization_id) DO NOTHING;
