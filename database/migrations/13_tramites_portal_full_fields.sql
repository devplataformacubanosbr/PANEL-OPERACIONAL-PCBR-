-- ===========================================================================
-- Migración 13: get_tramites_portal — campos completos para el modal del portal
-- ===========================================================================
-- El portal de clientes (PORTALClientes-PCBR/src/components/tabs/TramitesTab.jsx)
-- consultaba `entradas` directo (solo trámites donde el cliente es titular,
-- sin los campos operario/valor/pipeline_id/stage_id/datos_personalizados que
-- el modal de detalle ya necesitaba). Se reemplaza por get_tramites_portal
-- (migración 12) con todos los campos que el modal usa, para que además
-- aparezcan los trámites donde el cliente es solo un vinculado.
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
