import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  try {
    const url = new URL(req.url);
    // Empresa única: el secreto solo autentica el origen del request, ya no
    // hace falta resolver una organización a partir de él.
    const secret = url.searchParams.get('secret');

    if (!secret) {
      console.error("Kommo webhook: falta el parámetro 'secret'.");
      return new Response('Unauthorized', { status: 401 });
    }

    const { data: creds, error: credsError } = await supabaseClient
      .from('integraciones_kommo')
      .select('*')
      .eq('webhook_secret', secret)
      .single();

    if (credsError || !creds) {
      console.error("Kommo webhook: secret inválido o no reconocido.");
      return new Response('Forbidden', { status: 403 });
    }

    // Kommo sends webhooks as application/x-www-form-urlencoded
    const formData = await req.formData().catch(() => null);
    let payload: any = {};

    if (formData) {
      for (const [key, value] of formData.entries()) {
        payload[key] = value;
      }
    } else {
        payload = await req.json().catch(() => ({}));
    }

    // No loguear el payload completo: trae PII (nombre, CPF, pasaporte, etc.)
    console.log("Kommo webhook recibido");

    const { data: mappingsData } = await supabaseClient
      .from('kommo_field_mappings')
      .select('*');

    const mappings = mappingsData || [];

    const baseUrl = `https://${creds.subdominio}.kommo.com/api/v4`;
    const kommoHeaders = {
        'Authorization': `Bearer ${creds.token}`,
        'Content-Type': 'application/json'
    };

    // Para procesar, necesitamos estructurar la data plana de kommo en un objeto
    // Kommo manda cosas como contacts[add][0][custom_fields][0][id] = 1234
    // Es más fácil extraer todo buscando prefijos.
    const extractFields = (entity: string, action: string) => {
        const prefix = `${entity}[${action}][0]`;
        if (!payload[`${prefix}[id]`]) return null;

        let data: any = { id: payload[`${prefix}[id]`], name: payload[`${prefix}[name]`], custom_fields: [] };

        // Buscar custom fields
        let i = 0;
        while (payload[`${prefix}[custom_fields][${i}][id]`] !== undefined) {
            let cfId = payload[`${prefix}[custom_fields][${i}][id]`];
            // Un custom field puede tener múltiples valores
            let j = 0;
            let values = [];
            while (payload[`${prefix}[custom_fields][${i}][values][${j}][value]`] !== undefined) {
                values.push(payload[`${prefix}[custom_fields][${i}][values][${j}][value]`]);
                j++;
            }
            if (values.length > 0) {
                data.custom_fields.push({ id: cfId, values });
            }
            i++;
        }
        return data;
    }

    let contactData = extractFields('contacts', 'add') || extractFields('contacts', 'update');
    let leadData = extractFields('leads', 'add') || extractFields('leads', 'update');

    // Kommo manda "se agregó una nota a un lead" con una forma de payload distinta a
    // leads[add]/leads[update]: leads[note][add][0][element_id] es el id del lead, no
    // leads[add][0][id]. Sin esto, agregar una nota sin tocar otro campo del lead nunca
    // entraba al bloque que sincroniza trámites/notas.
    const noteAddLeadId = payload['leads[note][add][0][element_id]'];

    // Igual que las notas: "el lead cambió de etapa" llega como leads[status], no como
    // leads[update]. pipeline_id + status_id identifican la columna exacta en Kommo.
    const statusChangeLeadId = payload['leads[status][0][id]'];
    const statusChangeStatusId = payload['leads[status][0][status_id]'];
    const statusChangePipelineId = payload['leads[status][0][pipeline_id]'];

    // Trae y guarda (sin duplicar) las notas de texto de un lead de Kommo en notas_tramite.
    const syncKommoNotes = async (tramiteId: number, kommoLeadId: string | number) => {
        const resNotes = await fetch(`${baseUrl}/leads/${kommoLeadId}/notes`, { headers: kommoHeaders });
        if (!resNotes.ok) return;

        const notesData = await resNotes.json();
        const notes = notesData._embedded?.notes || [];

        // notas_tramite no tiene columna `origen`; reutilizamos `creado_por`
        // (ya existe, default 'operador') para distinguir notas sincronizadas de Kommo.
        const { data: existingDbNotes } = await supabaseClient.from('notas_tramite')
            .select('id, texto')
            .eq('entrada_id', tramiteId)
            .eq('creado_por', 'kommo');

        const existingTexts = new Set(existingDbNotes?.map(n => n.texto) || []);

        for (const note of notes) {
            // note_type 'common' (4)
            if (note.note_type === 'common' || note.note_type === 'message') {
                const text = note.params?.text || note.params?.message || '';
                if (text && !existingTexts.has(text)) {
                    await supabaseClient.from('notas_tramite').insert({
                        entrada_id: tramiteId,
                        texto: text,
                        creado_por: 'kommo',
                        creado_en: new Date(note.created_at * 1000).toISOString()
                    });
                }
            }
        }
    };

    // Crea o actualiza el cliente correspondiente a un contacto de Kommo (aplica mapeos de
    // campos ya configurados). Devuelve el id del cliente en nuestra base, o null.
    // NOTA: `local_field_type === 'fixed'` es una columna real de `clientes`
    // (incluye los 13 campos migratorios: rnm, pasaporte, etc.) y se escribe
    // directo en fixedUpdates[mapping.local_field].
    // `local_field_type === 'json'` es un campo dinámico creado desde
    // Configuración > Campos Base (tabla config_campos_clientes) SIN columna
    // propia — se acumula en jsonUpdates y al final se mergea dentro de
    // clientes.campos_personalizados (junto con lo que ya hubiera guardado).
    const processContact = async (data: any): Promise<number | null> => {
        let fixedUpdates: any = { id_kommo: data.id.toString() };
        let jsonUpdates: any = {};
        let identifierValue: string | null = null;

        const nameMapping = mappings.find(m => m.kommo_entity === 'contacts' && m.kommo_field_id === 'name');
        if (nameMapping) {
            if (nameMapping.local_field_type === 'json') {
                jsonUpdates[nameMapping.local_field] = data.name?.toUpperCase();
            } else if (nameMapping.local_field_type === 'fixed') {
                fixedUpdates[nameMapping.local_field] = data.name?.toUpperCase();
            }
        } else {
            fixedUpdates.nombre = data.name?.toUpperCase() || 'Sin Nombre';
        }

        for (const cf of data.custom_fields) {
            const mapping = mappings.find(m => m.kommo_entity === 'contacts' && m.kommo_field_id === cf.id.toString());
            if (mapping) {
                let val = cf.values[0]?.toUpperCase() || '';

                if (mapping.is_identifier && val) {
                    identifierValue = val;
                }

                if (mapping.local_field_type === 'json') {
                    jsonUpdates[mapping.local_field] = val;
                } else if (mapping.local_field_type === 'fixed') {
                    fixedUpdates[mapping.local_field] = val;
                }
            }
        }

        let existingClient: any = null;

        const { data: byKommoId } = await supabaseClient.from('clientes')
            .select('id, campos_personalizados')
            .eq('id_kommo', data.id.toString())
            .single();

        if (byKommoId) {
            existingClient = byKommoId;
        } else if (identifierValue) {
            const idMapping = mappings.find(m => m.is_identifier && m.kommo_entity === 'contacts');
            if (idMapping) {
                const { data: byFixed } = await supabaseClient.from('clientes')
                    .select('id, campos_personalizados')
                    .eq(idMapping.local_field, identifierValue)
                    .single();
                if (byFixed) existingClient = byFixed;
            }
        }

        if (Object.keys(jsonUpdates).length > 0) {
            fixedUpdates.campos_personalizados = { ...(existingClient?.campos_personalizados || {}), ...jsonUpdates };
        }

        if (existingClient) {
            await supabaseClient.from('clientes').update(fixedUpdates).eq('id', existingClient.id);
            return existingClient.id;
        } else {
            const { data: newClient } = await supabaseClient.from('clientes').insert(fixedUpdates).select('id').single();
            return newClient?.id ?? null;
        }
    };

    // Crea o actualiza el trámite (entradas) correspondiente a un lead de Kommo, y sincroniza
    // sus notas. defaultServicio se usa si no hay un campo mapeado a "servicio" en el lead
    // (ver mapping.local_field === 'servicio' más abajo); devuelve el servicio ya resuelto
    // para que quien llame pueda reflejarlo también en clientes.tramite.
    // Campos de un lead de Kommo que en este sistema viven en la ficha del CLIENTE (no en el
    // trámite) — ej. país/ciudad/estado/policía federal/atendente, que en Kommo suelen estar
    // en el lead pero acá son columnas de `clientes`.
    const LEAD_MAPPED_CLIENT_FIELDS = ['pais', 'ciudad', 'estado_federal', 'policia_federal', 'atendente'];

    const processLead = async (data: any, dbClientId: number, defaultServicio: string): Promise<{ tramiteId: number | null, servicio: string }> => {
        let trFixedUpdates: any = {};
        let trDatosPersonalizados: any = {};
        let clienteUpdatesFromLead: any = {};
        let trServicio = defaultServicio;

        for (const cf of data.custom_fields) {
            const mapping = mappings.find(m => m.kommo_entity === 'leads' && m.kommo_field_id === cf.id.toString());
            if (mapping) {
                let val = cf.values[0]?.toUpperCase() || '';
                if (mapping.local_field_type === 'json') {
                     trDatosPersonalizados[mapping.local_field] = val;
                } else if (mapping.local_field === 'servicio') {
                     trServicio = val;
                } else if (mapping.local_field === 'nombre_pix') {
                     trFixedUpdates.nombre_pix = val;
                } else if (LEAD_MAPPED_CLIENT_FIELDS.includes(mapping.local_field)) {
                     clienteUpdatesFromLead[mapping.local_field] = val;
                }
            }
        }

        if (Object.keys(clienteUpdatesFromLead).length > 0) {
            await supabaseClient.from('clientes').update(clienteUpdatesFromLead).eq('id', dbClientId);
        }

        // La tabla real es `entradas` (no `entradas_tramites`, que no existe), y ya trae una
        // columna dedicada y única `id_lead` para justamente este propósito: usarla en vez de
        // escanear datos_personalizados evita una tabla inexistente y un scan en JS.
        const kommoLeadId = parseInt(data.id, 10);

        const { data: existingTramite } = await supabaseClient.from('entradas')
            .select('id, datos_personalizados')
            .eq('id_lead', kommoLeadId)
            .single();

        let tramiteId = existingTramite?.id ?? null;

        if (existingTramite) {
            await supabaseClient.from('entradas').update({
                servicio: trServicio,
                ...trFixedUpdates,
                datos_personalizados: { ...existingTramite.datos_personalizados, ...trDatosPersonalizados }
            }).eq('id', tramiteId);
        } else {
            let finalPipelineId = null;
            let finalStageId = null;

            try {
                const { data: pipelines } = await supabaseClient
                    .from('pipelines')
                    .select('*')
                    .eq('activo', true)
                    .order('orden', { ascending: true });
                    
                if (pipelines && pipelines.length > 0) {
                    const target = pipelines.find(p => p.es_predeterminado) || pipelines[0];
                    finalPipelineId = target.id;
                    
                    const { data: stages } = await supabaseClient
                        .from('pipeline_etapas')
                        .select('id')
                        .eq('pipeline_id', target.id)
                        .eq('activo', true)
                        .order('orden', { ascending: true })
                        .limit(1);
                        
                    if (stages && stages.length > 0) {
                        finalStageId = stages[0].id;
                    }
                }
            } catch (err) {
                console.error('Error resolving default pipeline in webhook:', err);
            }

            const { data: newTr } = await supabaseClient.from('entradas').insert({
                id_cliente: dbClientId,
                servicio: trServicio,
                estado_tramite: 'pendiente',
                pipeline_id: finalPipelineId,
                stage_id: finalStageId,
                id_lead: kommoLeadId,
                ...trFixedUpdates,
                datos_personalizados: trDatosPersonalizados
            }).select('id').single();
            tramiteId = newTr?.id ?? null;
        }

        if (tramiteId) {
            await syncKommoNotes(tramiteId, data.id);
        }

        return { tramiteId, servicio: trServicio };
    };

    // Normaliza la forma de custom_fields_values que devuelve la API de Kommo
    // (field_id + values[].value) a la misma forma { id, values: [] } que usa extractFields
    // con los webhooks, para poder reusar processContact/processLead con datos de la API.
    const normalizeApiCustomFields = (customFieldsValues: any[] | null) =>
        (customFieldsValues || []).map((cf: any) => ({
            id: cf.field_id,
            values: (cf.values || []).map((v: any) => v.value),
        }));

    // Un evento leads[status] no trae nombre ni custom_fields del lead/contacto — si todavía
    // no existe un trámite para ese lead, hay que pedirle los datos completos a la API de
    // Kommo antes de poder registrar el cliente y el trámite.
    const fetchKommoLeadAndContact = async (kommoLeadId: number) => {
        const resLead = await fetch(`${baseUrl}/leads/${kommoLeadId}?with=contacts,custom_fields_values`, { headers: kommoHeaders });
        if (!resLead.ok) return null;
        const lead = await resLead.json();

        const leadData = {
            id: lead.id,
            name: lead.name,
            custom_fields: normalizeApiCustomFields(lead.custom_fields_values),
        };

        const mainContactRef = (lead._embedded?.contacts || []).find((c: any) => c.is_main) || lead._embedded?.contacts?.[0];
        let contactData = null;
        if (mainContactRef) {
            const resContact = await fetch(`${baseUrl}/contacts/${mainContactRef.id}?with=custom_fields_values`, { headers: kommoHeaders });
            if (resContact.ok) {
                const contact = await resContact.json();
                contactData = {
                    id: contact.id,
                    name: contact.name,
                    custom_fields: normalizeApiCustomFields(contact.custom_fields_values),
                };
            }
        }

        return { leadData, contactData };
    };

    let dbClientId: number | null = null;

    // ==========================================
    // 1. PROCESAR CONTACTO -> CLIENTE
    // ==========================================
    // Solo corre si Kommo mandó contacts[add]/contacts[update] embebido en ESTE
    // request — muchas veces un lead nuevo llega en un webhook aparte sin esto,
    // por eso el bloque 2 de abajo NO depende de que esto haya corrido.
    if (contactData) {
        dbClientId = await processContact(contactData);
    }

    // ==========================================
    // 2. NOTA AGREGADA A UN LEAD (sin cambiar otro campo)
    // ==========================================
    if (!leadData?.id && !statusChangeLeadId && noteAddLeadId) {
        const kommoLeadId = parseInt(noteAddLeadId, 10);
        const { data: existingTramite } = await supabaseClient.from('entradas')
            .select('id')
            .eq('id_lead', kommoLeadId)
            .maybeSingle();

        if (existingTramite) {
            await syncKommoNotes(existingTramite.id, kommoLeadId);
        }
    }

    // ==========================================
    // 3. LEAD (creación, actualización o cambio de etapa) -> CLIENTE + TRAMITE
    // ==========================================
    // Un lead nuevo que NACE directo en la etapa de entrada de un pipeline llega
    // como leads[add], NO como leads[status] (leads[status] es solo para cambios
    // de etapa posteriores) — por eso "Activa registro" tiene que revisarse acá
    // también, no solo en el caso de cambio de etapa. Unificamos ambos casos:
    // resolvemos qué lead/pipeline/etapa vino en el payload sea cual sea la forma
    // del evento, y de ahí en más el flujo es el mismo.
    let eventKommoLeadId: number | null = null;
    let eventPipelineId: string | null = null;
    let eventStatusId: string | null = null;

    if (leadData?.id) {
        eventKommoLeadId = parseInt(leadData.id, 10);
        eventPipelineId = payload['leads[add][0][pipeline_id]'] || payload['leads[update][0][pipeline_id]'] || null;
        eventStatusId = payload['leads[add][0][status_id]'] || payload['leads[update][0][status_id]'] || null;
    } else if (statusChangeLeadId) {
        eventKommoLeadId = parseInt(statusChangeLeadId, 10);
        eventPipelineId = statusChangePipelineId;
        eventStatusId = statusChangeStatusId;
    }

    if (eventKommoLeadId) {
        const { data: entrada } = await supabaseClient.from('entradas')
            .select('id, id_cliente')
            .eq('id_lead', eventKommoLeadId)
            .maybeSingle();

        let activaRegistro = false;
        let stageTramiteDefault: string | null = null;
        if (eventPipelineId && eventStatusId) {
            const { data: stageMapping } = await supabaseClient.from('kommo_stage_mappings')
                .select('tramite, activa_registro')
                .eq('kommo_pipeline_id', eventPipelineId.toString())
                .eq('kommo_stage_id', eventStatusId.toString())
                .maybeSingle();
            activaRegistro = stageMapping?.activa_registro || false;
            stageTramiteDefault = stageMapping?.tramite || null;
        }

        // Si el trámite ya existe, siempre lo actualizamos. Si no existe, solo lo
        // creamos cuando la etapa actual está marcada como "Activa registro" — el
        // resto de las etapas solo actualizan trámites que ya existan.
        if (entrada || activaRegistro) {
            let clientIdForLead = entrada?.id_cliente ?? dbClientId ?? null;
            let leadForProcessing = leadData;
            let contactForProcessing = contactData;

            // Nos falta el cliente, o nos falta el detalle completo del lead
            // (leads[status] no trae custom_fields) — pedimos todo a la API de
            // Kommo en vez de depender de qué haya venido en el payload plano.
            if ((!clientIdForLead && !contactForProcessing) || !leadForProcessing) {
                const fetched = await fetchKommoLeadAndContact(eventKommoLeadId);
                leadForProcessing = leadForProcessing || fetched?.leadData || null;
                contactForProcessing = contactForProcessing || fetched?.contactData || null;
            }

            if (!clientIdForLead && contactForProcessing) {
                clientIdForLead = await processContact(contactForProcessing);
            }

            if (clientIdForLead && leadForProcessing) {
                const defaultServicio = stageTramiteDefault || leadForProcessing.name?.toUpperCase() || 'TRÁMITE DESDE KOMMO';
                const { servicio } = await processLead(leadForProcessing, clientIdForLead, defaultServicio);
                await supabaseClient.from('clientes').update({ tramite: servicio }).eq('id', clientIdForLead);
            }
        }
    }

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error("Kommo Webhook Error:", error);
    return new Response('Internal Server Error', { status: 500 })
  }
})
