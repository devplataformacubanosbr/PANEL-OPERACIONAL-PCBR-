-- Migración 033: al borrar una organización, borrar también las cuentas de
-- Supabase Auth (auth.users) de sus miembros, no solo sus perfiles.
--
-- Motivo: la migración 032 dejó que borrar una organización cascadeara
-- hasta perfiles, pero auth.users seguía viva — quedaban "cuentas
-- fantasma" que:
--   a) podían seguir logueándose (bloqueado del lado de la app en
--      AuthContext.fetchProfile, pero la cuenta seguía existiendo en Auth);
--   b) bloqueaban volver a registrar ese mismo email como agencia nueva,
--      porque Supabase Auth ve el email como "ya registrado" aunque no
--      tenga perfil ni organización.
--
-- Este trigger borra auth.users ANTES de que la organización se borre,
-- para los miembros que le pertenecen (vía perfiles.organization_id).
-- auth.users tiene ON DELETE CASCADE hacia perfiles/identities/sessions/
-- refresh_tokens/etc (estándar de Supabase), así que esto también limpia
-- esas tablas automáticamente — la FK perfiles_organization_id_fkey de la
-- migración 032 queda como red de seguridad redundante, no como el
-- mecanismo principal de limpieza.
--
-- ADVERTENCIA: esto borra cuentas de inicio de sesión reales, no solo
-- datos de la app. Es irreversible — el usuario pierde su login por
-- completo, no solo el acceso a esta organización.

CREATE OR REPLACE FUNCTION public.delete_org_members_auth_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users
  WHERE id IN (SELECT id FROM public.perfiles WHERE organization_id = OLD.id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_org_members_auth_users ON public.organizaciones;
CREATE TRIGGER trg_delete_org_members_auth_users
  BEFORE DELETE ON public.organizaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_org_members_auth_users();
