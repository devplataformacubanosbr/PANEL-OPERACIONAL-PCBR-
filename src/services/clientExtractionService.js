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

const FIXED_COLUMN_IDS = new Set(FIXED_FIELDS_CATALOG.map(f => f.id));

/** Mapeo de claves IA → columnas de la tabla `clientes` */
export const AI_FIELD_MAP = {
  'NOMBRE_COMPLETO': 'nombre',
  'CPF': 'cpf',
  'RNM': 'rnm',
  'CARNET_IDENTIDAD': 'carnet_identidad',
  'FECHA_NACIMIENTO': 'fecha_nacimiento',
  'LUGAR_NACIMIENTO': 'lugar_nacimiento',
  'NACIONALIDAD': 'nacionalidad',
  'NUMERO_DOCUMENTO': 'numero_pasaporte',
  'NUMERO_REFUGIO': 'numero_refugio',
  'FECHA_EMISION_PASAPORTE': 'fecha_emision_pasaporte',
  'FECHA_VENCIMIENTO_PASAPORTE': 'fecha_vencimiento_pasaporte',
  'FECHA_VENCIMIENTO_REFUGIO': 'fecha_vencimiento_refugio',
  'SEXO': 'sexo',
  'NOMBRE_MADRE': 'nombre_madre',
  'NOMBRE_PADRE': 'nombre_padre',
};

const AI_DATE_KEYS = new Set([
  'FECHA_NACIMIENTO',
  'FECHA_EMISION_PASAPORTE',
  'FECHA_VENCIMIENTO_PASAPORTE',
  'FECHA_VENCIMIENTO_REFUGIO',
]);

const AI_IGNORED_KEYS = new Set(['ILEGIBLE', 'TIPO_DOCUMENTO', 'NOMBRE_ARCHIVO']);

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

    const mappedCol = AI_FIELD_MAP[upperKey];
    if (mappedCol) {
      let finalValue;
      if (AI_DATE_KEYS.has(upperKey)) {
        const normalized = normalizeDateToDDMMYYYY(value);
        finalValue = normalized ? toIsoDate(normalized) : String(value).toUpperCase();
      } else {
        finalValue = String(value).toUpperCase();
      }

      if (FIXED_COLUMN_IDS.has(mappedCol)) {
        const currentValue = clientRow ? clientRow[mappedCol] : null;
        const isCurrentlyEmpty = currentValue === null || currentValue === undefined || String(currentValue).trim() === '';
        if (skipIfAlreadyFilled && !isCurrentlyEmpty) continue;
        updates[mappedCol] = finalValue;
        applied.push(mappedCol);
      } else {
        const currentValue = clientRow?.campos_personalizados?.[mappedCol];
        const isCurrentlyEmpty = currentValue === null || currentValue === undefined || String(currentValue).trim() === '';
        if (skipIfAlreadyFilled && !isCurrentlyEmpty) continue;
        customJsonUpdates[mappedCol] = finalValue;
        hasCustomJsonUpdates = true;
        applied.push(mappedCol);
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
