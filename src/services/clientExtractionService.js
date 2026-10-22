/**
 * clientExtractionService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica pura (sin estado de React) para aplicar los datos que la IA extrajo
 * de un documento (ver aiService.analyzeDocumentImage) a la fila `clientes`
 * correspondiente. Extraída de useClientViewExtraction.handleSaveExtractedData
 * para poder reusarla en dos flujos:
 *   1. El modal de revisión manual (staff ve los datos, corrige si hace falta,
 *      confirma) -- comportamiento sin cambios, sigue pisando cualquier valor.
 *   2. El guardado automático apenas se sube un documento nuevo, ANTES de que
 *      un operacional lo vea (skipIfAlreadyFilled: true) -- para no pisar en
 *      silencio un dato que el staff ya cargó o verificó a mano.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from '../supabaseClient';
import { normalizeDateToDDMMYYYY } from '../utils/dateFormatter';
import { toIsoDate, FIXED_FIELDS_CATALOG } from '../components/clientView.constants';
import { createCliente, getCliente, insertRelacion } from './clientesService';
import { getDocuments, reassignDocument } from './storageService';
import { analyzeDocumentImage } from './aiService';

import {
  validateAndFormatCpf,
  validateAndFormatEmail,
  validateAndFormatPhone,
  validateAndFormatDate,
  formatPersonName,
  parseBrazilianAddress
} from '../utils/entityParser';

const FIXED_COLUMN_IDS = new Set(FIXED_FIELDS_CATALOG.map(f => f.id));

export const MIGRATION_FIELDS = new Set([
  'rnm',
  'numero_refugio',
  'fecha_vencimiento_refugio',
  'numero_pasaporte',
  'fecha_emision_pasaporte',
  'fecha_vencimiento_pasaporte',
  'carnet_identidad',
  'policia_federal',
  'fecha_entrada_brasil',
  'lugar_entrada_brasil',
  'nombre_madre',
  'nombre_padre',
  'tramite'
]);

/** Mapeo canónico de claves IA → columnas y campos de la tabla `clientes` */
export const AI_FIELD_MAP = {
  // Identidad personal
  'NOMBRE_COMPLETO': 'nombre',
  'NOMBRE': 'nombre',
  'NOME': 'nombre',
  'CPF': 'cpf',
  'CIC': 'cpf',
  'CADASTRO_PESSOAS_FISICAS': 'cpf',
  'TELEFONO': 'telefono',
  'TELEFONE': 'telefono',
  'CELULAR': 'telefono',
  'EMAIL': 'email',
  'E_MAIL': 'email',
  'EMAIL_PESSOAL': 'email',
  'ESTADO_CIVIL': 'estado_civil',
  'SEXO': 'sexo',
  'NACIONALIDAD': 'nacionalidad',
  'PAIS': 'pais',
  'PAIS_ORIGEN': 'pais',
  'CIUDAD': 'ciudad',
  'CIDADE': 'ciudad',
  'MUNICIPIO': 'ciudad',
  'ESTADO': 'estado',
  'UF': 'estado',
  'ESTADO_FEDERAL': 'estado_federal',
  'LUGAR_NACIMIENTO': 'lugar_nacimiento',
  'FECHA_NACIMIENTO': 'fecha_nacimiento',

  // Documentos migratorios
  'RNM': 'rnm',
  'CRNM': 'rnm',
  'CIE': 'rnm',
  'RNE': 'rnm',
  'REGISTRO_NACIONAL_MIGRATORIO': 'rnm',

  'CARNET_IDENTIDAD': 'carnet_identidad',
  'CARNET': 'carnet_identidad',
  'CEDULA': 'carnet_identidad',
  'DNI': 'carnet_identidad',
  'DOCUMENTO_IDENTIDAD': 'carnet_identidad',
  'CI': 'carnet_identidad',

  'NUMERO_DOCUMENTO': 'numero_pasaporte',
  'NUMERO_PASAPORTE': 'numero_pasaporte',
  'PASAPORTE': 'numero_pasaporte',
  'PASAPORTE_CUBANO': 'numero_pasaporte',

  'NUMERO_REFUGIO': 'numero_refugio',
  'PROTOCOLO_REFUGIO': 'numero_refugio',
  'SISCONARE': 'numero_refugio',
  'REFUGIO': 'numero_refugio',

  'FECHA_EMISION_PASAPORTE': 'fecha_emision_pasaporte',
  'FECHA_VENCIMIENTO_PASAPORTE': 'fecha_vencimiento_pasaporte',
  'FECHA_VENCIMIENTO_REFUGIO': 'fecha_vencimiento_refugio',

  'FECHA_ENTRADA_BRASIL': 'fecha_entrada_brasil',
  'FECHA_ENTRADA': 'fecha_entrada_brasil',
  'LUGAR_ENTRADA_BRASIL': 'lugar_entrada_brasil',
  'LUGAR_ENTRADA': 'lugar_entrada_brasil',
  'POLICIA_FEDERAL': 'policia_federal',
  'TRAMITE': 'tramite',

  // Familiares
  'NOMBRE_MADRE': 'nombre_madre',
  'NOMBRE_PADRE': 'nombre_padre',
  'FILIACAO_1': 'nombre_madre',
  'FILIACAO_2': 'nombre_padre',
};

