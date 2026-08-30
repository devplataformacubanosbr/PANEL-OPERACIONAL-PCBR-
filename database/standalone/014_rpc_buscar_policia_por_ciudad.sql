-- RPC para la extensión de Chrome: buscar policías por ciudad.
--
-- Por qué una función y no una consulta REST directa desde la extensión:
--   1. RLS — ciudades/policias/policias_ciudades/policia_puntos solo
--      permiten lectura a role "authenticated" (ver 001_schema.sql /
--      007_policia_puntos.sql). La extensión no tiene sesión logueada,
--      llama a Supabase con la anon key, así que cualquier SELECT directo
--      a esas tablas siempre devuelve 0 filas ahí, aunque haya datos.
--   2. Nombres con tilde — los ~6200 municipios están cargados con
--      ortografía portuguesa completa (Belém, São Paulo, Cuiabá...). El
--      personal suele escribir sin tilde, y un ILIKE normal no matchea
--      "belem" contra "Belém". unaccent() resuelve eso en el propio SQL.
--
-- SECURITY DEFINER hace que la función corra con los privilegios de quien
-- la creó (dueño de las tablas), evitando el bloqueo de RLS sin necesidad
-- de poner la service_role key en la extensión (que vive en texto plano en
-- chrome.storage.local de cada máquina — mucho peor superficie de riesgo
-- que exponer sólo esta función de lectura puntual).

BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Por si esta base todavía no corrió 008_policia_proceso.sql.
ALTER TABLE policias ADD COLUMN IF NOT EXISTS proceso text;

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
      ) AS puntos
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

-- PostgREST expone esto en POST /rest/v1/rpc/buscar_policias_por_ciudad —
-- necesita EXECUTE explícito para anon (y authenticated, por si el
-- dashboard principal quiere reusarla más adelante).
GRANT EXECUTE ON FUNCTION public.buscar_policias_por_ciudad(text) TO anon, authenticated;

COMMIT;
