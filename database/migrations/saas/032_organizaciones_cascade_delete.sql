-- Migración 032: permitir borrar una organización directamente desde la base
-- de datos (Studio/SQL) sin que las foreign keys lo bloqueen.
--
-- Motivo: al intentar `DELETE FROM organizaciones WHERE id = '...'` falló
-- con "Key (id)=(...) is still referenced from table clientes" porque
-- clientes_organization_id_fkey (y otras 27 FKs más hacia organizaciones)
-- no tenían ON DELETE CASCADE — quedaron así porque fueron creadas en
-- distintos momentos del proyecto sin un ON DELETE explícito, a diferencia
-- de las 10 tablas (configuracion_bot, etiquetas, ia_workflows, etc.) que
-- ya lo tenían.
--
-- Todo lo que cuelga de clientes.id (mensajes, documentos, historial,
-- formularios, relaciones) ya tenía ON DELETE CASCADE, así que una vez que
-- clientes cae en cascada, el resto cae solo. No hacía falta tocar esa capa.
--
-- ADVERTENCIA: después de esta migración, borrar una fila de organizaciones
-- borra en cascada TODOS los datos de esa organización en las tablas de
-- abajo (clientes, mensajes, documentos, pagos, trámites, chats, etc.).
-- Es irreversible. Pensado para limpieza manual vía SQL/Studio, no para
-- que la app dispare un DELETE por accidente desde la UI.

-- === FKs directas a organizaciones sin ON DELETE (28 tablas) ===
-- Postgres no permite ALTER CONSTRAINT para cambiar la regla de borrado:
-- hay que dropear y recrear cada una con el mismo nombre.

ALTER TABLE public.ai_chats DROP CONSTRAINT ai_chats_organization_id_fkey;
ALTER TABLE public.ai_chats ADD CONSTRAINT ai_chats_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.biblioteca_multimedia DROP CONSTRAINT biblioteca_multimedia_organization_id_fkey;
ALTER TABLE public.biblioteca_multimedia ADD CONSTRAINT biblioteca_multimedia_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.chat_equipo DROP CONSTRAINT chat_equipo_organization_id_fkey;
ALTER TABLE public.chat_equipo ADD CONSTRAINT chat_equipo_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.chat_privado DROP CONSTRAINT chat_privado_organization_id_fkey;
ALTER TABLE public.chat_privado ADD CONSTRAINT chat_privado_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.clientes DROP CONSTRAINT clientes_organization_id_fkey;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.config_campos_clientes DROP CONSTRAINT config_campos_clientes_organization_id_fkey;
ALTER TABLE public.config_campos_clientes ADD CONSTRAINT config_campos_clientes_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.configuraciones_app DROP CONSTRAINT configuraciones_app_organization_id_fkey;
ALTER TABLE public.configuraciones_app ADD CONSTRAINT configuraciones_app_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.documentos_pendientes DROP CONSTRAINT documentos_pendientes_organization_id_fkey;
ALTER TABLE public.documentos_pendientes ADD CONSTRAINT documentos_pendientes_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.entradas DROP CONSTRAINT entradas_organization_id_fkey;
ALTER TABLE public.entradas ADD CONSTRAINT entradas_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.eventos_n8n DROP CONSTRAINT eventos_n8n_organization_id_fkey;
ALTER TABLE public.eventos_n8n ADD CONSTRAINT eventos_n8n_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.formularios_clientes DROP CONSTRAINT formularios_clientes_organization_id_fkey;
ALTER TABLE public.formularios_clientes ADD CONSTRAINT formularios_clientes_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.historial_cambios DROP CONSTRAINT historial_cambios_organization_id_fkey;
ALTER TABLE public.historial_cambios ADD CONSTRAINT historial_cambios_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.historial_clientes DROP CONSTRAINT historial_clientes_organization_id_fkey;
ALTER TABLE public.historial_clientes ADD CONSTRAINT historial_clientes_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.integraciones_kommo DROP CONSTRAINT integraciones_kommo_organization_id_fkey;
ALTER TABLE public.integraciones_kommo ADD CONSTRAINT integraciones_kommo_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.integraciones_n8n DROP CONSTRAINT integraciones_n8n_organization_id_fkey;
ALTER TABLE public.integraciones_n8n ADD CONSTRAINT integraciones_n8n_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.kommo_field_mappings DROP CONSTRAINT kommo_field_mappings_organization_id_fkey;
ALTER TABLE public.kommo_field_mappings ADD CONSTRAINT kommo_field_mappings_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.kommo_stage_mappings DROP CONSTRAINT kommo_stage_mappings_organization_id_fkey;
ALTER TABLE public.kommo_stage_mappings ADD CONSTRAINT kommo_stage_mappings_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.mensajes DROP CONSTRAINT mensajes_organization_id_fkey;
ALTER TABLE public.mensajes ADD CONSTRAINT mensajes_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.notas_tramite DROP CONSTRAINT notas_tramite_organization_id_fkey;
ALTER TABLE public.notas_tramite ADD CONSTRAINT notas_tramite_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.notificaciones_equipo DROP CONSTRAINT notificaciones_equipo_organization_id_fkey;
ALTER TABLE public.notificaciones_equipo ADD CONSTRAINT notificaciones_equipo_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.operarios DROP CONSTRAINT operarios_organization_id_fkey;
ALTER TABLE public.operarios ADD CONSTRAINT operarios_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.plantillas_documentos DROP CONSTRAINT plantillas_documentos_organization_id_fkey;
ALTER TABLE public.plantillas_documentos ADD CONSTRAINT plantillas_documentos_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.relaciones_clientes DROP CONSTRAINT relaciones_clientes_organization_id_fkey;
ALTER TABLE public.relaciones_clientes ADD CONSTRAINT relaciones_clientes_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.salidas DROP CONSTRAINT salidas_organization_id_fkey;
ALTER TABLE public.salidas ADD CONSTRAINT salidas_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.tramites_catalogo DROP CONSTRAINT tramites_catalogo_organization_id_fkey;
ALTER TABLE public.tramites_catalogo ADD CONSTRAINT tramites_catalogo_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.tramites_categorias DROP CONSTRAINT tramites_categorias_organization_id_fkey;
ALTER TABLE public.tramites_categorias ADD CONSTRAINT tramites_categorias_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.tramites_precios DROP CONSTRAINT tramites_precios_organization_id_fkey;
ALTER TABLE public.tramites_precios ADD CONSTRAINT tramites_precios_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

ALTER TABLE public.tramites_requisitos DROP CONSTRAINT tramites_requisitos_organization_id_fkey;
ALTER TABLE public.tramites_requisitos ADD CONSTRAINT tramites_requisitos_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;

-- === perfiles: no tenía ninguna FK hacia organizaciones (columna suelta) ===
-- Sin esto, borrar una organización dejaba perfiles.organization_id
-- apuntando a una fila inexistente: los miembros de esa organización
-- seguían pudiendo loguearse (perfiles.id -> auth.users no se toca) pero
-- con la cuenta rota (organization_id inválido). Se verificó antes de
-- aplicar esta migración que las 9 filas de perfiles en producción tienen
-- organization_id válido o null, así que agregar la FK no falla.
-- ON DELETE CASCADE aquí borra el PERFIL (pierde acceso a esa organización),
-- no la cuenta de auth.users — el usuario podría, en teoría, ser invitado
-- de nuevo a otra organización más adelante.
ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizaciones(id) ON DELETE CASCADE;
