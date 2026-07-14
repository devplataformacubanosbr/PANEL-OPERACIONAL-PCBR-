-- =====================================================================================
-- MIGRACIÓN 08: ELIMINACIÓN DE ANTIGUOS CAMPOS DINÁMICOS Y CONSOLIDACIÓN EN JSONB
-- =====================================================================================

-- PASO 1: MIGRAR LAS CONFIGURACIONES DE CAMPOS DINÁMICOS AL NUEVO SISTEMA (Si existen)
-- Vamos a mover cualquier campo dinámico viejo hacia la nueva tabla de configuración
DO $$
DECLARE
    rec RECORD;
    v_categoria_nombre text;
    v_identificador text;
BEGIN
    -- campos_datos_operacionales ya tiene su propio organization_id (NOT NULL): cada fila se
    -- migra a la config de SU organización, no de una sola org elegida al azar con LIMIT 1
    -- (ese patrón ya causó un bug de fuga entre tenants en 05_custom_client_fields.sql).
    FOR rec IN SELECT c.*, cat.nombre as cat_nombre
               FROM public.campos_datos_operacionales c
               LEFT JOIN public.categorias_datos_operacionales cat ON c.categoria_id = cat.id
    LOOP
        v_categoria_nombre := COALESCE(rec.cat_nombre, 'Informaciones Personales');
        -- Generar un identificador seguro basado en el nombre
        -- (campos_datos_operacionales usa nombre_campo/tipo_campo, no nombre/tipo_dato)
        v_identificador := lower(regexp_replace(rec.nombre_campo, '[^a-zA-Z0-9]', '_', 'g'));

        INSERT INTO public.config_campos_clientes (
            organization_id, nombre_campo, identificador, categoria, tipo, requerido, opciones, orden
        )
        VALUES (
            -- opciones es `text` en la tabla vieja pero jsonb acá; to_jsonb() la envuelve como
            -- string JSON válido en vez de intentar parsearla (rec.opciones::jsonb fallaría si
            -- el texto guardado no es JSON, ej. "Opción1,Opción2").
            rec.organization_id, rec.nombre_campo, v_identificador, v_categoria_nombre, rec.tipo_campo, rec.requerido, to_jsonb(rec.opciones), rec.orden
        )
        ON CONFLICT (organization_id, identificador) DO NOTHING;
    END LOOP;
END $$;


-- PASO 2: MIGRAR LOS DATOS DE LOS CLIENTES (Valores de los campos) AL JSONB
DO $$
DECLARE
    rec RECORD;
    v_identificador text;
BEGIN
    -- Recorremos cada valor guardado en la tabla vieja
    FOR rec IN
        SELECT d.id_cliente, d.valor, c.nombre_campo
        FROM public.cliente_datos_operacionales d
        JOIN public.campos_datos_operacionales c ON d.campo_id = c.id
    LOOP
        -- Generamos el mismo identificador que usamos en el paso 1
        v_identificador := lower(regexp_replace(rec.nombre_campo, '[^a-zA-Z0-9]', '_', 'g'));
        
        -- Actualizamos el JSONB del cliente para inyectarle este valor
        UPDATE public.clientes 
        SET campos_personalizados = jsonb_set(
            COALESCE(campos_personalizados, '{}'::jsonb), 
            array[v_identificador], 
            to_jsonb(rec.valor)
        )
        WHERE id = rec.id_cliente;
    END LOOP;
END $$;


-- PASO 3: ELIMINAR LAS TABLAS ANTIGUAS (Cuidado: Acción irreversible, los datos ya fueron migrados arriba)
-- documentos_operacionales.dato_operacional_id tiene una FK hacia cliente_datos_operacionales,
-- así que sin CASCADE este DROP falla con "cannot drop table because other objects depend on it".
-- CASCADE solo elimina esa constraint (no las filas de documentos_operacionales ni los archivos
-- ya subidos, que siguen accesibles por id_cliente); dato_operacional_id queda huérfano.
DROP TABLE IF EXISTS public.cliente_datos_operacionales CASCADE;
DROP TABLE IF EXISTS public.campos_datos_operacionales CASCADE;
DROP TABLE IF EXISTS public.categorias_datos_operacionales CASCADE;

-- Fin de la migración.
