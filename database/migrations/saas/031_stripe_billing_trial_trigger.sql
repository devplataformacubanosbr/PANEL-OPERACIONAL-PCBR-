-- 031. Recrea handle_new_user() (04_recreate_onboarding_trigger.sql) para:
--   a) crear automáticamente una suscripción de prueba de 14 días al
--      registrar una agencia nueva (requiere que 030 ya haya corrido: usa
--      planes.es_prueba y suscripciones.trial_ends_at).
--   b) Fase 0.4 del plan: un signup de invitación sin organization_id
--      válido en la metadata ya NO cae en una organización compartida
--      ficticia (00000000-...) — se rechaza con una excepción.
--   c) valida el límite de asientos (planes.limite_usuarios) al invitar
--      miembros. Es el único punto real donde se puede aplicar ese límite:
--      JoinAgency.jsx es una página pública sin autenticación, así que no
--      hay ningún chequeo posible del lado del cliente.
--
-- No se edita 04_recreate_onboarding_trigger.sql in-place (ya está
-- aplicado en producción) — se sigue el mismo patrón que ese archivo usó
-- para reemplazar la versión anterior: CREATE OR REPLACE de la función.

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
  trial_plan_id UUID;
  seat_limit INTEGER;
  current_members INTEGER;
BEGIN
  is_agency := COALESCE((new.raw_user_meta_data->>'is_agency_registration')::boolean, false);
  agency_name := new.raw_user_meta_data->>'agency_name';
  user_name := COALESCE(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  user_rol := COALESCE(new.raw_user_meta_data->>'rol', new.raw_user_meta_data->>'role', 'miembro');

  IF is_agency THEN
    -- Agency Flow: crea una organización nueva y hace admin_plus al usuario.
    INSERT INTO public.organizaciones (nombre)
    VALUES (COALESCE(agency_name, 'Agencia de ' || user_name))
    RETURNING id INTO new_org_id;

    user_rol := 'admin_plus';

    -- Trial automático de 14 días, sin pedir tarjeta.
    SELECT id INTO trial_plan_id FROM public.planes WHERE es_prueba = true LIMIT 1;
    IF trial_plan_id IS NOT NULL THEN
      INSERT INTO public.suscripciones (organization_id, plan_id, estado, fecha_inicio, trial_ends_at)
      VALUES (new_org_id, trial_plan_id, 'trialing', now(), now() + interval '14 days');
    END IF;

  ELSE
    -- Standard/Invitation Flow: asocia con la organización de la metadata
    -- de la invitación. Antes: sin organization_id válido caía en el UUID
    -- cero compartido. Ahora: se rechaza el signup.
    IF (new.raw_user_meta_data->>'organization_id') IS NULL THEN
      RAISE EXCEPTION 'Registro inválido: falta organization_id en la invitación. Solicita un nuevo link de invitación.';
    END IF;

    new_org_id := (new.raw_user_meta_data->>'organization_id')::uuid;

    IF NOT EXISTS (SELECT 1 FROM public.organizaciones WHERE id = new_org_id) THEN
      RAISE EXCEPTION 'Registro inválido: la organización de la invitación ya no existe.';
    END IF;

    -- Tope de asientos según el plan de la organización.
    SELECT pl.limite_usuarios INTO seat_limit
    FROM public.suscripciones s JOIN public.planes pl ON pl.id = s.plan_id
    WHERE s.organization_id = new_org_id;

    IF seat_limit IS NOT NULL THEN
      SELECT count(*) INTO current_members FROM public.perfiles WHERE organization_id = new_org_id;
      IF current_members >= seat_limit THEN
        RAISE EXCEPTION 'Se alcanzó el límite de % usuarios de tu plan. Actualiza tu plan para invitar más miembros.', seat_limit;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.perfiles (id, email, nombre, rol, organization_id)
  VALUES (new.id, new.email, user_name, user_rol, new_org_id);

  RETURN new;
END;
$$;

-- El trigger ya existe (creado por 04_recreate_onboarding_trigger.sql) y
-- apunta a esta función por nombre — CREATE OR REPLACE de arriba es
-- suficiente, no hace falta recrear el trigger.
