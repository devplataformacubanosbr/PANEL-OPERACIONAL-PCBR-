import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  validateAndFormatCpf,
  validateAndFormatEmail,
  validateAndFormatPhone,
  parseBrazilianAddress,
  extractEntitiesRegex
} from '../src/utils/entityParser.js';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runHarvest() {
  console.log('--- INICIANDO RESCATE DE DATOS DESDE CHATS ---');

  // 1. Obtener mensajes con texto
  console.log('Consultando mensajes...');
  let allMessages = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('mensajes')
      .select('id, cliente_id, texto')
      .not('texto', 'is', null)
      .neq('texto', '')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error consultando mensajes:', error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allMessages = allMessages.concat(data);
      page++;
      if (data.length < pageSize) hasMore = false;
    }
  }

  console.log(`Total mensajes cargados: ${allMessages.length}`);

  // Agrupar mensajes por cliente
  const clientMessages = new Map();
  for (const m of allMessages) {
    if (!m.cliente_id) continue;
    if (!clientMessages.has(m.cliente_id)) {
      clientMessages.set(m.cliente_id, []);
    }
    clientMessages.get(m.cliente_id).push(m.texto);
  }

  const clientIds = [...clientMessages.keys()];
  console.log(`Total clientes con mensajes analizados: ${clientIds.length}`);

  let cpfsFound = 0;
  let emailsFound = 0;
  let addressesFound = 0;
  let updatedClientsCount = 0;

  for (let i = 0; i < clientIds.length; i++) {
    const clientId = clientIds[i];
    const texts = clientMessages.get(clientId);
    const fullText = texts.join('\n');

    const entities = extractEntitiesRegex(fullText);

    // Si no encontró nada relevante en este cliente, continuar
    if (entities.cpfs.length === 0 && entities.emails.length === 0 && entities.ceps.length === 0) {
      continue;
    }

    // Consultar el cliente actual
    const { data: client, error: clientErr } = await supabase
      .from('clientes')
      .select('id, nombre, cpf, email, telefono, direccion, ciudad, estado')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) continue;

    const updates = {};

    // 1. Aplicar CPF válido si el cliente no tenía
    if ((!client.cpf || client.cpf.trim() === '') && entities.cpfs.length > 0) {
      updates.cpf = entities.cpfs[0];
      cpfsFound++;
      console.log(`[CLIENTE #${client.id} - ${client.nombre}] CPF rescatado: ${entities.cpfs[0]}`);
    }

    // 2. Aplicar Email si no tenía
    if ((!client.email || client.email.trim() === '') && entities.emails.length > 0) {
      updates.email = entities.emails[0];
      emailsFound++;
      console.log(`[CLIENTE #${client.id} - ${client.nombre}] Email rescatado: ${entities.emails[0]}`);
    }

    // 3. Aplicar Dirección si no tenía
    if ((!client.direccion || client.direccion === '{}') && entities.ceps.length > 0) {
      const addressLine = texts.find(t => entities.ceps.some(c => t.includes(c.replace('-', '')) || t.includes(c)));
      if (addressLine) {
        const parsedAddr = parseBrazilianAddress(addressLine);
        if (parsedAddr && parsedAddr.endereco) {
          updates.direccion = JSON.stringify(parsedAddr);
          if (parsedAddr.cidade && !client.ciudad) updates.ciudad = parsedAddr.cidade;
          if (parsedAddr.estado && !client.estado) updates.estado = parsedAddr.estado;
          addressesFound++;
          console.log(`[CLIENTE #${client.id} - ${client.nombre}] Dirección rescatada: ${parsedAddr.endereco}, ${parsedAddr.cidade || ''}`);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabase.from('clientes').update(updates).eq('id', clientId);
      if (!updErr) {
        updatedClientsCount++;
      } else {
        console.warn(`Error actualizando cliente #${clientId}:`, updErr.message);
      }
    }
  }

  console.log('\n=============================================');
  console.log('--- RESUMEN FINAL DE RESCATE DE DATOS ---');
  console.log(`Clientes actualizados exitosamente: ${updatedClientsCount}`);
  console.log(`CPFs válidos rescatados del chat: ${cpfsFound}`);
  console.log(`Emails rescatados del chat: ${emailsFound}`);
  console.log(`Direcciones estructuradas rescatadas: ${addressesFound}`);
  console.log('=============================================\n');
}

runHarvest().catch(console.error);
