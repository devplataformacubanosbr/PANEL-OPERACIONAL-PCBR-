-- Migración 027: Workflows de IA (Bot Builder)

-- Esta tabla almacena los flujos (mini-workflows) completos
CREATE TABLE IF NOT EXISTS public.ia_workflows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Nodos del lienzo (id, type, position, data)
    edges JSONB NOT NULL DEFAULT '[]'::jsonb, -- Conexiones (id, source, target)
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas de Seguridad (RLS)
ALTER TABLE public.ia_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver los workflows de su organización"
    ON public.ia_workflows FOR SELECT
    USING (organization_id = public.get_user_org_id());

CREATE POLICY "Los usuarios pueden insertar workflows en su organización"
    ON public.ia_workflows FOR INSERT
    WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Los usuarios pueden actualizar los workflows de su organización"
    ON public.ia_workflows FOR UPDATE
    USING (organization_id = public.get_user_org_id());

CREATE POLICY "Los usuarios pueden eliminar los workflows de su organización"
    ON public.ia_workflows FOR DELETE
    USING (organization_id = public.get_user_org_id());

-- Trigger para actualizar "actualizado_en"
-- (update_modified_column no existe en ningún otro archivo del repo, se define
-- aquí mismo en vez de asumir que ya existe en la base de datos en vivo)
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ia_workflows_updated_at
    BEFORE UPDATE ON public.ia_workflows
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_column();
