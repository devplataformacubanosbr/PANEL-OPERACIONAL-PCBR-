-- Función RPC que agrega todas las estadísticas del Panel Operacional
-- (src/components/dashboard/DashboardView.jsx) en una sola consulta del
-- lado del servidor, en vez de traer todas las filas de `clientes` y
-- `entradas` al navegador para sumarlas/agruparlas en JavaScript (como hacía
-- src/services/dashboardService.js antes de esta migración). Las funciones
-- agregadas (`sum()`, `count()` agrupado) no se pueden pedir directo desde
-- PostgREST en este proyecto (confirmado: "PGRST123 Use of aggregate
-- functions is not allowed"), así que se resuelve con una función SECURITY
-- DEFINER, mismo patrón que generar_numero_cliente en
-- database/migrations/11_portal_clientes_credentials.sql.
--
-- NOT aplicada automáticamente — correr manualmente en el SQL Editor de
-- Supabase, igual que el resto de database/standalone/.

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_this_month timestamptz := date_trunc('month', now());
  v_start_last_month timestamptz := date_trunc('month', now()) - interval '1 month';
  v_result json;
BEGIN
  SELECT json_build_object(
    'totalClientes', (SELECT count(*) FROM public.clientes),
    'clientesNuevosMes', (
      SELECT count(*) FROM public.clientes WHERE creado_en >= v_start_this_month
    ),
    'clientesNuevosMesAnterior', (
      SELECT count(*) FROM public.clientes
      WHERE creado_en >= v_start_last_month AND creado_en < v_start_this_month
    ),
    'clientesPorEstado', (
      SELECT COALESCE(json_object_agg(estado, cnt), '{}'::json)
      FROM (
        SELECT COALESCE(estado_cliente, 'nuevo') AS estado, count(*) AS cnt
        FROM public.clientes
        GROUP BY 1
      ) s
    ),
    'totalTramites', (SELECT count(*) FROM public.entradas),
    'tramitesPorEstado', (
      SELECT COALESCE(json_object_agg(estado, cnt), '{}'::json)
      FROM (
        SELECT COALESCE(estado_tramite, 'pendiente') AS estado, count(*) AS cnt
        FROM public.entradas
        GROUP BY 1
      ) s
    ),
    'ingresosTotales', (SELECT COALESCE(sum(valor), 0) FROM public.entradas),
    'ingresosMesActual', (
      SELECT COALESCE(sum(valor), 0) FROM public.entradas WHERE creado_en >= v_start_this_month
    ),
    'ingresosMesAnterior', (
      SELECT COALESCE(sum(valor), 0) FROM public.entradas
      WHERE creado_en >= v_start_last_month AND creado_en < v_start_this_month
    ),
    'tramitesCompletadosMes', (
      SELECT count(*) FROM public.entradas
      WHERE estado_tramite = 'completada' AND fecha_completacion >= v_start_this_month
    ),
    'agendamientosMes', (
      SELECT count(*) FROM public.entradas
      WHERE servicio ILIKE '%agendamiento%' AND creado_en >= v_start_this_month
    ),
    'ingresosPorMes', (
      SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json)
      FROM (
        SELECT
          to_char(date_trunc('month', creado_en), 'YYYY-MM') AS mes,
          COALESCE(sum(valor), 0) AS total
        FROM public.entradas
        WHERE creado_en >= (v_start_this_month - interval '5 months')
        GROUP BY 1
        ORDER BY 1
      ) m
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
