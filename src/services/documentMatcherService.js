/**
 * documentMatcherService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de coincidencia inteligente entre documentos de un cliente y los
 * requisitos configurados para un trámite o "PDF Único".
 *
 * Resuelve:
 * 1. Coincidencia por tipo estricto (`doc.tipo_documento === req.tipo_documento`).
 * 2. Coincidencia por prefijo/nombre estandarizado (`PASAPORTE - NOMBRE.jpg`).
 * 3. Sinónimos migratorios (ej. "RECIBO SISCONARE" ↔ "PROTOCOLO DE REFUGIO",
 *    "CARNET DE IDENTIDAD" ↔ "CEDULA", "COMPROBANTE DE RESIDENCIA" ↔ "DOMICILIO").
 * 4. Coincidencia por etiqueta descriptiva (`req.tipo_dato`, ej. formularios
 *    específicos como "DECLARACION GERAL DO EMIGRANTE" vs "REQUERIMIENTO").
 * 5. Exclusión automática de borradores anteriores, archivos borrosos o rechazados.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const VALID_MERGE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/**
 * Normaliza un string para comparación (sin acentos, mayúsculas, espacios limpios).
 */
export function normalizeText(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Diccionario de sinónimos y alias por categoría migratoria.
 */
const ALIAS_MAP = {
  PASAPORTE: [
    'PASAPORTE', 'PASAPORTE CUBANO', 'PASSAPORTE', 'PASSPORT', 'PASAP'
  ],
  CPF: [
    'CPF', 'CADASTRO DE PESSOAS FISICAS', 'CADASTRO PESSOA FISICA'
  ],
  'RECIBO SISCONARE': [
    'RECIBO SISCONARE', 'SISCONARE', 'PROTOCOLO SISCONARE', 'SOLICITUD DE REFUGIO',
    'PROTOCOLO DE REFUGIO', 'REFUGIO', 'PEDIDO DE REFUGIO', 'TERMO SISCONARE'
  ],
  'CARNET DE IDENTIDAD': [
    'CARNET DE IDENTIDAD', 'CARNET IDENTIDAD', 'CARNET', 'CEDULA', 'CEDULA DE IDENTIDAD',
    'DNI', 'DOCUMENTO IDENTIDAD', 'DOCUMENTO DE IDENTIDAD', 'TARJETA DE IDENTIDAD', 'CI'
  ],
  RNM: [
    'RNM', 'CRNM', 'CIE', 'REGISTRO NACIONAL MIGRATORIO', 'CARTEIRA DE REGISTRO NACIONAL MIGRATORIO'
  ],
  'COMPROBANTE DE RESIDENCIA': [
    'COMPROBANTE DE RESIDENCIA', 'COMPROBANTE RESIDENCIA', 'COMPROVANTE DE RESIDENCIA',
    'RESIDENCIA', 'DOMICILIO', 'COMPROBANTE DE DOMICILIO', 'COMPROVANTE RESIDENCIA',
    'COMPROBANTE', 'COMPROVANTE'
  ],
  'FOTO 3X4': [
    'FOTO 3X4', 'FOTO 3 X 4', 'FOTO TIPO CARNET', 'FOTO CARNET', 'FOTO DE FRENTE', 'FOTO PERFIL', 'FOTO'
  ],
  FOTO: [
    'FOTO', 'FOTO 3X4', 'FOTO 3 X 4', 'FOTOGRAFIA', 'FOTO CARNET'
  ],
  FORMULARIO: [
    'FORMULARIO', 'DECLARACION', 'DECLARACAO', 'REQUERIMIENTO', 'REQUERIMENTO',
    'DECLARACION GERAL', 'DECLARACION GERAL DO EMIGRANTE', 'TERMO'
  ],
  ANTECEDENTES: [
    'ANTECEDENTES', 'ANTECEDENTES PENALES', 'CERTIFICADO DE ANTECEDENTES', 'RECORD POLICIAL'
  ]
};

/**
 * Verifica si un documento es apto físicamente para integrarse a un PDF.
 */
export function isValidForMerge(doc) {
  if (!doc) return false;
  if (doc.estado === 'rechazado') return false;

  // Documentos marcados como borrosos nunca deben entrar
  const name = (doc.nombre_archivo || '').toLowerCase();
  if (name.includes('borroso') || doc.motivo_rechazo?.toLowerCase().includes('borroso')) return false;

  // Evitar anidar un PDF único anterior dentro de uno nuevo
  if (doc.tipo_documento === 'PDF_UNICO_BORRADOR' || name.startsWith('pdf unico')) return false;

  if (doc.tipo_contenido && VALID_MERGE_TYPES.includes(doc.tipo_contenido)) return true;
  return name.endsWith('.pdf') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
}

/**
 * Evalúa si un documento dado cumple con un requisito del checklist.
 * @param {object} doc - Documento ({ tipo_documento, nombre_archivo, ... })
 * @param {object|string} req - Requisito ({ tipo_documento, tipo_dato }) o string
 * @returns {boolean}
 */
export function documentMatchesRequirement(doc, req) {
  if (!doc) return false;
  if (!isValidForMerge(doc)) return false;

  const reqTypeRaw = typeof req === 'string' ? req : (req?.tipo_documento || '');
  const reqLabelRaw = typeof req === 'object' ? (req?.tipo_dato || '') : '';

  const reqTypeNorm = normalizeText(reqTypeRaw);
  const reqLabelNorm = normalizeText(reqLabelRaw);

  const docTypeNorm = normalizeText(doc.tipo_documento || '');
  const docNameNorm = normalizeText(doc.nombre_archivo || '');

  // 1. Coincidencia exacta de tipo_documento
  if (reqTypeNorm && docTypeNorm && docTypeNorm === reqTypeNorm) {
    // Si el tipo es genérico (ej. FORMULARIO) y el requisito tiene un subtipo/etiqueta específica,
    // verificar que el nombre del archivo también coincida con la etiqueta
    if (reqTypeNorm === 'FORMULARIO' && reqLabelNorm) {
      if (docNameNorm.includes(reqLabelNorm) || reqLabelNorm.includes(docNameNorm.replace(/\.[^/.]+$/, ''))) {
        return true;
      }
      // Si la etiqueta tiene palabras clave como "DECLARACION" o "REQUERIMIENTO"
      const keywords = reqLabelNorm.split(' ').filter(w => w.length > 3);
      if (keywords.some(k => docNameNorm.includes(k))) {
        return true;
      }
      return false;
    }
    return true;
  }

  // 2. Coincidencia por prefijo del nombre (ej: "PASAPORTE - JUAN PEREZ.jpg")
  const prefixMatch = docNameNorm.match(/^([A-Z0-9_\s]{2,30})\s*-\s*/);
  const docPrefix = prefixMatch ? prefixMatch[1].trim() : '';

  if (docPrefix && (docPrefix === reqTypeNorm || docPrefix === reqLabelNorm)) {
    return true;
  }

  // 3. Coincidencia por alias de categoría
  for (const [canonical, aliases] of Object.entries(ALIAS_MAP)) {
    const isTargetCategory = (reqTypeNorm === canonical || aliases.includes(reqTypeNorm) || reqLabelNorm === canonical || aliases.includes(reqLabelNorm));
    if (isTargetCategory) {
      // ¿El documento tiene este tipo o este prefijo?
      if (aliases.includes(docTypeNorm) || (docPrefix && aliases.includes(docPrefix))) {
        return true;
      }
      // ¿El nombre del archivo contiene algún alias representativo?
      if (aliases.some(a => a.length >= 4 && docNameNorm.includes(a))) {
        return true;
      }
    }
  }

  // 4. Si el requisito tiene una etiqueta muy específica (ej. "DECLARACION GERAL DO EMIGRANTE")
  if (reqLabelNorm) {
    if (docNameNorm.includes(reqLabelNorm)) return true;
    const significantWords = reqLabelNorm.split(' ').filter(w => w.length > 4);
    if (significantWords.length > 0 && significantWords.every(w => docNameNorm.includes(w))) {
      return true;
    }
  }

  return false;
}

/**
 * Encuentra el mejor documento para un requisito específico dentro de una lista.
 * Prefiere documentos no utilizados previamente y los más recientes.
 * @param {Array<object>} docs - Lista de documentos mergeables
 * @param {object|string} req - Requisito
 * @param {Set<string|number>} usedDocIds - IDs ya asignados a otros slots
 * @returns {object|null}
 */
export function findBestDocForRequirement(docs, req, usedDocIds = new Set()) {
  if (!docs || docs.length === 0) return null;

  const matches = docs.filter(d => documentMatchesRequirement(d, req));
  if (matches.length === 0) return null;

  // Priorizar los que no han sido usados en otro slot
  const unused = matches.filter(d => !usedDocIds.has(String(d.id)));
  const candidates = unused.length > 0 ? unused : matches;

  // Ordenar por fecha descendente (el más reciente primero)
  return [...candidates].sort((a, b) => new Date(b.creado_en || 0) - new Date(a.creado_en || 0))[0] || null;
}

/**
 * Construye la lista de slots resueltos para una lista de requisitos y documentos.
 * @param {Array<object>} requisitos - Requisitos del trámite
 * @param {Array<object>} docs - Documentos del cliente
 * @returns {Array<{req: object, doc: object|null, label: string, obligatorio: boolean}>}
 */
export function buildSlotsForRequirements(requisitos, docs) {
  const mergeableDocs = (docs || []).filter(isValidForMerge);
  const usedIds = new Set();

  return requisitos.map(req => {
    const doc = findBestDocForRequirement(mergeableDocs, req, usedIds);
    if (doc) {
      usedIds.add(String(doc.id));
    }
    return {
      req,
      doc,
      label: req.tipo_dato || req.tipo_documento,
      obligatorio: !!req.obligatorio,
    };
  });
}
