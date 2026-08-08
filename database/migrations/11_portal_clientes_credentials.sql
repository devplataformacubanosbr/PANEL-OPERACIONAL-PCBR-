-- ===========================================================================
-- Migración 11: Credenciales de Acceso al Portal de Clientes PCBR
-- ===========================================================================
-- Agrega las columnas `numero_cliente` y `clave_acceso` a la tabla `clientes`
-- para permitir la autenticación de clientes en la App Móvil / Portal Web.
-- ===========================================================================

-- 1. Agregar columnas de credenciales
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'numero_cliente') THEN
        ALTER TABLE public.clientes ADD COLUMN numero_cliente text UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'clave_acceso') THEN
        ALTER TABLE public.clientes ADD COLUMN clave_acceso text;
    END IF;
END $$;

-- 2. Crear secuencia para autogenerar números de cliente
CREATE SEQUENCE IF NOT EXISTS public.seq_numero_cliente START WITH 10001 INCREMENT BY 1;

-- 3. Función para generar número de cliente automáticamente
CREATE OR REPLACE FUNCTION public.generar_numero_cliente(p_cliente_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_numero text;
    v_existing text;
BEGIN
    -- Verificar si ya tiene número
    SELECT numero_cliente INTO v_existing FROM public.clientes WHERE id = p_cliente_id;
    IF v_existing IS NOT NULL THEN
        RETURN v_existing;
    END IF;

    -- Generar nuevo número secuencial
    v_numero := 'PCBR-' || nextval('public.seq_numero_cliente')::text;

    -- Asignar al cliente
    UPDATE public.clientes SET numero_cliente = v_numero WHERE id = p_cliente_id;

    RETURN v_numero;
END;
$$;

-- 4. Función de login para el portal de clientes
-- Recibe el número de cliente (o CPF) y la clave de acceso.
-- Retorna los datos básicos del cliente si las credenciales coinciden.
CREATE OR REPLACE FUNCTION public.login_cliente_portal(
    p_identificador text,
    p_clave text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente record;
BEGIN
    -- Buscar por numero_cliente O por CPF
    SELECT id, nombre, cpf, numero_cliente, email, telefono
    INTO v_cliente
    FROM public.clientes
    WHERE (numero_cliente = p_identificador OR cpf = p_identificador)
      AND clave_acceso = p_clave;

    IF v_cliente IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Credenciales inválidas');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'cliente', jsonb_build_object(
            'id', v_cliente.id,
            'nombre', v_cliente.nombre,
            'cpf', v_cliente.cpf,
            'numero_cliente', v_cliente.numero_cliente,
            'email', v_cliente.email,
            'telefono', v_cliente.telefono
        )
    );
END;
$$;

-- 5. Conceder acceso a la función de login al rol anon (para que la app móvil pueda usarla sin auth de Supabase)
GRANT EXECUTE ON FUNCTION public.login_cliente_portal(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.login_cliente_portal(text, text) TO authenticated;

-- 6. Poblar números de cliente para todos los clientes existentes que no tengan uno
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT id FROM public.clientes WHERE numero_cliente IS NULL LOOP
        PERFORM public.generar_numero_cliente(r.id);
    END LOOP;
END $$;
