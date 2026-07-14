-- 013_pagos_tramite.sql
-- Historial de pagos por trámite/operación: costo (entradas.valor), y N pagos parciales
-- con fecha y monto. El total pagado y el pendiente se calculan en el frontend sumando
-- las filas de esta tabla, no se duplica un campo derivado en entradas.

CREATE TABLE IF NOT EXISTS public.pagos_tramite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT get_user_org_id() REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  entrada_id bigint NOT NULL REFERENCES public.entradas(id) ON DELETE CASCADE,
  monto numeric NOT NULL CHECK (monto >= 0),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  nota text,
  creado_por text DEFAULT 'operador',
  creado_en timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_tramite_entrada_id ON public.pagos_tramite(entrada_id);
CREATE INDEX IF NOT EXISTS idx_pagos_tramite_organization_id ON public.pagos_tramite(organization_id);

ALTER TABLE public.pagos_tramite ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.pagos_tramite;
CREATE POLICY tenant_isolation_policy ON public.pagos_tramite
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());
