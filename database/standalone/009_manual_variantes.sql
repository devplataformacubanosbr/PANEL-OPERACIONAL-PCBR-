-- Un mismo trámite (manual) puede tener distintos PDF según el posto que lo
-- procese (ej. Florianópolis, Itajaí, Joinville piden formularios distintos
-- para el mismo trámite). "url_pdf" en manuales_tramites sigue siendo el PDF
-- principal/genérico; esta tabla guarda las variantes por ciudad/posto.

BEGIN;

CREATE TABLE IF NOT EXISTS manual_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id uuid NOT NULL REFERENCES manuales_tramites(id) ON DELETE CASCADE,
  etiqueta text,
  url_pdf text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_variantes_manual_id_idx ON manual_variantes(manual_id);

ALTER TABLE manual_variantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manual_variantes_allow_authenticated ON manual_variantes;
CREATE POLICY manual_variantes_allow_authenticated ON manual_variantes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
