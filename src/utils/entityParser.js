/**
 * entityParser.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Parser determinista y validadores de alta precisión para entidades de
 * inmigración y contacto en Brasil y Cuba.
 *
 * Funciones:
 * 1. validateAndFormatCpf: Validación algorítmica módulo 11 + formato XXX.XXX.XXX-XX.
 * 2. validateAndFormatEmail: Normalización a minúsculas y regex RFC.
 * 3. validateAndFormatPhone: Teléfono brasileño (E.164 o con DDD).
 * 4. validateAndFormatDate: Conversión universal a YYYY-MM-DD y DD/MM/YYYY.
 * 5. parseBrazilianAddress: Detección estructurada de calles, números, barrios y CEPs.
 * 6. extractEntitiesRegex: Extracción matemática sin alucinaciones desde chats y textos.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Valida un CPF mediante el algoritmo matemático oficial de la Receita Federal
 * (módulo 11 con los 2 dígitos verificadores).
 * @param {string} rawCpf
 * @returns {string|null} CPF formateado XXX.XXX.XXX-XX si es válido, o null si es inválido.
 */
export function validateAndFormatCpf(rawCpf) {
  if (!rawCpf) return null;
  const digits = String(rawCpf).replace(/\D/g, '');
  if (digits.length !== 11) return null;

  // Descartar secuencias con todos los dígitos iguales (00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(digits)) return null;

  // 1er dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(digits.charAt(9), 10)) return null;

  // 2do dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(digits.charAt(10), 10)) return null;

  // Formatear XXX.XXX.XXX-XX
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Valida y normaliza un correo electrónico.
 */
export function validateAndFormatEmail(rawEmail) {
  if (!rawEmail) return null;
  const clean = String(rawEmail).trim().toLowerCase();
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  return emailRegex.test(clean) ? clean : null;
}

/**
 * Valida y formatea un teléfono brasileño o internacional.
 */
export function validateAndFormatPhone(rawPhone) {
  if (!rawPhone) return null;
  const digits = String(rawPhone).replace(/\D/g, '');

  // Teléfono celular de Brasil con DDD (11 dígitos, ej. 11987654321 o 41991533052)
  if (digits.length === 11 && /^[1-9]{2}9\d{8}$/.test(digits)) {
    return `+55${digits}`;
  }

  // Teléfono fijo de Brasil con DDD (10 dígitos, ej. 1133334444)
  if (digits.length === 10 && /^[1-9]{2}[2-8]\d{7}$/.test(digits)) {
    return `+55${digits}`;
  }

  // Si ya tiene código de país Brasil 55 (ej. 5511987654321)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return `+${digits}`;
  }

  // Teléfono internacional general (entre 8 y 15 dígitos)
  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Normaliza cualquier formato de fecha a:
 * - iso: YYYY-MM-DD
 * - slash: DD/MM/YYYY
 */
export function validateAndFormatDate(rawDate) {
  if (!rawDate) return { iso: null, slash: null };
  const str = String(rawDate).trim();

  // Caso 1: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidDate(y, m, d)) {
      const padM = String(m).padStart(2, '0');
      const padD = String(d).padStart(2, '0');
      return { iso: `${y}-${padM}-${padD}`, slash: `${padD}/${padM}/${y}` };
    }
  }

  // Caso 2: DD/MM/YYYY
  const slashMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (slashMatch) {
    const d = parseInt(slashMatch[1], 10);
    const m = parseInt(slashMatch[2], 10);
    const y = parseInt(slashMatch[3], 10);
    if (isValidDate(y, m, d)) {
      const padM = String(m).padStart(2, '0');
      const padD = String(d).padStart(2, '0');
      return { iso: `${y}-${padM}-${padD}`, slash: `${padD}/${padM}/${y}` };
    }
  }

  // Caso 3: Texto tipo "15 de octubre de 1990" o "15/out/1990"
  const MESES = {
    enero: 1, janeiro: 1, jan: 1, ene: 1,
    febrero: 2, fevereiro: 2, feb: 2, fev: 2,
    marzo: 3, marco: 3, março: 3, mar: 3,
    abril: 4, apr: 4, abr: 4,
    mayo: 5, maio: 5, may: 5, mai: 5,
    junio: 6, junho: 6, jun: 6,
    julio: 7, julho: 7, jul: 7,
    agosto: 8, aug: 8, ago: 8,
    septiembre: 9, setembro: 9, sep: 9, set: 9,
    octubre: 10, outubro: 10, oct: 10, out: 10,
    noviembre: 11, novembro: 11, nov: 11,
    diciembre: 12, dezembro: 12, dec: 12, dez: 12,
  };

  const textMatch = str.toLowerCase().match(/(\d{1,2})\s*(?:de|\/|-)\s*([a-zçãéíóú]+)\s*(?:de|\/|-)\s*(\d{4})/i);
  if (textMatch) {
    const d = parseInt(textMatch[1], 10);
    const mesKey = textMatch[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const m = MESES[mesKey];
    const y = parseInt(textMatch[3], 10);
    if (m && isValidDate(y, m, d)) {
      const padM = String(m).padStart(2, '0');
      const padD = String(d).padStart(2, '0');
      return { iso: `${y}-${padM}-${padD}`, slash: `${padD}/${padM}/${y}` };
    }
  }

  return { iso: null, slash: null };
}

