-- 020_purge_open_rls_policies.sql
--
-- Hallazgo de la auditoría 2026-07-11, verificado en vivo contra producción
-- (rcqkmaxkuxllcyjzqbvn) el mismo día: prácticamente todas las tablas de
-- negocio tienen, apiladas sobre tenant_isolation_policy, políticas
-- "USING (true)" heredadas de scripts sueltos que nunca se commitearon al
-- repo (nombres como "Acceso total para autenticados", "Permitir todo a
-- usuarios autenticados", "dashboard_write_*", "Permitir lectura a todos").
-- Postgres combina con OR todas las políticas permisivas del mismo
-- rol/comando, así que estas policies abiertas anulan por completo el
-- aislamiento por organización — CUALQUIER usuario autenticado (de
-- cualquier organización) puede leer/escribir TODO en estas tablas hoy, y
-- para clientes/entradas/salidas/notas_tramite/operarios/mensajes incluso
-- usuarios NO autenticados (rol anon/public) pueden hacerlo.
--
-- Este archivo purga eso: dropea CUALQUIER policy (sin importar su nombre)
-- sobre las tablas de la lista y deja exactamente una tenant_isolation_policy
-- por tabla. Es la versión extendida de
-- saas/03_create_rls_helpers_and_policies.sql (27 tablas) + dos tablas que
-- tenían el mismo problema pero nunca estuvieron en ese archivo porque se
-- crearon directo en producción: mensajes (chats de WhatsApp — el hallazgo
-- más grave: tenía SELECT público sin ninguna restricción) y
-- tramites_requisitos.
--
-- Seguro de re-ejecutar: es puramente declarativo (DROP IF EXISTS + CREATE).

DO $$
DECLARE
    pol record;
    -- Verificado contra producción 2026-07-11: notas_kommo,
    -- campos_datos_operacionales, categorias_datos_operacionales,
    -- cliente_datos_operacionales y estadisticas_agenda YA NO EXISTEN (los
    -- 27 nombres originales de saas/03 eran de una versión más vieja del
    -- esquema). Se omiten para que este bloque no aborte con "relation does
    -- not exist".
    tablas text[] := ARRAY[
        'ai_chats', 'biblioteca_multimedia',
        'chat_equipo', 'chat_privado', 'clientes', 'configuraciones_app',
        'documentos_operacionales', 'documentos_pendientes', 'entradas',
        'formularios_clientes', 'historial_cambios', 'historial_clientes', 'notas_tramite',
        'notificaciones_equipo', 'operarios', 'perfiles', 'plantillas_documentos', 'relaciones_clientes',
        'salidas', 'tramites_catalogo', 'tramites_categorias', 'tramites_precios',
        'mensajes', 'tramites_requisitos'
    ];
    tabla text;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = ANY(tablas)
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;

    FOREACH tabla IN ARRAY tablas LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON public.%I FOR ALL TO authenticated USING (organization_id = public.get_user_org_id()) WITH CHECK (organization_id = public.get_user_org_id())',
            tabla
        );
    END LOOP;
END $$;
