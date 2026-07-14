-- DEPRECADO 2026-07-11 — no ejecutar.
-- Este script es anterior a la multi-tenencia: abría entradas/salidas/clientes
-- a "anon, authenticated" con USING (true), sin ningún filtro de organización.
-- El aislamiento real por tenant para estas tres tablas ya lo cubre
-- saas/03_create_rls_helpers_and_policies.sql (tenant_isolation_policy), que
-- además hace DROP de cualquier policy previa sobre ellas antes de recrear la
-- correcta — volver a correr saas/03 es el remedio si esta apertura llegó a
-- aplicarse alguna vez. Ver auditoría 2026-07-11, hallazgo crítico
-- "Políticas RLS USING(true)".
--
-- Se conserva solo por su valor histórico/realtime (abajo), no por su RLS.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'entradas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.entradas;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'salidas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.salidas;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'clientes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
  END IF;
END $$;