function isValidDate(year, month, day) {
  if (year < 1900 || year > 2050) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * Normaliza nombres a formato legible y profesional (Capitalización correcta).
 */
export function formatPersonName(rawName) {
  if (!rawName) return '';
  const clean = String(rawName).trim().replace(/\s+/g, ' ');
  const parts = clean.split(' ');
  const lowercaseWords = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'das', 'do', 'dos', 'e', 'y']);

  return parts
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && lowercaseWords.has(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Parsea un texto de dirección brasileña extrayendo sus componentes.
 * Ejemplo: "Rua Horacio Vergueiro Rudge 225, Casa Verde, 02512060 SP"
 * @param {string} text
 * @returns {object|null}
 */
export function parseBrazilianAddress(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  if (clean.length < 5) return null;

  // Extraer CEP (8 dígitos con o sin guion)
  const cepMatch = clean.match(/\b(\d{5})[- ]?(\d{3})\b/);
  const cep = cepMatch ? `${cepMatch[1]}-${cepMatch[2]}` : '';

  // Extraer Estado / UF (siglas conocidas al final o con coma)
  const UF_LIST = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  let estado = '';
  for (const uf of UF_LIST) {
    const ufRegex = new RegExp(`\\b${uf}\\b`, 'i');
    if (ufRegex.test(clean)) {
      estado = uf.toUpperCase();
      break;
    }
  }

  // Extraer número de casa/inmueble (ej. nº 123, n 123, 123,)
  const numMatch = clean.match(/(?:n[ºo°]?\s*|,\s*|^|\s)(\d{1,5})(?:\s*[,-]|\s*$)/i);
  const numero = numMatch ? numMatch[1].trim() : '';

  // Extraer complemento (apto, bloco, casa)
  const compMatch = clean.match(/\b(apto|apartamento|bloco|casa|fundos|sl|sala|lote|qd|quadra)\s*[\d\w]+/i);
  const complemento = compMatch ? compMatch[0].trim() : '';

  // Ciudad tentativa
  let cidade = '';
  if (estado === 'SP' && /s[aã]o paulo/i.test(clean)) cidade = 'São Paulo';
  else if (estado === 'SC' && /florian[oó]polis/i.test(clean)) cidade = 'Florianópolis';
  else if (estado === 'SC' && /joinville/i.test(clean)) cidade = 'Joinville';
  else if (estado === 'SC' && /itaja[ií]/i.test(clean)) cidade = 'Itajaí';
  else if (estado === 'PR' && /curitiba/i.test(clean)) cidade = 'Curitiba';
  else if (estado === 'RJ' && /rio de janeiro/i.test(clean)) cidade = 'Rio de Janeiro';

  // Calle / logradouro (intenta tomar la primera parte antes del número o coma)
  let endereco = clean;
  if (numero) {
    const splitNum = clean.split(new RegExp(`\\b${numero}\\b`))[0];
    if (splitNum && splitNum.length > 3) {
      endereco = splitNum.replace(/,\s*$/, '').trim();
    }
  } else if (clean.includes(',')) {
    endereco = clean.split(',')[0].trim();
  }

  return {
    endereco,
    numero,
    complemento,
    bairro: '',
    cidade,
    estado,
    cep,
    texto_original: clean,
  };
}

/**
 * Escanea un texto (ej. mensaje de WhatsApp, transcripción) y extrae determinísticamente
 * entidades válidas: CPF, Email, Teléfono, CEP, Pasaporte.
 * @param {string} text
 * @returns {object} { cpfs: string[], emails: string[], phones: string[], ceps: string[], passaporte: string|null }
 */
export function extractEntitiesRegex(text) {
  if (!text || typeof text !== 'string') {
    return { cpfs: [], emails: [], phones: [], ceps: [], passaporte: null };
  }

  const results = {
    cpfs: [],
    emails: [],
    phones: [],
    ceps: [],
    passaporte: null,
  };

  // 1. CPFs: buscar secuencias de 11 dígitos con o sin puntuación
  const cpfCandidates = text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g) || [];
  // También secuencias de 11 dígitos puros aislados
  const pureDigits = text.match(/\b\d{11}\b/g) || [];
  const allCpfCandidates = [...new Set([...cpfCandidates, ...pureDigits])];

  for (const cand of allCpfCandidates) {
    const valid = validateAndFormatCpf(cand);
    if (valid && !results.cpfs.includes(valid)) {
      results.cpfs.push(valid);
    }
  }

  // 2. Emails
  const emailCandidates = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [];
  for (const email of emailCandidates) {
    const valid = validateAndFormatEmail(email);
    if (valid && !results.emails.includes(valid)) {
      results.emails.push(valid);
    }
  }

  // 3. Teléfonos
  const phoneCandidates = text.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-.\s]?\d{4}\b/g) || [];
  for (const phone of phoneCandidates) {
    const valid = validateAndFormatPhone(phone);
    // Asegurarse de que no sea un CPF ya detectado
    const isCpf = results.cpfs.some(c => c.replace(/\D/g, '') === phone.replace(/\D/g, ''));
    if (valid && !isCpf && !results.phones.includes(valid)) {
      results.phones.push(valid);
    }
  }

  // 4. CEPs
  const cepMatches = text.match(/\b\d{5}-?\d{3}\b/g) || [];
  for (const cep of cepMatches) {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      const formatted = `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`;
      if (!results.ceps.includes(formatted)) {
        results.ceps.push(formatted);
      }
    }
  }

  // 5. Pasaporte Cubano: 1 o 2 letras seguidas de 6 dígitos numéricos (ej: H123456 o CB123456)
  const passMatch = text.match(/\b[A-Za-z]{1,2}\d{6}\b/);
  if (passMatch) {
    results.passaporte = passMatch[0].toUpperCase();
  }

  return results;
}
