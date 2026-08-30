-- =====================================================================
-- DASHBOARDOperacional-PCBR — standalone (single-tenant) schema
-- 013_fix_nombre_padre_identificador.sql
--
-- CONTEXTO: el campo "Nombre del Padre" (categoría Datos Familiares) se
-- borró sin querer de config_campos_clientes y se volvió a crear a mano.
-- El texto tipeado al recrearlo tenía un typo ("Nombe del Padre"), y como
-- el identificador se genera automáticamente a partir del nombre escrito,
-- quedó guardado como `nombe_del_padre` en vez de `nombre_padre`.
--
-- Borrar la fila del catálogo NUNCA borra los datos ya guardados en
-- clientes.campos_personalizados (son cosas separadas) — así que los
-- valores viejos de "nombre_padre" de cada cliente seguían ahí, solo que
-- huérfanos: sin ninguna fila de config_campos_clientes apuntándolos.
--
-- El resto del sistema (extracción por IA, generación de firma/carta,
-- fusión de duplicados, importación CSV, plantillas de documentos, y el
-- autocompletado de la extensión de Chrome) NO lee el catálogo dinámico
-- para estos 13 campos migratorios — tiene la clave `nombre_padre`
-- literalmente escrita en el código (ver clientView.constants.js). Por
-- eso "la IA y el sistema" seguían viendo/escribiendo el dato viejo,
-- mientras el campo nuevo en pantalla (con la clave con typo) aparecía
-- vacío: apuntaba a una clave distinta que nadie más usaba.
--
-- Verificado contra la base productiva (2026-08-30): de los 13 campos
-- migratorios, este es el ÚNICO cuyo identificador no coincide con lo
-- que el código espera. Los otros 12 (rnm, numero_refugio,
-- fecha_vencimiento_refugio, numero_pasaporte, fecha_emision_pasaporte,
-- fecha_vencimiento_pasaporte, carnet_identidad, policia_federal,
-- fecha_entrada_brasil, lugar_entrada_brasil, nombre_madre, tramite)
-- están bien.
--
-- CÓMO CORRER ESTO:
--   1. Pegar y correr primero el PASO 1 (solo lectura) en el SQL Editor
--      de Supabase. Revisar la lista: si algún cliente aparece con
--      valores DISTINTOS en ambas columnas, decidir a mano cuál vale
--      (este script, por defecto, prioriza el valor del campo nuevo
--      "nombe_del_padre" por ser el más reciente).
--   2. Si la lista se ve razonable, correr el PASO 2 completo (ya viene
--      envuelto en una transacción: si algo falla, no se aplica nada).
-- =====================================================================

-- ── PASO 1 (solo lectura) — revisar antes de tocar nada ────────────────
select
  id,
  nombre,
  campos_personalizados->>'nombre_padre'    as valor_viejo_huerfano,
  campos_personalizados->>'nombe_del_padre' as valor_nuevo_con_typo
from clientes
where nullif(trim(campos_personalizados->>'nombre_padre'), '') is not null
   or nullif(trim(campos_personalizados->>'nombe_del_padre'), '') is not null;

-- ── PASO 2 — migrar datos + reconectar el catálogo (transaccional) ─────
begin;

-- 2a. Por cada cliente con dato en cualquiera de las dos claves, dejar
--     todo bajo la clave correcta `nombre_padre` (prioridad: valor nuevo
--     si existe, si no el viejo) y borrar la clave con typo.
update clientes
set campos_personalizados =
  (campos_personalizados - 'nombe_del_padre')
  || jsonb_build_object(
       'nombre_padre',
       coalesce(
         nullif(trim(campos_personalizados->>'nombe_del_padre'), ''),
         nullif(trim(campos_personalizados->>'nombre_padre'), '')
       )
     )
where nullif(trim(campos_personalizados->>'nombre_padre'), '') is not null
   or nullif(trim(campos_personalizados->>'nombe_del_padre'), '') is not null;

-- 2b. Reconectar el catálogo: el campo que se ve en "Datos Familiares"
--     vuelve a apuntar a la clave que usa el resto del sistema. La
--     UNIQUE constraint sobre identificador hace que esto falle solo
--     (sin corromper nada) si por algún motivo ya existiera una fila
--     activa con identificador = 'nombre_padre'.
update config_campos_clientes
set identificador = 'nombre_padre'
where identificador = 'nombe_del_padre';

commit;

-- ── Verificación posterior (opcional) ───────────────────────────────────
-- select identificador, nombre_campo, categoria from config_campos_clientes where identificador = 'nombre_padre';
-- select count(*) from clientes where nullif(trim(campos_personalizados->>'nombe_del_padre'), '') is not null; -- debería dar 0
