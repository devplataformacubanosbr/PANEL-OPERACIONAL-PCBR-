-- 018_organizaciones_select_policy.sql
-- organizaciones tiene RLS habilitado pero nunca tuvo una policy de SELECT (confirmado por
-- diagnóstico: pg_policies solo mostraba marca_update_policy). Sin policy de SELECT, Postgres
-- devuelve la fila vacía incluso después de un UPDATE exitoso, porque el UPDATE...RETURNING
-- (y cualquier SELECT directo) también respeta la policy de SELECT. Esto explica el
-- "No se encontraron registros" en Marca, y probablemente afecta a cualquier lectura directa
-- de organizaciones desde el cliente (OrganizationContext.jsx hace select('*') sobre esta
-- misma tabla).

DROP POLICY IF EXISTS organizaciones_select_policy ON public.organizaciones;
CREATE POLICY organizaciones_select_policy ON public.organizaciones
  FOR SELECT TO authenticated
  USING (id = public.get_user_org_id());
