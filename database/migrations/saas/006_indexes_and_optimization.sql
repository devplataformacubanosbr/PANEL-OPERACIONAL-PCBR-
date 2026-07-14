-- 1. Create B-tree indexes on organization_id for all 27 business tables
CREATE INDEX IF NOT EXISTS idx_ai_chats_organization_id ON public.ai_chats(organization_id);
CREATE INDEX IF NOT EXISTS idx_biblioteca_multimedia_organization_id ON public.biblioteca_multimedia(organization_id);
CREATE INDEX IF NOT EXISTS idx_campos_datos_operacionales_organization_id ON public.campos_datos_operacionales(organization_id);
CREATE INDEX IF NOT EXISTS idx_categorias_datos_operacionales_organization_id ON public.categorias_datos_operacionales(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_equipo_organization_id ON public.chat_equipo(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_privado_organization_id ON public.chat_privado(organization_id);
CREATE INDEX IF NOT EXISTS idx_cliente_datos_operacionales_organization_id ON public.cliente_datos_operacionales(organization_id);
CREATE INDEX IF NOT EXISTS idx_clientes_organization_id ON public.clientes(organization_id);
CREATE INDEX IF NOT EXISTS idx_configuraciones_app_organization_id ON public.configuraciones_app(organization_id);
CREATE INDEX IF NOT EXISTS idx_documentos_operacionales_organization_id ON public.documentos_operacionales(organization_id);
CREATE INDEX IF NOT EXISTS idx_documentos_pendientes_organization_id ON public.documentos_pendientes(organization_id);
CREATE INDEX IF NOT EXISTS idx_entradas_organization_id ON public.entradas(organization_id);

CREATE INDEX IF NOT EXISTS idx_formularios_clientes_organization_id ON public.formularios_clientes(organization_id);
CREATE INDEX IF NOT EXISTS idx_historial_cambios_organization_id ON public.historial_cambios(organization_id);
CREATE INDEX IF NOT EXISTS idx_historial_clientes_organization_id ON public.historial_clientes(organization_id);
CREATE INDEX IF NOT EXISTS idx_notas_kommo_organization_id ON public.notas_kommo(organization_id);
CREATE INDEX IF NOT EXISTS idx_notas_tramite_organization_id ON public.notas_tramite(organization_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_equipo_organization_id ON public.notificaciones_equipo(organization_id);
CREATE INDEX IF NOT EXISTS idx_operarios_organization_id ON public.operarios(organization_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_organization_id ON public.perfiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_plantillas_documentos_organization_id ON public.plantillas_documentos(organization_id);
CREATE INDEX IF NOT EXISTS idx_relaciones_clientes_organization_id ON public.relaciones_clientes(organization_id);
CREATE INDEX IF NOT EXISTS idx_salidas_organization_id ON public.salidas(organization_id);
CREATE INDEX IF NOT EXISTS idx_tramites_catalogo_organization_id ON public.tramites_catalogo(organization_id);
CREATE INDEX IF NOT EXISTS idx_tramites_categorias_organization_id ON public.tramites_categorias(organization_id);
CREATE INDEX IF NOT EXISTS idx_tramites_precios_organization_id ON public.tramites_precios(organization_id);

-- 2. Define public.get_user_org_id()
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 3. Drop the old policies on all 27 tables (which were using get_my_organization_id()) and create new tenant_isolation_policy on all 27 tables using public.get_user_org_id()
-- Table 1: ai_chats
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.ai_chats;
CREATE POLICY tenant_isolation_policy ON public.ai_chats
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 2: biblioteca_multimedia
ALTER TABLE public.biblioteca_multimedia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.biblioteca_multimedia;
CREATE POLICY tenant_isolation_policy ON public.biblioteca_multimedia
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 3: campos_datos_operacionales
ALTER TABLE public.campos_datos_operacionales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.campos_datos_operacionales;
CREATE POLICY tenant_isolation_policy ON public.campos_datos_operacionales
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 4: categorias_datos_operacionales
ALTER TABLE public.categorias_datos_operacionales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.categorias_datos_operacionales;
CREATE POLICY tenant_isolation_policy ON public.categorias_datos_operacionales
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 5: chat_equipo
ALTER TABLE public.chat_equipo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.chat_equipo;
CREATE POLICY tenant_isolation_policy ON public.chat_equipo
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 6: chat_privado
ALTER TABLE public.chat_privado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.chat_privado;
CREATE POLICY tenant_isolation_policy ON public.chat_privado
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 7: cliente_datos_operacionales
ALTER TABLE public.cliente_datos_operacionales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.cliente_datos_operacionales;
CREATE POLICY tenant_isolation_policy ON public.cliente_datos_operacionales
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 8: clientes
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.clientes;
CREATE POLICY tenant_isolation_policy ON public.clientes
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 9: configuraciones_app
ALTER TABLE public.configuraciones_app ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.configuraciones_app;
CREATE POLICY tenant_isolation_policy ON public.configuraciones_app
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 10: documentos_operacionales
ALTER TABLE public.documentos_operacionales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.documentos_operacionales;
CREATE POLICY tenant_isolation_policy ON public.documentos_operacionales
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 11: documentos_pendientes
ALTER TABLE public.documentos_pendientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.documentos_pendientes;
CREATE POLICY tenant_isolation_policy ON public.documentos_pendientes
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 12: entradas
ALTER TABLE public.entradas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.entradas;
CREATE POLICY tenant_isolation_policy ON public.entradas
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());



-- Table 14: formularios_clientes
ALTER TABLE public.formularios_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.formularios_clientes;
CREATE POLICY tenant_isolation_policy ON public.formularios_clientes
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 15: historial_cambios
ALTER TABLE public.historial_cambios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.historial_cambios;
CREATE POLICY tenant_isolation_policy ON public.historial_cambios
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 16: historial_clientes
ALTER TABLE public.historial_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.historial_clientes;
CREATE POLICY tenant_isolation_policy ON public.historial_clientes
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 17: notas_kommo
ALTER TABLE public.notas_kommo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.notas_kommo;
CREATE POLICY tenant_isolation_policy ON public.notas_kommo
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 18: notas_tramite
ALTER TABLE public.notas_tramite ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.notas_tramite;
CREATE POLICY tenant_isolation_policy ON public.notas_tramite
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 19: notificaciones_equipo
ALTER TABLE public.notificaciones_equipo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.notificaciones_equipo;
CREATE POLICY tenant_isolation_policy ON public.notificaciones_equipo
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 20: operarios
ALTER TABLE public.operarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.operarios;
CREATE POLICY tenant_isolation_policy ON public.operarios
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 21: perfiles
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.perfiles;
CREATE POLICY tenant_isolation_policy ON public.perfiles
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 22: plantillas_documentos
ALTER TABLE public.plantillas_documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.plantillas_documentos;
CREATE POLICY tenant_isolation_policy ON public.plantillas_documentos
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 23: relaciones_clientes
ALTER TABLE public.relaciones_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.relaciones_clientes;
CREATE POLICY tenant_isolation_policy ON public.relaciones_clientes
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 24: salidas
ALTER TABLE public.salidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.salidas;
CREATE POLICY tenant_isolation_policy ON public.salidas
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 25: tramites_catalogo
ALTER TABLE public.tramites_catalogo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.tramites_catalogo;
CREATE POLICY tenant_isolation_policy ON public.tramites_catalogo
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 26: tramites_categorias
ALTER TABLE public.tramites_categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.tramites_categorias;
CREATE POLICY tenant_isolation_policy ON public.tramites_categorias
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Table 27: tramites_precios
ALTER TABLE public.tramites_precios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.tramites_precios;
CREATE POLICY tenant_isolation_policy ON public.tramites_precios
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());