const AI_DATE_KEYS = new Set([
  'FECHA_NACIMIENTO',
  'FECHA_EMISION_PASAPORTE',
  'FECHA_VENCIMIENTO_PASAPORTE',
  'FECHA_VENCIMIENTO_REFUGIO',
  'FECHA_ENTRADA_BRASIL',
  'FECHA_ENTRADA',
  'FECHA_EXPEDICION',
  'FECHA_DECLARACION',
  'FECHA_FORMALIZACION',
  'SALIDA_DE_CUBA',
  'FECHA_SOLICITUD',
]);

const AI_IGNORED_KEYS = new Set([
  'ILEGIBLE',
  'DOCUMENTO_BORROSO',
  'MOTIVO_ILEGIBLE',
  'TIPO_DOCUMENTO',
  'NOMBRE_ARCHIVO',
  'FAMILIARES_MENCIONADOS',
  'CAMPOS_ADICIONALES'
]);

const humanizeAiKey = (key) => key.toLowerCase().split('_').filter(Boolean)
  .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const toIdentificador = (key) => key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const ensureCustomFieldDefinition = async (identificador, nombreCampo) => {
  const { error } = await supabase.from('config_campos_clientes').insert([{
    nombre_campo: nombreCampo,
    identificador,
    categoria: 'Documentos de Identidad',
    tipo: 'text',
    requerido: false,
  }]);
  if (error && error.code !== '23505') throw error;
};

/**
 * Aplica `extractedData` (salida cruda de analyzeDocumentImage) a la fila
 * `clientes` de `targetClientId`.
 *
 * @param {object} params
 * @param {number|string} params.targetClientId
 * @param {object} params.extractedData - Objeto crudo de analyzeDocumentImage.
 * @param {object} [params.targetClientData] - Fila actual del cliente destino
 *   (para no pisar otros campos de `campos_personalizados`, y para el chequeo
 *   de skipIfAlreadyFilled). Si no se pasa, se hace un fetch acá.
 * @param {Array} [params.customFieldsConfig] - Catálogo de campos dinámicos.
 * @param {boolean} [params.skipIfAlreadyFilled=false] - Si true, un campo que
 *   ya tiene valor no-vacío en el cliente NUNCA se pisa (modo automático,
 *   sin revisión humana previa). Si false (modo modal manual, comportamiento
 *   histórico), siempre se pisa con lo último extraído/editado.
 * @returns {Promise<{applied: string[]}>} columnas/campos que sí se escribieron.
 */
