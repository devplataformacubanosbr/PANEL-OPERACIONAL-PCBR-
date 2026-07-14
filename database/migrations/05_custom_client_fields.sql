-- 1. Create the configuration table for custom fields
CREATE TABLE IF NOT EXISTS public.config_campos_clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT get_user_org_id(),
  nombre_campo text NOT NULL,
  identificador text NOT NULL, -- e.g. 'rnm', 'policia_federal'
  categoria text NOT NULL,
  tipo text DEFAULT 'text',
  requerido boolean DEFAULT false,
  opciones jsonb,
  orden integer DEFAULT 0,
  activo boolean DEFAULT true,
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT config_campos_clientes_pkey PRIMARY KEY (id),
  CONSTRAINT config_campos_clientes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id),
  CONSTRAINT config_campos_clientes_org_identificador_key UNIQUE (organization_id, identificador)
);

-- Enable RLS
ALTER TABLE public.config_campos_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's config_campos_clientes"
ON public.config_campos_clientes FOR SELECT
USING (organization_id = get_user_org_id());

CREATE POLICY "Users can insert their organization's config_campos_clientes"
ON public.config_campos_clientes FOR INSERT
WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "Users can update their organization's config_campos_clientes"
ON public.config_campos_clientes FOR UPDATE
USING (organization_id = get_user_org_id());

CREATE POLICY "Users can delete their organization's config_campos_clientes"
ON public.config_campos_clientes FOR DELETE
USING (organization_id = get_user_org_id());


-- 2. Add the JSONB column to clientes table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'campos_personalizados') THEN
        ALTER TABLE public.clientes ADD COLUMN campos_personalizados jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;


-- 3. Populate default config for existing specific fields, for EVERY organization.
-- (Previously this only seeded the first organization returned by an unordered
-- LIMIT 1, which left every other tenant in this multi-org SaaS with no default
-- custom-field catalog at all. Loop over all organizations instead.)
DO $$
DECLARE
    v_org_id uuid;
BEGIN
    FOR v_org_id IN SELECT id FROM public.organizaciones LOOP
        -- Insert RNM
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'RNM', 'rnm', 'Documentos de Identidad', 'text', 1)
        ON CONFLICT (organization_id, identificador) DO NOTHING;

        -- Insert Protocolo de Refugio
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'Protocolo de Refugio', 'numero_refugio', 'Documentos de Identidad', 'text', 2)
        ON CONFLICT (organization_id, identificador) DO NOTHING;

        -- Insert Fecha Vencimiento Refugio
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'Fecha Vencimiento Refugio', 'fecha_vencimiento_refugio', 'Documentos de Identidad', 'date', 3)
        ON CONFLICT (organization_id, identificador) DO NOTHING;

        -- Insert Pasaporte
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'Pasaporte', 'numero_pasaporte', 'Documentos de Identidad', 'text', 4)
        ON CONFLICT (organization_id, identificador) DO NOTHING;

        -- Insert Fecha Emisión Pasaporte
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'Fecha Emisión Pasaporte', 'fecha_emision_pasaporte', 'Documentos de Identidad', 'date', 5)
        ON CONFLICT (organization_id, identificador) DO NOTHING;

        -- Insert Fecha Vencimiento Pasaporte
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'Fecha Vencimiento Pasaporte', 'fecha_vencimiento_pasaporte', 'Documentos de Identidad', 'date', 6)
        ON CONFLICT (organization_id, identificador) DO NOTHING;

        -- Insert Carnet Identidad
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'Carnet de Identidad', 'carnet_identidad', 'Documentos de Identidad', 'text', 7)
        ON CONFLICT (organization_id, identificador) DO NOTHING;

        -- Insert Policía Federal
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'Policía Federal', 'policia_federal', 'Informaciones Personales', 'text', 8)
        ON CONFLICT (organization_id, identificador) DO NOTHING;

        -- Insert Entrada a Brasil
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'Entrada a Brasil', 'fecha_entrada_brasil', 'Informaciones Personales', 'date', 9)
        ON CONFLICT (organization_id, identificador) DO NOTHING;

        -- Insert Lugar Entrada
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'Lugar Entrada', 'lugar_entrada_brasil', 'Informaciones Personales', 'text', 10)
        ON CONFLICT (organization_id, identificador) DO NOTHING;

        -- Insert Nombre Madre
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'Nombre Madre', 'nombre_madre', 'Datos Familiares', 'text', 11)
        ON CONFLICT (organization_id, identificador) DO NOTHING;

        -- Insert Nombre Padre
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'Nombre Padre', 'nombre_padre', 'Datos Familiares', 'text', 12)
        ON CONFLICT (organization_id, identificador) DO NOTHING;

        -- Insert Tramite
        INSERT INTO public.config_campos_clientes (organization_id, nombre_campo, identificador, categoria, tipo, orden)
        VALUES (v_org_id, 'Trámite Solicitado', 'tramite', 'Informaciones Personales', 'text', 13)
        ON CONFLICT (organization_id, identificador) DO NOTHING;
    END LOOP;
END $$;


-- 4. Migrate data from fixed columns to JSONB safely
UPDATE public.clientes 
SET campos_personalizados = jsonb_build_object(
    'rnm', COALESCE(rnm, ''),
    'numero_refugio', COALESCE(numero_refugio, ''),
    'fecha_vencimiento_refugio', COALESCE(CAST(fecha_vencimiento_refugio AS TEXT), ''),
    'numero_pasaporte', COALESCE(numero_pasaporte, ''),
    'fecha_emision_pasaporte', COALESCE(CAST(fecha_emision_pasaporte AS TEXT), ''),
    'fecha_vencimiento_pasaporte', COALESCE(CAST(fecha_vencimiento_pasaporte AS TEXT), ''),
    'carnet_identidad', COALESCE(carnet_identidad, ''),
    'policia_federal', COALESCE(policia_federal, ''),
    'fecha_entrada_brasil', COALESCE(CAST(fecha_entrada_brasil AS TEXT), ''),
    'lugar_entrada_brasil', COALESCE(lugar_entrada_brasil, ''),
    'nombre_madre', COALESCE(nombre_madre, ''),
    'nombre_padre', COALESCE(nombre_padre, ''),
    'tramite', COALESCE(tramite, '')
) 
WHERE campos_personalizados = '{}'::jsonb OR campos_personalizados IS NULL;
