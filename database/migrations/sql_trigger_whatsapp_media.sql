-- 1. Trigger BEFORE INSERT para asegurar que el cliente_id esté correcto basado en el teléfono
CREATE OR REPLACE FUNCTION trg_link_nota_kommo_to_client()
RETURNS TRIGGER AS $$
DECLARE
  real_cliente_id BIGINT;
BEGIN
  -- Intentar buscar el cliente por teléfono si viene el teléfono
  IF NEW.telefono IS NOT NULL THEN
    -- Busca coincidencia exacta o parcial (por si hay códigos de país extra)
    SELECT id INTO real_cliente_id 
    FROM clientes 
    WHERE regexp_replace(telefono, '\D', '', 'g') = regexp_replace(NEW.telefono, '\D', '', 'g') 
    LIMIT 1;

    -- Si encuentra un cliente por teléfono, actualiza el cliente_id de la nota
    IF real_cliente_id IS NOT NULL THEN
      NEW.cliente_id := real_cliente_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_whatsapp_media_insert ON notas_kommo;

CREATE TRIGGER before_whatsapp_media_insert
BEFORE INSERT ON notas_kommo
FOR EACH ROW
EXECUTE FUNCTION trg_link_nota_kommo_to_client();

-- 2. Trigger AFTER INSERT para crear el documento si hay multimedia
CREATE OR REPLACE FUNCTION trg_insert_document_from_whatsapp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.media_url IS NOT NULL THEN
    INSERT INTO documentos_pendientes (
      cliente_id,
      url_archivo,
      nombre_archivo,
      origen,
      fecha_recepcion,
      verificado
    ) VALUES (
      NEW.cliente_id, -- Ahora esto siempre tendrá el ID correcto gracias al trigger anterior
      NEW.media_url,
      COALESCE(NEW.media_name, 'Archivo de WhatsApp'),
      'WhatsApp',
      COALESCE(NEW.fecha_recepcion, now()),
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_whatsapp_media_insert ON notas_kommo;

CREATE TRIGGER after_whatsapp_media_insert
AFTER INSERT ON notas_kommo
FOR EACH ROW
EXECUTE FUNCTION trg_insert_document_from_whatsapp();
