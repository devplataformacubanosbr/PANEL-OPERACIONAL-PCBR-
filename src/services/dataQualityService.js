/**
 * dataQualityService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de servicio para auditoría, limpieza, rescate y normalización masiva
 * de datos existentes en la base de datos (clientes, mensajes y documentos).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from '../supabaseClient';
import {
  validateAndFormatCpf,
  validateAndFormatEmail,
  validateAndFormatPhone,
  validateAndFormatDate,
  parseBrazilianAddress,
  extractEntitiesRegex
} from '../utils/entityParser';

/**
 * Obtiene un diagnóstico del estado actual de calidad de los datos en la base de datos.
 */
export async function getDatabaseHealthReport() {
  const [
    totalClientsRes,
    conCpfRes,
    formattedCpfRes,
    conEmailRes,
    conTelefonoRes,
    conNacimientoRes,
    conDireccionRes,
    conCustomFieldsRes,
    docsOpRes,
    docsPendRes,
    mensajesRes
  ] = await Promise.all([
    supabase.from('clientes').select('id', { count: 'exact', head: true }),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).not('cpf', 'is', null).neq('cpf', ''),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).filter('cpf', 'match', '^[0-9]{3}\\.[0-9]{3}\\.[0-9]{3}-[0-9]{2}$'),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).not('email', 'is', null).neq('email', ''),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).not('telefono', 'is', null).neq('telefono', ''),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).not('fecha_nacimiento', 'is', null).neq('fecha_nacimiento', ''),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).not('direccion', 'is', null).neq('direccion', '').neq('direccion', '{}'),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).not('campos_personalizados', 'is', null),
    supabase.from('documentos_operacionales').select('id', { count: 'exact', head: true }),
    supabase.from('documentos_pendientes').select('id', { count: 'exact', head: true }),
    supabase.from('mensajes').select('id', { count: 'exact', head: true }),
  ]);

  const totalClientes = totalClientsRes.count || 0;

  return {
    totalClientes,
    conCpf: conCpfRes.count || 0,
    cpfFormateados: formattedCpfRes.count || 0,
    cpfSinFormato: (conCpfRes.count || 0) - (formattedCpfRes.count || 0),
    sinCpf: totalClientes - (conCpfRes.count || 0),
    conEmail: conEmailRes.count || 0,
    conTelefono: conTelefonoRes.count || 0,
    conNacimiento: conNacimientoRes.count || 0,
    conDireccion: conDireccionRes.count || 0,
    conCamposPersonalizados: conCustomFieldsRes.count || 0,
    documentosOperacionales: docsOpRes.count || 0,
    documentosPendientes: docsPendRes.count || 0,
    totalMensajes: mensajesRes.count || 0,
  };
}

/**
 * Normaliza y valida todos los CPFs existentes en la tabla `clientes`.
 * Si tienen 11 dígitos y pasan el algoritmo módulo 11, los formatea a XXX.XXX.XXX-XX.
 */
export async function normalizeExistingCpfs(onProgress = null) {
  const { data: clients, error } = await supabase
    .from('clientes')
    .select('id, cpf')
    .not('cpf', 'is', null)
    .neq('cpf', '');

  if (error) throw error;
  if (!clients || clients.length === 0) return { checked: 0, updated: 0, invalid: 0 };

  let updated = 0;
  let invalid = 0;
  const total = clients.length;

  for (let i = 0; i < total; i++) {
    const c = clients[i];
    const formatted = validateAndFormatCpf(c.cpf);
    if (formatted) {
      if (formatted !== c.cpf) {
        await supabase.from('clientes').update({ cpf: formatted }).eq('id', c.id);
        updated += 1;
      }
    } else {
      invalid += 1;
    }

    if (onProgress && (i % 50 === 0 || i === total - 1)) {
      onProgress({ current: i + 1, total, updated, invalid });
    }
  }

  return { checked: total, updated, invalid };
}

/**
 * Normaliza todos los correos electrónicos de clientes a minúsculas y sin espacios.
 */
export async function normalizeExistingEmails() {
  const { data: clients, error } = await supabase
    .from('clientes')
    .select('id, email')
    .not('email', 'is', null)
    .neq('email', '');

  if (error) throw error;
  if (!clients) return { updated: 0 };

  let updated = 0;
  for (const c of clients) {
    const clean = validateAndFormatEmail(c.email);
    if (clean && clean !== c.email) {
      await supabase.from('clientes').update({ email: clean }).eq('id', c.id);
      updated += 1;
    }
  }

  return { updated };
}

/**
 * Rescata datos (CPF, Email, Teléfono, Dirección) desde los mensajes de WhatsApp/Kommo
 * de clientes que actualmente tienen esos campos vacíos.
 */
