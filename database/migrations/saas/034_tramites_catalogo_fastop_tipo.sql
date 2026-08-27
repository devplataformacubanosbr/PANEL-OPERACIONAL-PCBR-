-- 034_tramites_catalogo_fastop_tipo.sql
-- Discriminador para filas de tramites_catalogo que son "acciones FastOp"
-- (ej. checklists de PDF Único) en vez de trámites facturables reales.
-- fastop_tipo IS NULL -> trámite real. fastop_tipo = 'pdf_unico' -> variante
-- de PDF Único (contenedor de checklist en tramites_requisitos).

ALTER TABLE public.tramites_catalogo
ADD COLUMN IF NOT EXISTS fastop_tipo text;

-- Si alguna de las 3 variantes ya se había creado desde la UI antes de esta
-- migración (con codigo en blanco, por un bug ya corregido), la marcamos acá
-- en vez de dejarla huérfana -- así no termina duplicada por el INSERT de abajo.
UPDATE public.tramites_catalogo
SET codigo = 'PDF_UNICO_FLORIANOPOLIS', fastop_tipo = 'pdf_unico'
WHERE nombre = 'PDF ÚNICO FLORIANÓPOLIS' AND fastop_tipo IS NULL;

UPDATE public.tramites_catalogo
SET codigo = 'PDF_UNICO_ITAJAI', fastop_tipo = 'pdf_unico'
WHERE nombre = 'PDF ÚNICO ITAJAÍ' AND fastop_tipo IS NULL;

UPDATE public.tramites_catalogo
SET codigo = 'PDF_UNICO_JOINVILLE', fastop_tipo = 'pdf_unico'
WHERE nombre = 'PDF ÚNICO JOINVILLE' AND fastop_tipo IS NULL;

-- Semilla: crea las que todavía no existan.
INSERT INTO public.tramites_catalogo (nombre, codigo, fastop_tipo, costo, activo)
SELECT v.nombre, v.codigo, 'pdf_unico', 0, true
FROM (VALUES
  ('PDF ÚNICO FLORIANÓPOLIS', 'PDF_UNICO_FLORIANOPOLIS'),
  ('PDF ÚNICO ITAJAÍ', 'PDF_UNICO_ITAJAI'),
  ('PDF ÚNICO JOINVILLE', 'PDF_UNICO_JOINVILLE')
) AS v(nombre, codigo)
WHERE NOT EXISTS (
  SELECT 1 FROM public.tramites_catalogo t WHERE t.nombre = v.nombre
);
