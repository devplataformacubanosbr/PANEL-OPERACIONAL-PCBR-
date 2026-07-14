/**
 * clientView.constants.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Constantes y helpers puros compartidos por ClientView y sus sub-componentes.
 * Extraídos del monolito ClientView.jsx para mejorar mantenibilidad.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Convierte DD/MM/YYYY → YYYY-MM-DD (para inputs tipo date) */
export function toIsoDate(val) {
  if (!val) return '';
  if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;
  const parts = val.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return val;
}

/** Convierte YYYY-MM-DD → DD/MM/YYYY (para visualización) */
export function toSlashDate(val) {
  if (!val) return '';
  const parts = val.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return val;
}

// ── Enum options ─────────────────────────────────────────────────────────────

export const ESTADO_CIVIL_OPTIONS = [
  "Casado(a)",
  "Divorciado(a)",
  "Outro",
  "Separado(a) Judicialmente",
  "Solteiro(a)",
  "União Estável",
  "Viúvo(a)"
];

export const SEXO_OPTIONS = [
  "Masculino",
  "Feminino"
];

// ── Campos fijos de la tabla `clientes` ──────────────────────────────────────
// Definidos una sola vez fuera del componente para evitar recrearlos en cada render.

export const FIXED_FIELDS_CATALOG = [
  { id: 'id_kommo', nombre_campo: 'ID Kommo (Opcional)', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'nombre', nombre_campo: 'Nombre', requerido: true, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'cpf', nombre_campo: 'CPF', requerido: true, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'email', nombre_campo: 'Email', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'telefono', nombre_campo: 'Teléfono', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'fecha_nacimiento', nombre_campo: 'Fecha Nacimiento', requerido: true, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'estado_civil', nombre_campo: 'Estado Civil', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'sexo', nombre_campo: 'Sexo', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'nacionalidad', nombre_campo: 'Nacionalidad', requerido: true, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'pais', nombre_campo: 'País de Origen', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'lugar_nacimiento', nombre_campo: 'Lugar de Nacimiento', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'estado_federal', nombre_campo: 'Estado de Origen', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'ciudad', nombre_campo: 'Ciudad de Origen', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'direccion', nombre_campo: 'Dirección Completa', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },

  // ── Campos migratorios (antes en `campos_personalizados` JSONB, ahora columnas fijas) ──
  { id: 'rnm', nombre_campo: 'RNM', requerido: false, es_fijo: true, category_name: 'Documentos de Identidad' },
  { id: 'numero_refugio', nombre_campo: 'Protocolo de Refugio', requerido: false, es_fijo: true, category_name: 'Documentos de Identidad' },
  { id: 'fecha_vencimiento_refugio', nombre_campo: 'Fecha Vencimiento Refugio', requerido: false, es_fijo: true, category_name: 'Documentos de Identidad' },
  { id: 'numero_pasaporte', nombre_campo: 'Pasaporte', requerido: false, es_fijo: true, category_name: 'Documentos de Identidad' },
  { id: 'fecha_emision_pasaporte', nombre_campo: 'Fecha Emisión Pasaporte', requerido: false, es_fijo: true, category_name: 'Documentos de Identidad' },
  { id: 'fecha_vencimiento_pasaporte', nombre_campo: 'Fecha Vencimiento Pasaporte', requerido: false, es_fijo: true, category_name: 'Documentos de Identidad' },
  { id: 'carnet_identidad', nombre_campo: 'Carnet de Identidad', requerido: false, es_fijo: true, category_name: 'Documentos de Identidad' },
  { id: 'policia_federal', nombre_campo: 'Policía Federal', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'fecha_entrada_brasil', nombre_campo: 'Entrada a Brasil', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'lugar_entrada_brasil', nombre_campo: 'Lugar Entrada', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
  { id: 'nombre_madre', nombre_campo: 'Nombre Madre', requerido: false, es_fijo: true, category_name: 'Datos Familiares' },
  { id: 'nombre_padre', nombre_campo: 'Nombre Padre', requerido: false, es_fijo: true, category_name: 'Datos Familiares' },
  { id: 'tramite', nombre_campo: 'Trámite Solicitado', requerido: false, es_fijo: true, category_name: 'Informaciones Personales' },
];

// ── Colores por estado de trámite ────────────────────────────────────────────

export const TRAMITE_COLORS = {
  completada: { bg: 'rgba(29,158,117,0.18)', color: '#1D9E75' },
  procesando: { bg: 'rgba(55,138,221,0.18)', color: '#378ADD' },
  cancelada:  { bg: 'rgba(216,90,48,0.18)',  color: '#D85A30' },
  pendiente:  { bg: 'rgba(186,117,23,0.18)', color: '#BA7517' },
};
