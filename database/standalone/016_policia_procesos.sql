-- Antes "cómo se hace el proceso" era un único texto libre en la columna
-- policias.proceso. Un mismo posto suele atender varios trámites distintos
-- (ej. Pasaporte, Cédula, Reagendamiento), cada uno con sus propios pasos y,
-- a veces, formularios/ejemplos que conviene adjuntar. Esta migración crea:
--   - policia_procesos: un trámite por fila (título + descripción).
--   - policia_proceso_archivos: los archivos adjuntos de cada trámite.
--   - bucket "policia_procesos" en Storage para esos archivos (privado,
--     igual que documentos_operacionales — solo lectura/escritura para
--     usuarios autenticados del dashboard).
--
-- La columna vieja policias.proceso NO se borra ni se migra automáticamente
-- acá: PoliciaModal.jsx la usa como semilla de un primer proceso la primera
-- vez que se abre el modal de edición de un posto que todavía no tiene filas
-- en policia_procesos, así no se pierde lo ya cargado.

BEGIN;

CREATE TABLE IF NOT EXISTS policia_procesos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policia_id uuid NOT NULL REFERENCES policias(id) ON DELETE CASCADE,
  titulo text,
  descripcion text,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS policia_procesos_policia_id_idx ON policia_procesos(policia_id);

ALTER TABLE policia_procesos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policia_procesos_allow_authenticated ON policia_procesos;
CREATE POLICY policia_procesos_allow_authenticated ON policia_procesos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS policia_proceso_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proceso_id uuid NOT NULL REFERENCES policia_procesos(id) ON DELETE CASCADE,
  nombre_archivo text NOT NULL,
  url_archivo text NOT NULL,
  tipo_contenido text,
  tamano_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS policia_proceso_archivos_proceso_id_idx ON policia_proceso_archivos(proceso_id);

ALTER TABLE policia_proceso_archivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policia_proceso_archivos_allow_authenticated ON policia_proceso_archivos;
CREATE POLICY policia_proceso_archivos_allow_authenticated ON policia_proceso_archivos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bucket privado para los adjuntos. Solo el dashboard (usuarios
-- autenticados) sube/lee/borra; la extensión de Chrome (que llama a
-- buscar_policias_por_ciudad con la anon key) sigue mostrando el
-- título/descripción de cada proceso pero no los archivos.
INSERT INTO storage.buckets (id, name, public)
VALUES ('policia_procesos', 'policia_procesos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "policia_procesos storage authenticated" ON storage.objects;
CREATE POLICY "policia_procesos storage authenticated" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'policia_procesos')
  WITH CHECK (bucket_id = 'policia_procesos');

-- Reemplaza la función de 014 para sumar el array "procesos" (título +
-- descripción de cada trámite) igual que ya hace con "puntos".
CREATE OR REPLACE FUNCTION public.buscar_policias_por_ciudad(busqueda text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
  FROM (
    SELECT
      p.id,
      p.nombre,
      p.direccion,
      p.telefono,
      p.email,
      p.horario_atencion,
      p.notas,
      p.proceso,
      array_agg(DISTINCT c.nombre || COALESCE(' — ' || c.estado, '')) AS ciudades_coincidentes,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'sigla', pp.sigla, 'direccion', pp.direccion,
            'telefono', pp.telefono, 'email', pp.email
          ))
         FROM policia_puntos pp WHERE pp.policia_id = p.id),
        '[]'::jsonb
      ) AS puntos,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'titulo', pr.titulo, 'descripcion', pr.descripcion
          ) ORDER BY pr.orden, pr.created_at)
         FROM policia_procesos pr WHERE pr.policia_id = p.id),
        '[]'::jsonb
      ) AS procesos
    FROM ciudades c
    JOIN policias_ciudades pc ON pc.ciudad_id = c.id
    JOIN policias p ON p.id = pc.policia_id
    WHERE busqueda IS NOT NULL
      AND length(trim(busqueda)) > 0
      AND unaccent(c.nombre) ILIKE unaccent('%' || busqueda || '%')
    GROUP BY p.id, p.nombre, p.direccion, p.telefono, p.email, p.horario_atencion, p.notas, p.proceso
    ORDER BY p.nombre
    LIMIT 50
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_policias_por_ciudad(text) TO anon, authenticated;

COMMIT;
