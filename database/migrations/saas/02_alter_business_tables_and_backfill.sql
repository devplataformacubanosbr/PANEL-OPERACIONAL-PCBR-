-- 2. Alter all 27 business tables and backfill default organization ID
--
-- Corregido: todas las FK apuntaban a `public.organizations` (tabla que nunca
-- existió en producción real); la tabla real es `public.organizaciones`. Ver
-- auditoría 2026-07-11 / 01_create_organizations.sql. Los pasos ADD COLUMN IF
-- NOT EXISTS / UPDATE ... WHERE organization_id IS NULL / SET NOT NULL son
-- no-ops seguros si ya se aplicaron (caso real hoy); solo el DROP+ADD
-- CONSTRAINT se re-ejecuta, y es idempotente (recrea la misma FK correcta).

-- Table 1: ai_chats
ALTER TABLE public.ai_chats ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.ai_chats SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.ai_chats ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.ai_chats DROP CONSTRAINT IF EXISTS ai_chats_organization_id_fkey;
ALTER TABLE public.ai_chats ADD CONSTRAINT ai_chats_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 2: biblioteca_multimedia
ALTER TABLE public.biblioteca_multimedia ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.biblioteca_multimedia SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.biblioteca_multimedia ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.biblioteca_multimedia DROP CONSTRAINT IF EXISTS biblioteca_multimedia_organization_id_fkey;
ALTER TABLE public.biblioteca_multimedia ADD CONSTRAINT biblioteca_multimedia_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 3: campos_datos_operacionales
ALTER TABLE public.campos_datos_operacionales ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.campos_datos_operacionales SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.campos_datos_operacionales ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.campos_datos_operacionales DROP CONSTRAINT IF EXISTS campos_datos_operacionales_organization_id_fkey;
ALTER TABLE public.campos_datos_operacionales ADD CONSTRAINT campos_datos_operacionales_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 4: categorias_datos_operacionales
ALTER TABLE public.categorias_datos_operacionales ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.categorias_datos_operacionales SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.categorias_datos_operacionales ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.categorias_datos_operacionales DROP CONSTRAINT IF EXISTS categorias_datos_operacionales_organization_id_fkey;
ALTER TABLE public.categorias_datos_operacionales ADD CONSTRAINT categorias_datos_operacionales_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 5: chat_equipo
ALTER TABLE public.chat_equipo ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.chat_equipo SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.chat_equipo ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.chat_equipo DROP CONSTRAINT IF EXISTS chat_equipo_organization_id_fkey;
ALTER TABLE public.chat_equipo ADD CONSTRAINT chat_equipo_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 6: chat_privado
ALTER TABLE public.chat_privado ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.chat_privado SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.chat_privado ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.chat_privado DROP CONSTRAINT IF EXISTS chat_privado_organization_id_fkey;
ALTER TABLE public.chat_privado ADD CONSTRAINT chat_privado_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 7: cliente_datos_operacionales
ALTER TABLE public.cliente_datos_operacionales ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.cliente_datos_operacionales SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.cliente_datos_operacionales ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cliente_datos_operacionales DROP CONSTRAINT IF EXISTS cliente_datos_operacionales_organization_id_fkey;
ALTER TABLE public.cliente_datos_operacionales ADD CONSTRAINT cliente_datos_operacionales_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 8: clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.clientes SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.clientes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_organization_id_fkey;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 9: configuraciones_app
ALTER TABLE public.configuraciones_app ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.configuraciones_app SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.configuraciones_app ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.configuraciones_app DROP CONSTRAINT IF EXISTS configuraciones_app_organization_id_fkey;
ALTER TABLE public.configuraciones_app ADD CONSTRAINT configuraciones_app_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 10: documentos_operacionales
ALTER TABLE public.documentos_operacionales ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.documentos_operacionales SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.documentos_operacionales ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.documentos_operacionales DROP CONSTRAINT IF EXISTS documentos_operacionales_organization_id_fkey;
ALTER TABLE public.documentos_operacionales ADD CONSTRAINT documentos_operacionales_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 11: documentos_pendientes
ALTER TABLE public.documentos_pendientes ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.documentos_pendientes SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.documentos_pendientes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.documentos_pendientes DROP CONSTRAINT IF EXISTS documentos_pendientes_organization_id_fkey;
ALTER TABLE public.documentos_pendientes ADD CONSTRAINT documentos_pendientes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 12: entradas
ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.entradas SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.entradas ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.entradas DROP CONSTRAINT IF EXISTS entradas_organization_id_fkey;
ALTER TABLE public.entradas ADD CONSTRAINT entradas_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 13: estadisticas_agenda
ALTER TABLE public.estadisticas_agenda ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.estadisticas_agenda SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.estadisticas_agenda ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.estadisticas_agenda DROP CONSTRAINT IF EXISTS estadisticas_agenda_organization_id_fkey;
ALTER TABLE public.estadisticas_agenda ADD CONSTRAINT estadisticas_agenda_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 14: formularios_clientes
ALTER TABLE public.formularios_clientes ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.formularios_clientes SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.formularios_clientes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.formularios_clientes DROP CONSTRAINT IF EXISTS formularios_clientes_organization_id_fkey;
ALTER TABLE public.formularios_clientes ADD CONSTRAINT formularios_clientes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 15: historial_cambios
ALTER TABLE public.historial_cambios ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.historial_cambios SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.historial_cambios ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.historial_cambios DROP CONSTRAINT IF EXISTS historial_cambios_organization_id_fkey;
ALTER TABLE public.historial_cambios ADD CONSTRAINT historial_cambios_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 16: historial_clientes
ALTER TABLE public.historial_clientes ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.historial_clientes SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.historial_clientes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.historial_clientes DROP CONSTRAINT IF EXISTS historial_clientes_organization_id_fkey;
ALTER TABLE public.historial_clientes ADD CONSTRAINT historial_clientes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 17: notas_kommo
ALTER TABLE public.notas_kommo ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.notas_kommo SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.notas_kommo ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.notas_kommo DROP CONSTRAINT IF EXISTS notas_kommo_organization_id_fkey;
ALTER TABLE public.notas_kommo ADD CONSTRAINT notas_kommo_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 18: notas_tramite
ALTER TABLE public.notas_tramite ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.notas_tramite SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.notas_tramite ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.notas_tramite DROP CONSTRAINT IF EXISTS notas_tramite_organization_id_fkey;
ALTER TABLE public.notas_tramite ADD CONSTRAINT notas_tramite_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 19: notificaciones_equipo
ALTER TABLE public.notificaciones_equipo ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.notificaciones_equipo SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.notificaciones_equipo ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.notificaciones_equipo DROP CONSTRAINT IF EXISTS notificaciones_equipo_organization_id_fkey;
ALTER TABLE public.notificaciones_equipo ADD CONSTRAINT notificaciones_equipo_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 20: operarios
ALTER TABLE public.operarios ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.operarios SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.operarios ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.operarios DROP CONSTRAINT IF EXISTS operarios_organization_id_fkey;
ALTER TABLE public.operarios ADD CONSTRAINT operarios_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 21: perfiles
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.perfiles SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.perfiles ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_organization_id_fkey;
ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 22: plantillas_documentos
ALTER TABLE public.plantillas_documentos ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.plantillas_documentos SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.plantillas_documentos ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.plantillas_documentos DROP CONSTRAINT IF EXISTS plantillas_documentos_organization_id_fkey;
ALTER TABLE public.plantillas_documentos ADD CONSTRAINT plantillas_documentos_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 23: relaciones_clientes
ALTER TABLE public.relaciones_clientes ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.relaciones_clientes SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.relaciones_clientes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.relaciones_clientes DROP CONSTRAINT IF EXISTS relaciones_clientes_organization_id_fkey;
ALTER TABLE public.relaciones_clientes ADD CONSTRAINT relaciones_clientes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 24: salidas
ALTER TABLE public.salidas ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.salidas SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.salidas ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.salidas DROP CONSTRAINT IF EXISTS salidas_organization_id_fkey;
ALTER TABLE public.salidas ADD CONSTRAINT salidas_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 25: tramites_catalogo
ALTER TABLE public.tramites_catalogo ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.tramites_catalogo SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.tramites_catalogo ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.tramites_catalogo DROP CONSTRAINT IF EXISTS tramites_catalogo_organization_id_fkey;
ALTER TABLE public.tramites_catalogo ADD CONSTRAINT tramites_catalogo_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 26: tramites_categorias
ALTER TABLE public.tramites_categorias ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.tramites_categorias SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.tramites_categorias ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.tramites_categorias DROP CONSTRAINT IF EXISTS tramites_categorias_organization_id_fkey;
ALTER TABLE public.tramites_categorias ADD CONSTRAINT tramites_categorias_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- Table 27: tramites_precios
ALTER TABLE public.tramites_precios ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE public.tramites_precios SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
ALTER TABLE public.tramites_precios ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.tramites_precios DROP CONSTRAINT IF EXISTS tramites_precios_organization_id_fkey;
ALTER TABLE public.tramites_precios ADD CONSTRAINT tramites_precios_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;
