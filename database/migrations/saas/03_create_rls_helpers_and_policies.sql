-- 3. Create RLS Helper and Tenant Isolation Policies
--
-- Corregido: la función helper real en producción es `public.get_user_org_id()`
-- (no `get_my_organization_id()`), y todas las policies debajo la referenciaban
-- mal. Este archivo YA NO (re)crea la función — get_user_org_id() ya existe en
-- producción (usada desde 006 en adelante) y redefinirla aquí arriesgaría
-- sobrescribir su implementación real con una adivinada. Si este archivo se
-- corre contra una base sin esa función, falla fuerte (mejor que corromper
-- silenciosamente el comportamiento en producción).
--
-- El resto de este archivo SÍ es seguro y valioso de re-ejecutar contra
-- producción: el loop de abajo hace DROP de *cualquier* policy (sin importar
-- su nombre) sobre estas 27 tablas antes de recrear tenant_isolation_policy —
-- es, en la práctica, el remedio contra las policies "USING (true)" heredadas
-- de los scripts sueltos (supabase-rls.sql, sql_arreglar_rls_notas.sql,
-- sql_notas_tramite.sql, sql_operarios.sql, sql_biblioteca_multimedia.sql),
-- que apuntan a tablas incluidas en la lista de abajo (clientes, entradas,
-- salidas, notas_kommo, notas_tramite, operarios, biblioteca_multimedia).
-- Ver auditoría 2026-07-11, hallazgo crítico "Políticas RLS USING(true)".

-- Drop all pre-existing policies on the 27 business tables before creating the new tenant_isolation_policy
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename IN (
            'ai_chats', 'biblioteca_multimedia', 'campos_datos_operacionales', 'categorias_datos_operacionales',
            'chat_equipo', 'chat_privado', 'cliente_datos_operacionales', 'clientes', 'configuraciones_app',
            'documentos_operacionales', 'documentos_pendientes', 'entradas', 'estadisticas_agenda',
            'formularios_clientes', 'historial_cambios', 'historial_clientes', 'notas_kommo', 'notas_tramite',
            'notificaciones_equipo', 'operarios', 'perfiles', 'plantillas_documentos', 'relaciones_clientes',
            'salidas', 'tramites_catalogo', 'tramites_categorias', 'tramites_precios'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Enable RLS and apply tenant_isolation_policy to all 27 business tables

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

-- Table 13: estadisticas_agenda
ALTER TABLE public.estadisticas_agenda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.estadisticas_agenda;
CREATE POLICY tenant_isolation_policy ON public.estadisticas_agenda
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