export async function applyExtractedDataToClient({
  targetClientId,
  extractedData,
  targetClientData = null,
  customFieldsConfig = [],
  skipIfAlreadyFilled = false,
}) {
  if (!targetClientId || !extractedData) return { applied: [] };

  let clientRow = targetClientData;
  if (!clientRow) {
    const { data } = await supabase.from('clientes').select('*').eq('id', targetClientId).single();
    clientRow = data;
  }

  const updates = {};
  const customJsonUpdates = { ...(clientRow?.campos_personalizados || {}) };
  let hasCustomJsonUpdates = false;
  const newCustomFieldDefs = [];
  const existingCustomFieldsById = new Map(
    (customFieldsConfig || []).map(cf => [toIdentificador(cf.identificador), cf.identificador])
  );
  const applied = [];

  const tipoDocumentoEntry = Object.entries(extractedData).find(([k]) => k.toUpperCase() === 'TIPO_DOCUMENTO');
  const tipoDocumento = tipoDocumentoEntry ? String(tipoDocumentoEntry[1]).trim().toUpperCase() : '';

  for (const [key, value] of Object.entries(extractedData)) {
    if (!value) continue;
    const upperKey = key.toUpperCase();
    if (AI_IGNORED_KEYS.has(upperKey)) continue;

    if (upperKey === 'DIRECCION') {
      let dirObj = null;
      if (typeof value === 'object' && value !== null) {
        dirObj = {
          cep: value.cep || '',
          endereco: value.endereco || '',
          numero: value.numero || '',
          complemento: value.complemento || '',
          bairro: value.bairro || '',
          cidade: value.cidade || '',
          estado: value.estado || '',
          ponto_referencia: value.ponto_referencia || '',
        };
      } else if (typeof value === 'string' && value.trim()) {
        try {
          if (value.startsWith('{')) dirObj = JSON.parse(value);
        } catch (_) {}
        if (!dirObj) {
          dirObj = { endereco: value.trim() };
        }
      }

      if (dirObj) {
        const currentValue = clientRow ? clientRow['direccion'] : null;
        const isCurrentlyEmpty = !currentValue || currentValue === '{}' || currentValue === 'null' || currentValue === '""';
        if (!skipIfAlreadyFilled || isCurrentlyEmpty) {
          updates['direccion'] = JSON.stringify(dirObj);
          if (dirObj.cidade && (!skipIfAlreadyFilled || !clientRow?.ciudad)) {
            updates['ciudad'] = dirObj.cidade.toUpperCase();
          }
          if (dirObj.estado && (!skipIfAlreadyFilled || !clientRow?.estado)) {
            updates['estado'] = dirObj.estado.toUpperCase();
          }
          applied.push('direccion');
        }
      }
      continue;
    }

    const mappedCol = AI_FIELD_MAP[upperKey];
    if (mappedCol) {
      let finalValue;
      if (mappedCol === 'cpf') {
        const cpfFmt = validateAndFormatCpf(value);
        finalValue = cpfFmt || String(value).trim();
      } else if (mappedCol === 'email') {
        const emailFmt = validateAndFormatEmail(value);
        finalValue = emailFmt || String(value).trim().toLowerCase();
      } else if (mappedCol === 'telefono') {
        const phoneFmt = validateAndFormatPhone(value);
        finalValue = phoneFmt || String(value).trim();
      } else if (mappedCol === 'nombre') {
        finalValue = formatPersonName(value) || String(value).trim();
      } else if (AI_DATE_KEYS.has(upperKey) || upperKey.includes('FECHA') || upperKey.includes('DATA')) {
        const dateNorm = validateAndFormatDate(value);
        finalValue = dateNorm.iso || toIsoDate(normalizeDateToDDMMYYYY(value)) || String(value).trim();
      } else {
        finalValue = String(value).trim().toUpperCase();
      }

      // Si es un campo fijo de la tabla clientes
      if (FIXED_COLUMN_IDS.has(mappedCol)) {
        const currentValue = clientRow ? clientRow[mappedCol] : null;
        const isCurrentlyEmpty = currentValue === null || currentValue === undefined || String(currentValue).trim() === '';
        if (!skipIfAlreadyFilled || isCurrentlyEmpty) {
          updates[mappedCol] = finalValue;
          applied.push(mappedCol);
        }
      }

      // Si es uno de los campos migratorios o no-fijo, guardar siempre en campos_personalizados para sincronía total
      if (MIGRATION_FIELDS.has(mappedCol) || !FIXED_COLUMN_IDS.has(mappedCol)) {
        const currentValue = clientRow?.campos_personalizados?.[mappedCol];
        const isCurrentlyEmpty = currentValue === null || currentValue === undefined || String(currentValue).trim() === '';
        if (!skipIfAlreadyFilled || isCurrentlyEmpty) {
          customJsonUpdates[mappedCol] = finalValue;
          hasCustomJsonUpdates = true;
          if (!applied.includes(mappedCol)) applied.push(mappedCol);
        }
      }
    } else if (!AI_IGNORED_KEYS.has(upperKey)) {
      const generatedId = toIdentificador(key);
      if (!generatedId) continue;
      const identificador = existingCustomFieldsById.get(generatedId) || generatedId;
      const currentValue = clientRow?.campos_personalizados?.[identificador];
      const isCurrentlyEmpty = currentValue === null || currentValue === undefined || String(currentValue).trim() === '';
      if (skipIfAlreadyFilled && !isCurrentlyEmpty) continue;
      customJsonUpdates[identificador] = String(value).toUpperCase();
      hasCustomJsonUpdates = true;
      applied.push(identificador);
      if (!existingCustomFieldsById.has(generatedId)) {
        const label = tipoDocumento ? `${humanizeAiKey(key)} (${tipoDocumento})` : humanizeAiKey(key);
        newCustomFieldDefs.push({ identificador, nombreCampo: label });
      }
    }
  }

  for (const { identificador, nombreCampo } of newCustomFieldDefs) {
    await ensureCustomFieldDefinition(identificador, nombreCampo);
  }

  if (hasCustomJsonUpdates) {
    updates.campos_personalizados = customJsonUpdates;
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('clientes').update(updates).eq('id', targetClientId);
  }

  return { applied };
}

