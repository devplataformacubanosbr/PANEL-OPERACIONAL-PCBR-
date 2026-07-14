-- 032_organizaciones_config_cabecera_default_telefono_email.sql
-- El nombre del cliente ya se muestra siempre como título del header (ClientViewHeader.jsx),
-- fuera de esta configuración. Campos como CPF/Origen son específicos de Brasil y no aplican
-- a todas las agencias del SaaS, así que se deja el header por defecto solo con Teléfono + Email
-- para todas las organizaciones (nuevas y existentes).

ALTER TABLE public.organizaciones
ALTER COLUMN config_cabecera_cliente SET DEFAULT '["telefono", "email"]'::jsonb;

UPDATE public.organizaciones
SET config_cabecera_cliente = '["telefono", "email"]'::jsonb;
