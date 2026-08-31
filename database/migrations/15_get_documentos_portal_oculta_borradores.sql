-- ===========================================================================
-- Migración 15: get_documentos_portal no debe mostrar borradores de PDF Único
-- ===========================================================================
-- GlobalDocumentoUnicoListener.jsx (dashboard) arma el PDF Único solo en
-- cuanto el checklist de un cliente queda completo (subida vía Portal), y lo
-- deja guardado en documentos_operacionales como
-- tipo_documento='PDF_UNICO_BORRADOR', estado='pendiente' -- a la espera de
-- que un operario lo revise y lo marque 'verificado' con el toggle que ya
-- existe en la ficha del cliente (ClientDocuments.jsx).
--
-- get_documentos_portal (migración 14) no filtraba nada -- devolvía TODAS
-- las filas de documentos_operacionales del cliente, así que ese borrador
-- interno aparecía en la tab "Documentos" del propio cliente en el Portal
-- ANTES de que nadie lo aprobara (nombre de archivo interno "BORRADOR",
-- estado "Pendiente" sin contexto). Se oculta mientras esté sin aprobar; en
-- cuanto un operario lo marca 'verificado' aparece normal, como cualquier
-- otro documento generado -- que además es un lindo efecto colateral: el
-- cliente ve su PDF Único terminado en el Portal sin que el staff tenga que
-- compartirlo a mano.
-- ===========================================================================

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
    WHERE d.id_cliente = p_cliente_id
      AND NOT (d.tipo_documento = 'PDF_UNICO_BORRADOR' AND d.estado <> 'verificado');
$$;

GRANT EXECUTE ON FUNCTION public.get_documentos_portal(bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.get_documentos_portal(bigint) TO authenticated;
