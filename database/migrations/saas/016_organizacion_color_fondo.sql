-- 016_organizacion_color_fondo.sql
-- Segundo color de marca: fondo de la app (complementa color_primario de 015_organizacion_branding.sql)

ALTER TABLE public.organizaciones
  ADD COLUMN IF NOT EXISTS color_fondo TEXT;
