-- 010_vector_conversaciones.sql
-- Base vectorial para que el asistente IA encuentre casos parecidos de
-- OTROS clientes (problema -> cómo se resolvió -> cómo se le habló) al
-- responder sobre el cliente actual. Ver supabase/functions/ai-embeddings.

CREATE EXTENSION IF NOT EXISTS vector;

-- Cada fila es una "sesión" de conversación (mensajes de un mismo cliente
-- agrupados por cercanía en el tiempo), no un mensaje suelto — un mensaje
-- aislado ("hola", "ok gracias") no tiene contenido semántico útil para
-- buscar casos parecidos.
CREATE TABLE IF NOT EXISTS public.conversaciones_embeddings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id bigint REFERENCES public.clientes(id) ON DELETE CASCADE,
  contenido text NOT NULL,
  embedding vector(1536) NOT NULL,
  fecha_inicio timestamp with time zone,
  fecha_fin timestamp with time zone,
  servicio text,
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT conversaciones_embeddings_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS conversaciones_embeddings_embedding_idx
  ON public.conversaciones_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS conversaciones_embeddings_cliente_idx
  ON public.conversaciones_embeddings (cliente_id);

ALTER TABLE public.conversaciones_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversaciones_embeddings_allow_authenticated ON public.conversaciones_embeddings;
CREATE POLICY conversaciones_embeddings_allow_authenticated ON public.conversaciones_embeddings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Marca qué mensajes ya se agruparon/embebieron, para que el job de
-- procesamiento (ai-embeddings, action=procesar_pendientes) no repita trabajo.
ALTER TABLE public.mensajes ADD COLUMN IF NOT EXISTS embedding_procesado boolean DEFAULT false;

-- Insertar vía RPC (no vía POST directo a /rest/v1/conversaciones_embeddings)
-- para que PostgREST castee el array de números al tipo `vector` usando la
-- firma tipada de la función, en vez de depender de un cast implícito
-- JSON -> vector que no siempre es confiable desde supabase-js.
CREATE OR REPLACE FUNCTION public.insertar_embedding_conversacion(
  p_cliente_id bigint,
  p_contenido text,
  p_embedding vector(1536),
  p_fecha_inicio timestamptz,
  p_fecha_fin timestamptz,
  p_servicio text
) RETURNS uuid
LANGUAGE sql
AS $$
  INSERT INTO public.conversaciones_embeddings
    (cliente_id, contenido, embedding, fecha_inicio, fecha_fin, servicio)
  VALUES
    (p_cliente_id, p_contenido, p_embedding, p_fecha_inicio, p_fecha_fin, p_servicio)
  RETURNING id;
$$;

-- Búsqueda por similitud coseno. cliente_excluir se usa para no traer como
-- "caso parecido" la propia conversación del cliente que se está atendiendo.
CREATE OR REPLACE FUNCTION public.buscar_casos_similares(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  cliente_excluir bigint DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  cliente_id bigint,
  contenido text,
  servicio text,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  similitud float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ce.id,
    ce.cliente_id,
    ce.contenido,
    ce.servicio,
    ce.fecha_inicio,
    ce.fecha_fin,
    1 - (ce.embedding <=> query_embedding) AS similitud
  FROM public.conversaciones_embeddings ce
  WHERE cliente_excluir IS NULL OR ce.cliente_id IS DISTINCT FROM cliente_excluir
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- OPCIONAL — automatizar el procesamiento con pg_cron + pg_net (requiere
-- habilitar ambas extensiones desde Database > Extensions en el dashboard
-- de Supabase; no todos los planes las tienen disponibles). Reemplazá
-- <PROJECT_REF>, <SERVICE_ROLE_KEY> y <CRON_SECRET> antes de correr esto —
-- NUNCA commitear esos valores reales a git.
-- ─────────────────────────────────────────────────────────────────────────
-- select cron.schedule(
--   'procesar-embeddings-conversaciones',
--   '*/30 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/ai-embeddings',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--     ),
--     body := jsonb_build_object('action', 'procesar_pendientes', 'secret', '<CRON_SECRET>')
--   ) as request_id;
--   $$
-- );
