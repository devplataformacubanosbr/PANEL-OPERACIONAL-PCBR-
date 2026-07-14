-- 021_n8n_entradas_defaults_trigger.sql
-- Este trigger reemplaza el trg_set_org_entradas original para manejar los casos en que n8n
-- u otra integración externa inserta un registro sin organization_id, pipeline_id o stage_id.

CREATE OR REPLACE FUNCTION public.auto_set_n8n_entradas_defaults()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id uuid;
  v_pipeline_id uuid;
  v_stage_id uuid;
BEGIN
  -- 1. Resolver organization_id
  IF NEW.organization_id IS NULL THEN
    -- Intentar obtener de auth.uid() primero
    IF auth.uid() IS NOT NULL THEN
      v_org_id := (SELECT organization_id FROM public.perfiles WHERE id = auth.uid() LIMIT 1);
    END IF;
    
    -- Si sigue siendo null (ej. insertado por n8n via API Key), asignar a la primera organización
    IF v_org_id IS NULL THEN
      v_org_id := (SELECT id FROM public.organizaciones ORDER BY creado_en ASC LIMIT 1);
    END IF;
    
    NEW.organization_id := v_org_id;
  ELSE
    v_org_id := NEW.organization_id;
  END IF;

  -- 2. Resolver pipeline_id
  IF NEW.pipeline_id IS NULL AND v_org_id IS NOT NULL THEN
    v_pipeline_id := (
      SELECT id FROM public.pipelines 
      WHERE organization_id = v_org_id 
      ORDER BY es_predeterminado DESC, orden ASC 
      LIMIT 1
    );
    NEW.pipeline_id := v_pipeline_id;
  ELSE
    v_pipeline_id := NEW.pipeline_id;
  END IF;

  -- 3. Resolver stage_id
  IF NEW.stage_id IS NULL AND v_pipeline_id IS NOT NULL THEN
    v_stage_id := (
      SELECT id FROM public.pipeline_etapas 
      WHERE pipeline_id = v_pipeline_id 
      ORDER BY orden ASC 
      LIMIT 1
    );
    NEW.stage_id := v_stage_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reemplazar el trigger anterior para la tabla entradas
DROP TRIGGER IF EXISTS trg_set_org_entradas ON public.entradas;
CREATE TRIGGER trg_set_org_entradas
  BEFORE INSERT ON public.entradas
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_n8n_entradas_defaults();


-- REPARACIÓN DE REGISTROS EXISTENTES:
-- Si ya entraron clientes por n8n recientemente y están "invisibles", 
-- este bloque los reparará asignándoles el pipeline por defecto.
DO $$
DECLARE
  org record;
  v_pipeline_id uuid;
  v_stage_id uuid;
BEGIN
  FOR org IN
    SELECT DISTINCT COALESCE(organization_id, (SELECT id FROM public.organizaciones ORDER BY creado_en ASC LIMIT 1)) AS org_id
    FROM public.entradas
    WHERE pipeline_id IS NULL
  LOOP
    -- Obtener pipeline por defecto de la organización
    SELECT id INTO v_pipeline_id 
    FROM public.pipelines 
    WHERE organization_id = org.org_id 
    ORDER BY es_predeterminado DESC, orden ASC 
    LIMIT 1;

    -- Obtener stage por defecto de ese pipeline
    SELECT id INTO v_stage_id 
    FROM public.pipeline_etapas 
    WHERE pipeline_id = v_pipeline_id 
    ORDER BY orden ASC 
    LIMIT 1;

    -- Actualizar las entradas invisibles
    IF v_pipeline_id IS NOT NULL AND v_stage_id IS NOT NULL THEN
      UPDATE public.entradas 
      SET 
        organization_id = COALESCE(organization_id, org.org_id),
        pipeline_id = v_pipeline_id,
        stage_id = v_stage_id
      WHERE pipeline_id IS NULL;
    END IF;
  END LOOP;
END $$;
