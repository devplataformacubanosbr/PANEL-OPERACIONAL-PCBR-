-- 017_fix_marca_update_policy.sql
-- La policy de 015 exigía además que perfiles.rol esté en ('admin','admin_plus') vía un
-- EXISTS subquery. Eso bloqueó el UPDATE en producción (0 filas afectadas) porque esa
-- condición no matcheó contra el esquema real. La quitamos y dejamos el mismo criterio de
-- aislamiento por organización que usa tenant_isolation_policy en las otras 27 tablas del
-- sistema: la restricción de "solo admin" ya la hace el frontend (SettingsView.jsx solo
-- muestra la pestaña Marca si isAdmin), no hace falta duplicarla acá.

DROP POLICY IF EXISTS marca_update_policy ON public.organizaciones;
CREATE POLICY marca_update_policy ON public.organizaciones
  FOR UPDATE TO authenticated
  USING (id = public.get_user_org_id())
  WITH CHECK (id = public.get_user_org_id());
