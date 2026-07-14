-- Create table planes
CREATE TABLE IF NOT EXISTS public.planes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  precio NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  limite_usuarios INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create table suscripciones
CREATE TABLE IF NOT EXISTS public.suscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.planes(id),
  estado VARCHAR(50) NOT NULL DEFAULT 'active',
  fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  fecha_fin TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create table limites_uso
CREATE TABLE IF NOT EXISTS public.limites_uso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  recurso VARCHAR(255) NOT NULL,
  uso_actual INTEGER NOT NULL DEFAULT 0,
  limite_maximo INTEGER NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on all 3 tables
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.limites_uso ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS select_planes ON public.planes;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.suscripciones;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.limites_uso;

-- Create policies
CREATE POLICY select_planes ON public.planes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY tenant_isolation_policy ON public.suscripciones
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY tenant_isolation_policy ON public.limites_uso
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());
