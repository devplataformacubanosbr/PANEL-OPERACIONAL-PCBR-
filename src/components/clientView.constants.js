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

  // ── Los 13 campos migratorios (rnm, numero_refugio, fecha_vencimiento_refugio,
  // numero_pasaporte, fecha_emision_pasaporte, fecha_vencimiento_pasaporte,
  // carnet_identidad, policia_federal, fecha_entrada_brasil, lugar_entrada_brasil,
  // nombre_madre, nombre_padre, tramite) ya NO están hardcodeados acá: viven como
  // filas dinámicas en `config_campos_clientes` y se guardan en
  // `clientes.campos_personalizados` (JSONB). Se mergean automáticamente en
  // ClientView.jsx vía `customFieldsConfig` con `is_custom_json: true`.
];

// ── Categorías por defecto de "Datos del Cliente" ────────────────────────────
// Estructurales: siempre se muestran, no se pueden borrar desde la ficha del
// cliente (ver ClientPersonalData.jsx). Cualquier otra categoría es dinámica,
// vive como texto libre en config_campos_clientes.categoria.

export const DEFAULT_CLIENT_CATEGORIES = ['Informaciones Personales', 'Datos Familiares', 'Documentos de Identidad'];

// ── Colores por estado de trámite ────────────────────────────────────────────

export const TRAMITE_COLORS = {
  completada: { bg: 'rgba(29,158,117,0.18)', color: '#1D9E75' },
  procesando: { bg: 'rgba(55,138,221,0.18)', color: '#378ADD' },
  cancelada:  { bg: 'rgba(216,90,48,0.18)',  color: '#D85A30' },
  pendiente:  { bg: 'rgba(186,117,23,0.18)', color: '#BA7517' },
};
