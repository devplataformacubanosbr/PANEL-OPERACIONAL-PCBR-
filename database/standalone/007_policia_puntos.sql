-- Puntos de atención adicionales por posto: un mismo posto puede tener
-- direcciones/emails/teléfonos separados para trámites específicos (ej. el
-- posto de pasaportes dentro de la misma ciudad), cada uno con su propia
-- sigla. La dirección/teléfono/email de la tabla policias sigue siendo el
-- punto principal; esta tabla guarda los adicionales.

BEGIN;

CREATE TABLE IF NOT EXISTS policia_puntos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policia_id uuid NOT NULL REFERENCES policias(id) ON DELETE CASCADE,
  sigla text,
  direccion text,
  telefono text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS policia_puntos_policia_id_idx ON policia_puntos(policia_id);

ALTER TABLE policia_puntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policia_puntos_allow_authenticated ON policia_puntos;
CREATE POLICY policia_puntos_allow_authenticated ON policia_puntos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
