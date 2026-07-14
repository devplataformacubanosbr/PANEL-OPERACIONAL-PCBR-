-- 019_organizacion_color_texto.sql
-- Tercer color de marca: color de letra/texto. Si es NULL (default), el texto se sigue
-- calculando automáticamente según el contraste del color_fondo (ver OrganizationContext.jsx).
-- Si se define, pisa ese cálculo automático.

ALTER TABLE public.organizaciones
  ADD COLUMN IF NOT EXISTS color_texto TEXT;
