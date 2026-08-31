-- Antes, telefono/email eran un único texto por comisaría y por punto de
-- atención adicional. Un mismo posto suele tener línea fija + celular, o
-- varios correos según el trámite, así que se convierten esas 4 columnas
-- de text a text[]. El valor existente se conserva como primer elemento
-- del array (o array vacío si estaba en null/blanco).
--
-- El USING está condicionado con un chequeo de information_schema para que
-- el script se pueda volver a correr sin fallar si ya se aplicó antes (no
-- se puede hacer un ALTER COLUMN TYPE text[] sobre una columna que ya es
-- text[], el USING asume que el valor de partida es texto).

BEGIN;

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'policias' AND column_name = 'telefono') = 'text' THEN
    ALTER TABLE policias ALTER COLUMN telefono TYPE text[]
      USING (CASE WHEN telefono IS NULL OR telefono = '' THEN '{}'::text[] ELSE ARRAY[telefono] END);
  END IF;

  IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'policias' AND column_name = 'email') = 'text' THEN
    ALTER TABLE policias ALTER COLUMN email TYPE text[]
      USING (CASE WHEN email IS NULL OR email = '' THEN '{}'::text[] ELSE ARRAY[email] END);
  END IF;

  IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'policia_puntos' AND column_name = 'telefono') = 'text' THEN
    ALTER TABLE policia_puntos ALTER COLUMN telefono TYPE text[]
      USING (CASE WHEN telefono IS NULL OR telefono = '' THEN '{}'::text[] ELSE ARRAY[telefono] END);
  END IF;

  IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'policia_puntos' AND column_name = 'email') = 'text' THEN
    ALTER TABLE policia_puntos ALTER COLUMN email TYPE text[]
      USING (CASE WHEN email IS NULL OR email = '' THEN '{}'::text[] ELSE ARRAY[email] END);
  END IF;
END $$;

COMMIT;
