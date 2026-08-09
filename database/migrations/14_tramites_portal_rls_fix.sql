-- ===========================================================================
-- Migración 14: arreglar lecturas del portal bloqueadas por RLS
-- ===========================================================================
-- El portal de clientes (PORTALClientes-PCBR) nunca crea una sesión real de
-- Supabase Auth (login propio por numero_cliente/clave, ver login_cliente_portal
-- en la migración 11) — corre siempre como el rol `anon`. Pero pipeline_etapas,
-- notas_tramite, pagos_tramite y documentos_operacionales solo dan RLS al rol
-- `authenticated`, así que TramitesTab.jsx nunca podía cargar el progreso
-- (etapas), las notas de seguimiento ni los pagos — las queries no fallaban,
-- simplemente RLS les devolvía 0 filas en silencio.
--
-- Se resuelve embebiendo etapas/notas/pagos directo en get_tramites_portal
-- (una función SECURITY DEFINER ya bypasea RLS), y agregando una función
-- equivalente para los documentos del cliente.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_tramites_portal(p_cliente_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'servicio', e.servicio,
        'estado_tramite', e.estado_tramite,
        'creado_en', e.creado_en,
        'operario', e.operario,
        'valor', e.valor,
        'pipeline_id', e.pipeline_id,
        'stage_id', e.stage_id,
        'datos_personalizados', e.datos_personalizados,
        'es_titular', (e.id_cliente = p_cliente_id),
        'titular', jsonb_build_object('id', c.id, 'nombre', c.nombre),
        'vinculados', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', vc.id, 'nombre', vc.nombre))
            FROM public.entrada_clientes_vinculados ecv
            JOIN public.clientes vc ON vc.id = ecv.cliente_id
            WHERE ecv.entrada_id = e.id
        ), '[]'::jsonb),
        'etapas', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', pe.id, 'nombre', pe.nombre, 'codigo', pe.codigo, 'orden', pe.orden) ORDER BY pe.orden)
            FROM public.pipeline_etapas pe
            WHERE pe.pipeline_id = e.pipeline_id AND pe.activo = true
        ), '[]'::jsonb),
        'notas', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', nt.id, 'texto', nt.texto, 'creado_en', nt.creado_en) ORDER BY nt.creado_en DESC)
            FROM public.notas_tramite nt
            WHERE nt.entrada_id = e.id
        ), '[]'::jsonb),
        'pagos', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', pt.id, 'monto', pt.monto, 'fecha', pt.fecha, 'nota', pt.nota) ORDER BY pt.fecha DESC)
            FROM public.pagos_tramite pt
            WHERE pt.entrada_id = e.id
        ), '[]'::jsonb)
    ))
    INTO v_result
    FROM public.entradas e
    JOIN public.clientes c ON c.id = e.id_cliente
    WHERE e.id_cliente = p_cliente_id
       OR EXISTS (
           SELECT 1 FROM public.entrada_clientes_vinculados ecv
           WHERE ecv.entrada_id = e.id AND ecv.cliente_id = p_cliente_id
       );

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Documentos del cliente para la tab "Documentos" del portal (mismo problema
-- de RLS que arriba — documentos_operacionales solo permite `authenticated`).
CREATE OR REPLACE FUNCTION public.get_documentos_portal(p_cliente_id bigint)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', d.id,
        'nombre_archivo', d.nombre_archivo,
        'tipo_documento', d.tipo_documento,
        'estado', d.estado,
        'creado_en', d.creado_en
    ) ORDER BY d.creado_en DESC), '[]'::jsonb)
    FROM public.documentos_operacionales d
    WHERE d.id_cliente = p_cliente_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_documentos_portal(bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.get_documentos_portal(bigint) TO authenticated;
