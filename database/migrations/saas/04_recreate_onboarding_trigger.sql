-- 4. Recreate Onboarding Trigger Function
-- Corregido: el flujo de agencia hacía INSERT INTO public.organizations
-- (name), tabla/columna que nunca existieron en producción real (la real es
-- organizaciones.nombre — confirmado por OrganizationContext.jsx:179 y por
-- 009_add_onboarding_flag.sql, que ya opera sobre organizaciones). Si el
-- trigger EN VIVO todavía tiene el bug original, todo signup de agencia
-- (AgencySignUp.jsx) está fallando hoy en producción — verificar el cuerpo
-- real de handle_new_user() en el dashboard de Supabase antes de asumir que
-- este archivo ya refleja lo desplegado. Ver auditoría 2026-07-11.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  is_agency BOOLEAN;
  agency_name TEXT;
  user_name TEXT;
  user_rol TEXT;
BEGIN
  -- Extract metadata fields with safe checks
  is_agency := COALESCE((new.raw_user_meta_data->>'is_agency_registration')::boolean, false);

  agency_name := new.raw_user_meta_data->>'agency_name';
  user_name := COALESCE(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  user_rol := COALESCE(new.raw_user_meta_data->>'rol', new.raw_user_meta_data->>'role', 'miembro');

  IF is_agency THEN
    -- Agency Flow: Create a new organization and make the user its admin_plus
    INSERT INTO public.organizaciones (nombre)
    VALUES (COALESCE(agency_name, 'Agencia de ' || user_name))
    RETURNING id INTO new_org_id;
    
    user_rol := 'admin_plus';
  ELSE
    -- Standard/Invitation Flow: Associate with organization provided in invitation metadata
    new_org_id := COALESCE((new.raw_user_meta_data->>'organization_id')::uuid, '00000000-0000-0000-0000-000000000000');
  END IF;

  -- Create profile record linked to organization
  INSERT INTO public.perfiles (id, email, nombre, rol, organization_id)
  VALUES (new.id, new.email, user_name, user_rol, new_org_id);

  RETURN new;
END;
$$;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