const normalizeName = (name) => (name || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim();

/**
 * Heurística de "documento extraviado": ¿el nombre/CPF que la IA extrajo de
 * un documento pertenece claramente a otra persona, distinta del dueño de la
 * cuenta? Portada de ClientViewExtractionModal.isDifferent() para poder
 * correr el mismo chequeo de forma automática (sin esperar a que un
 * operacional abra el modal de revisión).
 */
export function detectPersonMismatch(currentCliente, extractedData) {
  if (!currentCliente || !extractedData) return false;

  // Si ambos tienen CPF de 11 dígitos, el CPF es la fuente de verdad definitiva
  const cleanExtractedCpf = (extractedData.CPF || '').replace(/\D/g, '');
  const cleanCurrentCpf = (currentCliente.cpf || '').replace(/\D/g, '');

  if (cleanExtractedCpf.length === 11 && cleanCurrentCpf.length === 11) {
    if (cleanExtractedCpf === cleanCurrentCpf) return false; // Misma persona
    return true; // CPFs distintos -> claramente otra persona
  }

  // Si no se puede comparar por CPF completo, comparar por nombres
  const currentName = normalizeName(currentCliente.nombre);
  const extractedName = normalizeName(extractedData.NOMBRE_COMPLETO);
  if (!currentName || !extractedName) return false;

  const w1 = currentName.split(/\s+/).filter(w => w.length > 2);
  const w2 = extractedName.split(/\s+/).filter(w => w.length > 2);
  if (w1.length === 0 || w2.length === 0) return false;

  const firstNamesMatch = w1[0] === w2[0];
  const sharedWords = w1.filter(w => w2.includes(w)).length;
  const nameIsDifferent = sharedWords === 0 || (sharedWords === 1 && !firstNamesMatch);

  return nameIsDifferent;
}

/**
 * Cuando detectPersonMismatch da true: busca si la persona del documento ya
 * es cliente (por CPF exacto, si no por nombre) y si no existe la crea --
 * siempre vinculada al cliente dueño de la cuenta vía relaciones_clientes
 * (tipo 'Familiar', misma convención que el flujo manual de
 * ClientViewExtractionModal.handleCreateNewClient). No mueve el documento acá:
 * eso lo hace el caller, porque el mecanismo difiere según el canal
 * (reassignDocument en el dashboard, UPDATE directo en el Edge Function).
 */
export async function resolveOrCreateRelatedClient({ currentCliente, extractedData }) {
  const cleanCpf = (extractedData.CPF || '').replace(/\D/g, '');
  const rawCpf = extractedData.CPF || '';

  let targetClient = null;
  let isNewClient = false;

  // 1. Buscar si la persona ya existe por CPF (tanto limpio como con formato)
  if (cleanCpf.length === 11) {
    const { data: matchesByCpf } = await supabase
      .from('clientes')
      .select('id, nombre, cpf')
      .neq('id', currentCliente.id)
      .or(`cpf.eq.${cleanCpf},cpf.eq.${rawCpf}`)
      .limit(1);
    if (matchesByCpf && matchesByCpf.length > 0) {
      targetClient = matchesByCpf[0];
    }
  }

  // 2. Si no se encontró por CPF, buscar por nombre
  if (!targetClient && extractedData.NOMBRE_COMPLETO?.trim()) {
    const { data: matchesByName } = await supabase
      .from('clientes')
      .select('id, nombre, cpf')
      .neq('id', currentCliente.id)
      .ilike('nombre', `%${extractedData.NOMBRE_COMPLETO.trim()}%`)
      .limit(1);
    if (matchesByName && matchesByName.length > 0) {
      targetClient = matchesByName[0];
    }
  }

  // 3. Si no existe, crear la nueva ficha del familiar
  if (!targetClient) {
    const camposPersonalizados = {};
    if (extractedData.RNM) camposPersonalizados.rnm = extractedData.RNM;
    if (extractedData.CARNET_IDENTIDAD) camposPersonalizados.carnet_identidad = extractedData.CARNET_IDENTIDAD;
    if (extractedData.NUMERO_DOCUMENTO) camposPersonalizados.numero_pasaporte = extractedData.NUMERO_DOCUMENTO;
    if (extractedData.NUMERO_REFUGIO) camposPersonalizados.numero_refugio = extractedData.NUMERO_REFUGIO;
    if (extractedData.NOMBRE_MADRE) camposPersonalizados.nombre_madre = extractedData.NOMBRE_MADRE;
    if (extractedData.NOMBRE_PADRE) camposPersonalizados.nombre_padre = extractedData.NOMBRE_PADRE;

    targetClient = await createCliente({
      nombre: extractedData.NOMBRE_COMPLETO?.toUpperCase() || 'NUEVO FAMILIAR',
      cpf: rawCpf,
      nacionalidad: extractedData.NACIONALIDAD?.toUpperCase() || '',
      fecha_nacimiento: extractedData.FECHA_NACIMIENTO ? toIsoDate(normalizeDateToDDMMYYYY(extractedData.FECHA_NACIMIENTO)) : null,
      sexo: extractedData.SEXO?.toUpperCase() || '',
      estado_cliente: 'nuevo',
      canal_adquisicion: 'Familiar Vinculado',
      ...(Object.keys(camposPersonalizados).length > 0 ? { campos_personalizados: camposPersonalizados } : {}),
    });
    isNewClient = true;
  }

  // 4. Crear relación en relaciones_clientes (bidireccional/única)
  const { data: existingRelation } = await supabase
    .from('relaciones_clientes')
    .select('id')
    .or(`and(cliente_id.eq.${currentCliente.id},cliente_relacionado_id.eq.${targetClient.id}),and(cliente_id.eq.${targetClient.id},cliente_relacionado_id.eq.${currentCliente.id})`)
    .limit(1);

  if (!existingRelation || existingRelation.length === 0) {
    try {
      await insertRelacion({
        cliente_id: currentCliente.id,
        cliente_relacionado_id: targetClient.id,
        tipo_relacion: 'Familiar',
        descripcion: 'Familiar vinculado automáticamente por análisis de documento'
      });
    } catch (err) {
      if (err?.code !== '23505') console.error('[clientExtractionService] Error creando relación automática:', err);
    }
  }

  return { targetClient, isNewClient };
}

/**
 * Crea o vincula un familiar mencionado (ej. desde el chat) al cliente titular.
 * @param {object} params
 * @param {object} params.currentCliente
 * @param {object} params.relativeData - { nombre, parentesco, cpf, detalles }
 * @returns {Promise<{targetClient: object, isNew: boolean}>}
 */
export async function createAndLinkRelative({ currentCliente, relativeData }) {
  if (!currentCliente || !relativeData?.nombre) return null;

  const rawName = relativeData.nombre.trim().toUpperCase();
  let query = supabase.from('clientes').select('id, nombre, cpf').neq('id', currentCliente.id);
  if (relativeData.cpf) {
    query = query.eq('cpf', relativeData.cpf);
  } else {
    query = query.ilike('nombre', `%${rawName}%`);
  }
  const { data: matches } = await query.limit(1);

  let targetClient;
  let isNew = false;

  if (matches && matches.length > 0) {
    targetClient = matches[0];
  } else {
    targetClient = await createCliente({
      nombre: rawName,
      cpf: relativeData.cpf || '',
      estado_cliente: 'nuevo',
      canal_adquisicion: 'Familiar Vinculado'
    });
    isNew = true;
  }

  const tipoRelacion = relativeData.parentesco?.trim() || 'Familiar';

  // Verificar si ya existe relación previa
  const { data: existingRelation } = await supabase
    .from('relaciones_clientes')
    .select('id')
    .or(`and(cliente_id.eq.${currentCliente.id},cliente_relacionado_id.eq.${targetClient.id}),and(cliente_id.eq.${targetClient.id},cliente_relacionado_id.eq.${currentCliente.id})`)
    .limit(1);

  if (!existingRelation || existingRelation.length === 0) {
    try {
      await insertRelacion({
        cliente_id: currentCliente.id,
        cliente_relacionado_id: targetClient.id,
        tipo_relacion: tipoRelacion,
        descripcion: relativeData.detalles || 'Detectado desde conversación de chat'
      });
    } catch (err) {
      if (err?.code !== '23505') console.error('[clientExtractionService] Error creando relación de familiar:', err);
    }
  }

  return { targetClient, isNew };
}

/**
 * Dado un documento ya extraído por la IA, decide a quién pertenecen sus
 * datos -- al cliente actual, o a uno relacionado si detectPersonMismatch da
 * true -- y los aplica (skipIfAlreadyFilled: true, nunca pisa un dato ya
 * cargado a mano). Si es de otra persona, además mueve el documento con
 * `moveDocument` (el mecanismo de "mover" difiere según el canal: subida
 * individual usa reassignDocument sobre un solo id, el organizador masivo
 * hace lo mismo por cada documento de la corrida).
 *
 * Comparte la misma lógica entre useClientViewDocuments.handleConfirmUpload
 * (un documento nuevo) y organizeClientDocuments (todos los documentos ya
 * subidos de un cliente) para que ambos flujos se comporten idéntico.
 *
 * @returns {Promise<{ moved: boolean, targetClient: object, isNewClient: boolean }>}
 */
export async function resolvePersonAndApplyData({ currentCliente, extractedData, customFieldsConfig = [], moveDocument }) {
  // Si la imagen está borrosa o ilegible, NO inventar datos ni autocompletar la ficha
  if (extractedData.DOCUMENTO_BORROSO === true || extractedData.ILEGIBLE === true) {
    return {
      moved: false,
      targetClient: currentCliente,
      isNewClient: false,
      isBlurry: true,
      motivoIlegible: extractedData.MOTIVO_ILEGIBLE || 'Imagen borrosa o de baja resolución'
    };
  }

  if (detectPersonMismatch(currentCliente, extractedData)) {
    const { targetClient, isNewClient } = await resolveOrCreateRelatedClient({ currentCliente, extractedData });

    const tipoDoc = extractedData.TIPO_DOCUMENTO || 'DOCUMENTO';
    const personaNombre = targetClient.nombre || extractedData.NOMBRE_COMPLETO || '';
    const suggestedFileName = personaNombre ? `${tipoDoc.toUpperCase()} - ${personaNombre.toUpperCase()}` : null;

    if (moveDocument) await moveDocument(targetClient.id, suggestedFileName);

    await applyExtractedDataToClient({
      targetClientId: targetClient.id,
      extractedData,
      customFieldsConfig,
      skipIfAlreadyFilled: true,
    });
    return { moved: true, targetClient, isNewClient, suggestedFileName, isBlurry: false };
  }

  await applyExtractedDataToClient({
    targetClientId: currentCliente.id,
    extractedData,
    customFieldsConfig,
    skipIfAlreadyFilled: true,
  });
  return { moved: false, targetClient: currentCliente, isNewClient: false, isBlurry: false };
}

async function downloadDocBlob(doc) {
  const isPendiente = typeof doc.id === 'string' && doc.id.includes('-');
  const bucket = isPendiente ? 'whatsapp_media' : 'documentos_operacionales';
  let path = doc.url_archivo;
  if (path?.startsWith('http')) {
    const parts = path.split(`/${bucket}/`);
    path = parts.length === 2 ? decodeURIComponent(parts[1].split('?')[0]) : null;
  }
  if (!path) throw new Error('No se pudo resolver la ruta del archivo en el storage.');
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw error || new Error('No se pudo descargar el archivo.');
  return data;
}

const isAnalyzableDoc = (doc) => {
  if (doc.tipo_contenido?.startsWith('image/')) return true;
  if (doc.tipo_contenido === 'application/pdf') return true;
  const name = (doc.nombre_archivo || '').toLowerCase();
  return name.endsWith('.pdf') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
};

/**
 * "Organizar documentos" -- botón en la lista de documentos del cliente.
 * Recorre TODOS sus documentos analizables (imágenes/PDFs que no estén ya
 * descartados), corre la extracción IA de cada uno y:
 *   - Si no encuentra ningún dato legible -> lo descarta (estado 'rechazado'
 *     en documentos_operacionales, usando la columna que ya existía en el
 *     schema pero no se usaba desde ningún lado del código; los documentos
 *     de WhatsApp en documentos_pendientes no tienen esa columna, así que
 *     esos se dejan sin tocar -- se cuentan como "omitidos").
 *   - Si detecta que es de otra persona -> crea/vincula el cliente
 *     relacionado y le mueve el documento (resolvePersonAndApplyData).
 *   - Si es del cliente actual -> aplica los datos extraídos (solo campos
 *     todavía vacíos).
 * Corre secuencial (no en paralelo) para no reventar el límite de tokens/min
 * de Groq mandando varias imágenes a la vez.
 *
 * @returns {Promise<{analizados: number, movidos: number, aplicados: number, descartados: number, omitidos: number, errores: Array}>}
 */
export async function organizeClientDocuments({ clienteId, extraCustomFieldsForAi = [] }) {
  const documentos = await getDocuments(clienteId);
  const candidatos = documentos.filter(d => isAnalyzableDoc(d) && d.estado !== 'rechazado');

  const resumen = { analizados: 0, movidos: 0, aplicados: 0, descartados: 0, omitidos: 0, errores: [] };

  for (const doc of candidatos) {
    try {
      const blob = await downloadDocBlob(doc);
      const isPdf = doc.tipo_contenido === 'application/pdf' || (doc.nombre_archivo || '').toLowerCase().endsWith('.pdf');

      let fileOrBase64 = blob;
      if (isPdf) {
        const { convertPdfPageToImageBase64 } = await import('./pdfToImage');
        ({ base64: fileOrBase64 } = await convertPdfPageToImageBase64(blob));
      }

      const aiData = await analyzeDocumentImage(fileOrBase64, extraCustomFieldsForAi);
      resumen.analizados += 1;

      // Si la imagen está borrosa o ilegible, marcar claramente y no inventar datos
      if (aiData.DOCUMENTO_BORROSO === true || aiData.ILEGIBLE === true) {
        const motivo = aiData.MOTIVO_ILEGIBLE || 'Imagen borrosa o de baja calidad';
        const isPendiente = typeof doc.id === 'string' && doc.id.includes('-');
        const table = isPendiente ? 'documentos_pendientes' : 'documentos_operacionales';

        const originalName = doc.nombre_archivo || 'Documento';
        const flaggedName = originalName.startsWith('⚠️ BORROSO - ') ? originalName : `⚠️ BORROSO - ${originalName}`;

        await supabase.from(table).update({
          nombre_archivo: flaggedName,
          ...(isPendiente ? {} : { motivo_rechazo: motivo })
        }).eq('id', doc.id);

        resumen.errores.push({
          documentoId: doc.id,
          nombre: doc.nombre_archivo,
          error: `Documento borroso (${motivo}). La IA no inventó datos; se requiere foto nítida.`
        });
        resumen.descartados += 1;
        continue;
      }

      const tieneDatos = Object.keys(aiData).filter(k => aiData[k] && !['DOCUMENTO_BORROSO', 'ILEGIBLE', 'MOTIVO_ILEGIBLE'].includes(k)).length > 0;
      if (!tieneDatos) {
        const isPendiente = typeof doc.id === 'string' && doc.id.includes('-');
        if (isPendiente) {
          resumen.omitidos += 1;
        } else {
          await supabase.from('documentos_operacionales')
            .update({ estado: 'rechazado', motivo_rechazo: 'Sin datos legibles (organizador IA)' })
            .eq('id', doc.id);
          resumen.descartados += 1;
        }
        continue;
      }

      // Recargar el cliente en cada vuelta: si un documento anterior en esta
      // misma corrida ya llenó un campo suyo, skipIfAlreadyFilled tiene que
      // verlo actualizado, no la copia que teníamos en memoria al empezar.
      const clienteActual = await getCliente(clienteId);
      const { moved } = await resolvePersonAndApplyData({
        currentCliente: clienteActual,
        extractedData: aiData,
        customFieldsConfig: extraCustomFieldsForAi,
        moveDocument: (targetId, newName) => reassignDocument(doc.id, targetId, newName),
      });

      if (moved) {
        resumen.movidos += 1;
      } else {
        resumen.aplicados += 1;
        // Auto-renombrar también el documento del titular para que quede limpio y uniforme
        const tipoDoc = aiData.TIPO_DOCUMENTO || 'DOCUMENTO';
        const personaNombre = clienteActual.nombre || aiData.NOMBRE_COMPLETO || '';
        if (personaNombre) {
          const formattedName = `${tipoDoc.toUpperCase()} - ${personaNombre.toUpperCase()}`;
          const isUuid = typeof doc.id === 'string' && doc.id.includes('-');
          const table = isUuid ? 'documentos_pendientes' : 'documentos_operacionales';
          supabase.from(table).update({ nombre_archivo: formattedName }).eq('id', doc.id);
        }
      }
    } catch (err) {
      console.error(`[clientExtractionService] Error organizando documento ${doc.id}:`, err);
      resumen.errores.push({ documentoId: doc.id, nombre: doc.nombre_archivo, error: err.message });
    }
  }

  return resumen;
}
