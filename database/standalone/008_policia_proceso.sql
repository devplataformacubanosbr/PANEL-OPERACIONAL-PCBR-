-- Descripción del proceso/trámite específico de cada posto (distinta de
-- "notas", que queda para requisitos u observaciones cortas).

BEGIN;

ALTER TABLE policias ADD COLUMN IF NOT EXISTS proceso text;

COMMIT;
