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

    // Lazy: la inmensa mayoría de los webhooks que llegan en producción son
    // mensajes de WhatsApp (message[add]/outgoing_message[add]), que nunca
    // usan kommo_field_mappings (eso es solo para contactos/leads). Antes se
    // pedía esta tabla en TODOS los webhooks sin excepción — una consulta a
    // Supabase completamente desperdiciada en el camino más frecuente y más
    // sensible a latencia (la conversación de WhatsApp en vivo). Se cachea
    // por invocación para que processContact y processLead compartan una sola
    // lectura cuando ambas corren en el mismo request.
    let mappingsCache: any[] | null = null;
    const getMappings = async () => {
      if (mappingsCache) return mappingsCache;
      const { data } = await supabaseClient.from('kommo_field_mappings').select('*');
      mappingsCache = data || [];
      return mappingsCache;
    };

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

    // Baja un adjunto de un mensaje de chat de Kommo (message[add][N][attachment][link],
    // confirmado con un payload real — vive en amojo.kommo.com, no en /api/v4) y lo sube
    // a Supabase Storage (bucket whatsapp_media), devolviendo una URL firmada de larga
    // duración. El link de amojo a veces ya viene autenticado/firmado y a veces no —
    // se prueba primero sin credenciales y, si falla, con el Bearer token de la cuenta.
    const downloadKommoChatAttachment = async (link: string, fileNameHint: string | null, uniqueId: string | number): Promise<{ url: string | null, type: string | null, name: string | null, bytes?: Uint8Array }> => {
        const empty = { url: null, type: null, name: null };
        if (!link) return empty;

        try {
            let fileRes = await fetch(link);
            if (!fileRes.ok) {
                fileRes = await fetch(link, { headers: { 'Authorization': kommoHeaders.Authorization } });
            }
            if (!fileRes.ok) {
                console.error(`No se pudo descargar adjunto de Kommo (${fileRes.status}): ${link}`);
                return empty;
            }

            const blob = await fileRes.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);

            const mimeType = fileRes.headers.get('content-type') || blob.type || 'application/octet-stream';
            const hasExt = !!fileNameHint && /\.[a-zA-Z0-9]{2,5}$/.test(fileNameHint);
            const ext = hasExt ? '' : `.${(mimeType.split('/')[1] || 'bin').split(';')[0]}`;
            // Kommo repite el mismo file_name (p.ej. "image.jpg", "audio.ogg") en adjuntos
            // de mensajes distintos. Sin el prefijo del id de mensaje, dos adjuntos con el
            // mismo nombre terminaban en el mismo path de Storage y, con upsert:true, el
            // segundo pisaba al primero: el mensaje viejo quedaba mostrando el archivo
            // nuevo (parecía "repetido") y el archivo original se perdía.
            const finalName = `${uniqueId}_${fileNameHint || `kommo_${Date.now()}`}${ext}`;

            const { error: upErr } = await supabaseClient.storage
                .from('whatsapp_media')
                .upload(finalName, blob, { contentType: mimeType, upsert: true });
            if (upErr) {
                console.error('Error subiendo adjunto de Kommo a Storage:', upErr);
                return empty;
            }

            const { data: signed } = await supabaseClient.storage
                .from('whatsapp_media')
                .createSignedUrl(finalName, 315360000); // ~10 años

            return { url: signed?.signedUrl || null, type: mimeType, name: finalName, bytes };
        } catch (err) {
            console.error('Error descargando adjunto de Kommo:', err);
            return empty;
        }
    };

    const uint8ToBase64 = (bytes: Uint8Array): string => {
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    };

    const classifyAndExtractCloud = async (bytes: Uint8Array, mimeType: string, groqApiKey: string) => {
        const base64 = uint8ToBase64(bytes);
        const prompt = `Eres un perito oficial y asistente de inteligencia artificial experto en procesamiento de documentos de identidad, migración y extranjería en Brasil (Policía Federal, Cartórios, CONARE).
REGLAS DE CLASIFICACIÓN Y RIGOR:
1. CLASIFICACIÓN: "tipo_documento" debe ser uno de: PASAPORTE, CARNET DE IDENTIDAD, PROTOCOLO DE REFUGIO, RNM, CPF, COMPROBANTE DE RESIDENCIA, COMPROBANTE PIX, CERTIDAO DE MATRIMONIO, CERTIDAO DE NACIMIENTO, OTRO.
2. PASAPORTES (MRZ): Lee las líneas MRZ (P<CUB...). En pasaportes cubanos, extrae nombre, apellidos, número de pasaporte y en la línea 2 del MRZ el carnet de identidad de 11 dígitos.
3. PROTOCOLO DE REFUGIO / RNM: Extrae filiación (nombre_madre, nombre_padre), fecha de vencimiento y número de proceso/protocolo.
4. CALIDAD DE IMAGEN (ANTI-FALSO BORROSO):
   - Marca "borroso": true ÚNICAMENTE si la imagen es una foto negra/vacía, meme, sticker o completamente ilegible donde no se lee ningún dato de identidad.
   - Si se lee el nombre, número de documento, carnet, dirección o cualquier dato útil, pon "borroso": false.
5. Fechas estrictamente en formato DD/MM/AAAA.
Devuelve ÚNICAMENTE un JSON:
{
  "tipo_documento": "VALOR",
  "borroso": false,
  "motivo_borroso": null,
  "datos_extraidos": {
    "nombre": null,
    "cpf": null,
    "nacionalidad": null,
    "fecha_nacimiento": null,
    "numero_pasaporte": null,
    "fecha_emision_pasaporte": null,
    "fecha_vencimiento_pasaporte": null,
    "carnet_identidad": null,
    "rnm": null,
    "numero_refugio": null,
    "nombre_padre": null,
    "nombre_madre": null,
    "sexo": null
  }
}`;

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'qwen/qwen3.8-27b',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
                    ],
                }],
                temperature: 0.1,
                response_format: { type: 'json_object' },
            }),
        });

        if (!res.ok) return null;
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim());
        return {
            tipo: parsed.tipo_documento || 'DOCUMENTO',
            borroso: parsed.borroso === true,
            motivo: parsed.motivo_borroso || null,
            datos: parsed.datos_extraidos || {}
        };
    };

    const detectPersonMismatchCloud = (currentNombre: string | null, currentCpf: string | null, datos: Record<string, any>) => {
        const cleanExtractedCpf = (datos.cpf || '').replace(/\D/g, '');
        const cleanCurrentCpf = (currentCpf || '').replace(/\D/g, '');
        if (cleanExtractedCpf.length === 11 && cleanCurrentCpf.length === 11) {
            return cleanExtractedCpf !== cleanCurrentCpf;
        }
        const n1 = (currentNombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const n2 = (datos.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (!n1 || !n2) return false;
        const w1 = n1.split(/\s+/).filter((w: string) => w.length > 2);
        const w2 = n2.split(/\s+/).filter((w: string) => w.length > 2);
        if (w1.length === 0 || w2.length === 0) return false;
        const firstNamesMatch = w1[0] === w2[0];
        const sharedWords = w1.filter((w: string) => w2.includes(w)).length;
        return sharedWords === 0 || (sharedWords === 1 && !firstNamesMatch);
    };

    const resolveOrCreateRelatedClientCloud = async (supabaseAdmin: any, currentClienteId: number, datos: Record<string, any>) => {
        const cleanCpf = (datos.cpf || '').replace(/\D/g, '');
        let targetId: number | null = null;
        if (cleanCpf.length === 11) {
            const { data } = await supabaseAdmin.from('clientes').select('id').neq('id', currentClienteId).or(`cpf.eq.${cleanCpf},cpf.eq.${datos.cpf}`).limit(1);
            if (data && data.length > 0) targetId = data[0].id;
        }
        if (!targetId && datos.nombre) {
            const { data } = await supabaseAdmin.from('clientes').select('id').neq('id', currentClienteId).ilike('nombre', `%${datos.nombre}%`).limit(1);
            if (data && data.length > 0) targetId = data[0].id;
        }
        if (!targetId) {
            const { data: newClient } = await supabaseAdmin.from('clientes').insert({
                nombre: (datos.nombre || 'NUEVO FAMILIAR').toUpperCase(),
                cpf: datos.cpf || '',
                nacionalidad: (datos.nacionalidad || '').toUpperCase(),
                estado_cliente: 'nuevo',
                canal_adquisicion: 'Familiar Vinculado'
            }).select('id').single();
            if (newClient) targetId = newClient.id;
        }
        if (targetId) {
            const { data: rel } = await supabaseAdmin.from('relaciones_clientes').select('id')
                .or(`and(cliente_id.eq.${currentClienteId},cliente_relacionado_id.eq.${targetId}),and(cliente_id.eq.${targetId},cliente_relacionado_id.eq.${currentClienteId})`)
                .limit(1);
            if (!rel || rel.length === 0) {
                await supabaseAdmin.from('relaciones_clientes').insert({
                    cliente_id: currentClienteId,
                    cliente_relacionado_id: targetId,
                    tipo_relacion: 'Familiar',
                    descripcion: 'Familiar vinculado automáticamente por documento de WhatsApp'
                });
            }
        }
        return targetId;
    };

    const applyExtractedDataCloud = async (supabaseAdmin: any, clientId: number, datos: Record<string, any>) => {
        const { data: clientRow } = await supabaseAdmin
            .from('clientes')
            .select('id, nombre, cpf, nacionalidad, fecha_nacimiento, lugar_nacimiento, sexo, campos_personalizados')
            .eq('id', clientId)
            .single();
        if (!clientRow) return;

        const updates: Record<string, any> = {};
        const customFields: Record<string, any> = { ...(clientRow.campos_personalizados || {}) };
        let hasCustomUpdates = false;

        // Columnas fijas reales de la tabla clientes
        const directCols = new Set(['nombre', 'cpf', 'nacionalidad', 'fecha_nacimiento', 'lugar_nacimiento', 'sexo']);

        // Campos migratorios que se almacenan en campos_personalizados JSONB
        const migrationFields = new Set([
            'numero_pasaporte', 'carnet_identidad', 'rnm', 'numero_refugio',
            'nombre_padre', 'nombre_madre', 'fecha_vencimiento_refugio',
            'fecha_emision_pasaporte', 'fecha_vencimiento_pasaporte'
        ]);

        for (const [key, val] of Object.entries(datos)) {
            if (!val || typeof val !== 'string') continue;
            const strVal = String(val).trim().toUpperCase();
            if (!strVal) continue;

            if (directCols.has(key)) {
                const currentVal = clientRow[key];
                if (currentVal === null || currentVal === undefined || String(currentVal).trim() === '') {
                    updates[key] = strVal;
                }
            } else if (migrationFields.has(key) || key.startsWith('custom_')) {
                const currentVal = customFields[key];
                if (currentVal === null || currentVal === undefined || String(currentVal).trim() === '') {
                    customFields[key] = strVal;
                    hasCustomUpdates = true;
                }
            }
        }

        if (hasCustomUpdates) {
            updates.campos_personalizados = customFields;
        }

        if (Object.keys(updates).length > 0) {
            await supabaseAdmin.from('clientes').update(updates).eq('id', clientId);
        }
    };

    // Un mismo teléfono puede estar repetido en varios `clientes` (familiares
    // que comparten WhatsApp/celular, o el mismo trámite vinculado a varias
    // personas). El teléfono es el identificador que decide a quién le llega
    // la conversación/documento: si hay más de un cliente con ese teléfono,
    // se usa el "usuario principal" (por convención, el que se registró
    // primero — id más chico), no necesariamente el titular del trámite.
    const resolvePrincipalClientByPhone = async (telefono: string | null, fallbackClientId: number | null): Promise<number | null> => {
        if (!telefono) return fallbackClientId;
        const { data: matches } = await supabaseClient.from('clientes')
            .select('id')
            .eq('telefono', telefono)
            .order('id', { ascending: true })
            .limit(1);
        return matches?.[0]?.id ?? fallbackClientId;
    };

    // Trae y guarda (sin duplicar) las notas de texto de un lead de Kommo en
    // notas_tramite. Esto es SOLO para notas internas del CRM clásico (ej. un
    // operador escribe una nota a mano en el lead) — los mensajes de chat de
    // WhatsApp NO llegan por acá, llegan como evento `message[add]` (ver más
    // abajo, bloque 4), confirmado con un payload real.
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
        const mappings = await getMappings();

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
        const mappings = await getMappings();

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

    // ==========================================
    // 4. MENSAJE DE CHAT (WhatsApp) -> mensajes + documentos_pendientes
    // ==========================================
    // Confirmado con payloads reales de producción: los mensajes ENTRANTES
    // (del cliente) llegan como message[add][N][...], y los SALIENTES
    // (mandados por un agente desde la propia interfaz de Kommo) llegan por
    // separado como outgoing_message[add][N][...] — son dos eventos de
    // webhook distintos, ninguno es leads[note][add] (ese es de notas
    // internas del CRM clásico, ver syncKommoNotes arriba). Ambos formatos
    // traen contact_id directo y el adjunto ya resuelto en
    // [...][attachment][link] — no hace falta llamar a ninguna otra API de
    // Kommo para esto.
    const processKommoChatEvents = async (rootKey: 'message' | 'outgoing_message') => {
        let i = 0;
        while (payload[`${rootKey}[add][${i}][id]`] !== undefined) {
            const prefix = `${rootKey}[add][${i}]`;
            i++;

            const kommoMessageId = payload[`${prefix}[id]`];
            const contactId = payload[`${prefix}[contact_id]`];
            const elementId = payload[`${prefix}[element_id]`];
            const entityType = payload[`${prefix}[entity_type]`];
            const text = payload[`${prefix}[text]`] || '';
            const messageType = payload[`${prefix}[message_type]`] || 'text';
            const msgDirection = payload[`${prefix}[type]`]; // 'incoming' | 'outgoing'
            const createdAt = payload[`${prefix}[created_at]`];
            const attachmentLink = payload[`${prefix}[attachment][link]`];
            const attachmentFileName = payload[`${prefix}[attachment][file_name]`];
            const authorName = payload[`${prefix}[author][name]`];

            if (!kommoMessageId) continue;

            // Resolver cliente: primero por contact_id (directo, confiable), y si
            // no se encuentra, por el lead vinculado (mismo fallback que ya usaba
            // el resto del archivo).
            let msgClientId: number | null = null;
            let msgTelefono: string | null = null;

            if (contactId) {
                const { data: byContact } = await supabaseClient.from('clientes')
                    .select('id, telefono')
                    .eq('id_kommo', contactId.toString())
                    .maybeSingle();
                if (byContact) {
                    msgClientId = byContact.id;
                    msgTelefono = byContact.telefono;
                }
            }

            if (!msgClientId && elementId && entityType === 'lead') {
                const { data: viaEntrada } = await supabaseClient.from('entradas')
                    .select('id_cliente, clientes(telefono)')
                    .eq('id_lead', parseInt(elementId, 10))
                    .maybeSingle();
                if (viaEntrada?.id_cliente) {
                    msgClientId = viaEntrada.id_cliente;
                    msgTelefono = (viaEntrada as any).clientes?.telefono || null;
                }
            }

            if (!msgClientId) continue; // todavía no hay cliente/trámite a quién asignárselo

            const principalClientId = await resolvePrincipalClientByPhone(msgTelefono, msgClientId);
            if (!principalClientId) continue;

            // Dedupe por id de mensaje de Kommo (uuid) — Kommo puede reintentar el
            // mismo webhook si la respuesta tarda.
            const { data: existingMsg } = await supabaseClient.from('mensajes')
                .select('id')
                .eq('kommo_message_id', kommoMessageId)
                .maybeSingle();
            if (existingMsg) continue;

            const mediaInfo = attachmentLink
                ? await downloadKommoChatAttachment(attachmentLink, attachmentFileName, kommoMessageId)
                : { url: null, type: null, name: null };

            const texto = text || (mediaInfo.name ? `[Archivo] ${mediaInfo.name}` : `[${messageType}]`);
            const isOutgoing = msgDirection === 'outgoing' || rootKey === 'outgoing_message';

            await supabaseClient.from('mensajes').insert({
                cliente_id: principalClientId,
                texto,
                tipo: isOutgoing ? 'saliente' : 'entrante',
                proveedor: 'kommo',
                leido: false,
                remitente: isOutgoing ? 'outgoing' : 'incoming',
                telefono: msgTelefono,
                operario: isOutgoing ? (authorName || null) : null,
                media_url: mediaInfo.url,
                media_type: mediaInfo.type,
                media_name: mediaInfo.name,
                kommo_message_id: kommoMessageId,
                fecha_recepcion: createdAt ? new Date(parseInt(createdAt, 10) * 1000).toISOString() : new Date().toISOString()
            });

            // Si trajo un archivo, además de quedar en el historial de
            // conversación se registra como documento pendiente de revisión —
            // así aparece en la pestaña "Documentos" del cliente en el panel.
            // Los audios (notas de voz) quedan afuera a propósito: solo deben
            // verse en la conversación, no como documento a revisar.
            const isAudio = (mediaInfo.type || '').startsWith('audio/');
            if (attachmentLink && mediaInfo.url && !isAudio) {
                let targetClientId = principalClientId;
                let finalDocName = mediaInfo.name || attachmentFileName || 'Documento de WhatsApp';

                // Si es una imagen y tenemos bytes y GROQ_API_KEY, clasificar y autocompletar con IA en la nube
                const groqApiKey = Deno.env.get('GROQ_API_KEY');
                if (groqApiKey && mediaInfo.bytes && (mediaInfo.type || '').startsWith('image/')) {
                    try {
                        const aiRes = await classifyAndExtractCloud(mediaInfo.bytes, mediaInfo.type, groqApiKey);
                        if (aiRes) {
                            if (aiRes.borroso) {
                                finalDocName = `⚠️ BORROSO - ${finalDocName}`;
                                await supabaseClient.from('notificaciones_equipo').insert({
                                    cliente_id: principalClientId,
                                    mensaje: `⚠️ Documento borroso recibido por WhatsApp para cliente #${principalClientId}: ${aiRes.motivo || 'Ilegible'}. Pide al cliente una nueva foto.`
                                });
                            } else if (aiRes.tipo && aiRes.datos) {
                                // Chequear si pertenece a un familiar
                                const { data: currentClientRow } = await supabaseClient.from('clientes').select('id, nombre, cpf').eq('id', principalClientId).single();
                                if (currentClientRow) {
                                    const isMismatch = detectPersonMismatchCloud(currentClientRow.nombre, currentClientRow.cpf, aiRes.datos);
                                    if (isMismatch) {
                                        const relatedClientId = await resolveOrCreateRelatedClientCloud(supabaseClient, principalClientId, aiRes.datos);
                                        if (relatedClientId) {
                                            targetClientId = relatedClientId;
                                            finalDocName = `${aiRes.tipo} - ${(aiRes.datos.nombre || 'FAMILIAR').toUpperCase()}`;
                                            await applyExtractedDataCloud(supabaseClient, relatedClientId, aiRes.datos);
                                        }
                                    } else {
                                        finalDocName = `${aiRes.tipo} - ${(currentClientRow.nombre || aiRes.datos.nombre || '').toUpperCase()}`;
                                        await applyExtractedDataCloud(supabaseClient, principalClientId, aiRes.datos);
                                    }
                                }
                            }
                        }
                    } catch (aiErr) {
                        console.warn('[kommo-webhook] Error en clasificación IA de adjunto:', aiErr);
                    }
                }

                const isSuccessfullyClassified = Boolean(
                    aiRes && !aiRes.borroso && aiRes.tipo &&
                    !['DOCUMENTO', 'OTRO'].includes(aiRes.tipo.toUpperCase())
                );

                await supabaseClient.from('documentos_pendientes').insert({
                    cliente_id: targetClientId,
                    telefono: msgTelefono,
                    url_archivo: mediaInfo.url,
                    nombre_archivo: finalDocName,
                    tipo_contenido: mediaInfo.type,
                    origen: 'kommo',
                    verificado: isSuccessfullyClassified
                });
            }
        }
    };

    await processKommoChatEvents('message');
    await processKommoChatEvents('outgoing_message');

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error("Kommo Webhook Error:", error);
    return new Response('Internal Server Error', { status: 500 })
  }
})