export async function harvestChatEntities(onProgress = null) {
  // 1. Obtener mensajes de clientes sin CPF o sin email
  const { data: messages, error } = await supabase
    .from('mensajes')
    .select('cliente_id, texto')
    .not('texto', 'is', null)
    .neq('texto', '')
    .order('fecha_recepcion', { ascending: false });

  if (error) throw error;
  if (!messages || messages.length === 0) return { cpfsFound: 0, emailsFound: 0, addressesFound: 0 };

  // Agrupar mensajes por cliente
  const clientMessages = new Map();
  for (const m of messages) {
    if (!m.cliente_id) continue;
    if (!clientMessages.has(m.cliente_id)) {
      clientMessages.set(m.cliente_id, []);
    }
    clientMessages.get(m.cliente_id).push(m.texto);
  }

  let cpfsFound = 0;
  let emailsFound = 0;
  let addressesFound = 0;
  const clientIds = [...clientMessages.keys()];
  const total = clientIds.length;

  for (let i = 0; i < total; i++) {
    const clientId = clientIds[i];
    const texts = clientMessages.get(clientId);
    const fullText = texts.join('\n');

    // Extraer entidades deterministas
    const entities = extractEntitiesRegex(fullText);

    // Verificar estado actual del cliente
    const { data: client } = await supabase
      .from('clientes')
      .select('id, cpf, email, telefono, direccion, ciudad, estado')
      .eq('id', clientId)
      .single();

    if (!client) continue;

    const updates = {};

    // 1. Aplicar CPF válido si no tenía
    if ((!client.cpf || client.cpf.trim() === '') && entities.cpfs.length > 0) {
      updates.cpf = entities.cpfs[0];
      cpfsFound += 1;
    }

    // 2. Aplicar Email si no tenía
    if ((!client.email || client.email.trim() === '') && entities.emails.length > 0) {
      updates.email = entities.emails[0];
      emailsFound += 1;
    }

    // 3. Aplicar Teléfono si no tenía
    if ((!client.telefono || client.telefono.trim() === '') && entities.phones.length > 0) {
      updates.telefono = entities.phones[0];
    }

    // 4. Aplicar Dirección si no tenía
    if ((!client.direccion || client.direccion === '{}') && entities.ceps.length > 0) {
      // Buscar la línea que contiene el CEP
      const addressLine = texts.find(t => entities.ceps.some(c => t.includes(c.replace('-', '')) || t.includes(c)));
      if (addressLine) {
        const parsedAddr = parseBrazilianAddress(addressLine);
        if (parsedAddr && parsedAddr.endereco) {
          updates.direccion = JSON.stringify(parsedAddr);
          if (parsedAddr.cidade && !client.ciudad) updates.ciudad = parsedAddr.cidade;
          if (parsedAddr.estado && !client.estado) updates.estado = parsedAddr.estado;
          addressesFound += 1;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('clientes').update(updates).eq('id', clientId);
    }

    if (onProgress && (i % 20 === 0 || i === total - 1)) {
      onProgress({ current: i + 1, total, cpfsFound, emailsFound, addressesFound });
    }
  }

  return { cpfsFound, emailsFound, addressesFound };
}

/**
 * Normaliza los nombres de tipos de documento en `documentos_operacionales`
 * (corrige registros guardados con nombres de archivo o variantes como tipo_documento).
 */
export async function normalizeDocumentTypes() {
  const { data: docs, error } = await supabase
    .from('documentos_operacionales')
    .select('id, tipo_documento, nombre_archivo');

  if (error) throw error;
  if (!docs) return { updated: 0 };

  let updated = 0;
  for (const doc of docs) {
    const rawType = (doc.tipo_documento || '').toUpperCase();
    let newType = null;

    if (rawType.startsWith('CPF - ') || rawType === 'CPF') newType = 'CPF';
    else if (rawType.startsWith('PASAPORTE - ') || rawType === 'PASAPORTE') newType = 'PASAPORTE';
    else if (rawType.startsWith('RNM - ') || rawType.startsWith('PROTOCOLO RNM - ') || rawType === 'RNM') newType = 'RNM';
    else if (rawType.startsWith('PROTOCOLO REFUGIO - ') || rawType.includes('SISCONARE')) newType = 'RECIBO SISCONARE';
    else if (rawType.startsWith('REQ ') || rawType.startsWith('FORMULARIO ') || rawType.startsWith('DESPACHO ') || rawType.startsWith('ALTERAÇÃO ')) newType = 'FORMULARIO';
    else if (rawType === 'FATURA.JPEG' || rawType.includes('FATURA')) newType = 'COMPROBANTE';
    else if (rawType === 'IMAGEN KOMMO') newType = 'DOCUMENTO';

    if (newType && newType !== doc.tipo_documento) {
      await supabase.from('documentos_operacionales').update({ tipo_documento: newType }).eq('id', doc.id);
      updated += 1;
    }
  }

  return { updated };
}

/**
 * Sincroniza campos migratorios almacenados en `campos_personalizados`
 * (ciudad, estado, etc.) hacia las columnas correspondientes de la tabla `clientes`.
 */
export async function synchronizeCustomFields() {
  const { data: clients, error } = await supabase
    .from('clientes')
    .select('id, ciudad, estado, direccion, campos_personalizados')
    .not('campos_personalizados', 'is', null);

  if (error) throw error;
  if (!clients) return { updated: 0 };

  let updated = 0;
  for (const c of clients) {
    const custom = c.campos_personalizados || {};
    const updates = {};

    // Sincronizar ciudad si estaba vacía en la columna pero presente en custom
    if ((!c.ciudad || c.ciudad.trim() === '') && (custom.cidade || custom.ciudad || custom.municipio)) {
      updates.ciudad = String(custom.cidade || custom.ciudad || custom.municipio).toUpperCase();
    }

    // Sincronizar estado si estaba vacío
    if ((!c.estado || c.estado.trim() === '') && (custom.estado || custom.uf)) {
      updates.estado = String(custom.estado || custom.uf).toUpperCase();
    }

    // Sincronizar dirección
    if ((!c.direccion || c.direccion === '{}') && (custom.endereco || custom.direccion)) {
      const dirVal = custom.endereco || custom.direccion;
      updates.direccion = typeof dirVal === 'object' ? JSON.stringify(dirVal) : String(dirVal);
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('clientes').update(updates).eq('id', c.id);
      updated += 1;
    }
  }

  return { updated };
}
