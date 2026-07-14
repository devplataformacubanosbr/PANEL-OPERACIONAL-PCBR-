/**
 * clientesService.js
 * Capa de servicio — Agente 2 (Arquitecto)
 * Centraliza TODAS las llamadas a Supabase relacionadas con clientes.
 * Los componentes NO deben llamar a supabase.from() directamente.
 */
import { supabase } from '../supabaseClient';
import { registrarAccionHistorial } from './equipoService';
// ── Clientes ──────────────────────────────────────────────────────────────────
export const getCliente = async (id) => {
  const { data, error } = await supabase.from('clientes').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const getClientesBase = async () => {
  const { data, error } = await supabase.from('clientes').select('id, nombre, cpf');
  if (error) throw error;
  return data || [];
};

export const createCliente = async (clienteData) => {
  const { data, error } = await supabase.from('clientes').insert([clienteData]).select().single();
  if (error) throw error;
  return data;
};

export const updateCliente = async (id, updates) => {
  const { data, error } = await supabase.from('clientes').update(updates).eq('id', id).select().single();
  if (error) throw error;
  
  const desc = Object.keys(updates).map(k => `${k}: ${updates[k]}`).join(', ');
  registrarAccionHistorial(id, 'ACTUALIZAR_CLIENTE', `Actualizó datos: ${desc}`);
  
  return data;
};

export const deleteCliente = async (id) => {
  // Elimina en cascada: relaciones → documentos → cliente
  await supabase.from('relaciones_clientes').delete().or(`cliente_id.eq.${id},cliente_relacionado_id.eq.${id}`);
  await supabase.from('documentos_operacionales').delete().eq('id_cliente', id);
  const { error } = await supabase.from('clientes').delete().eq('id', id);
  if (error) throw error;
};



// ── Búsqueda ──────────────────────────────────────────────────────────────────
export const searchClientes = async (query) => {
  const sanitized = query.trim().replace(/[%_]/g, '\\$&'); // Escapar caracteres especiales de LIKE
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, cpf')
    .ilike('nombre', `%${sanitized}%`)
    .limit(50);
  if (error) throw error;
  return data || [];
};

// ── Relaciones ────────────────────────────────────────────────────────────────
export const getRelaciones = async (clientId) => {
  const { data, error } = await supabase
    .from('relaciones_clientes')
    .select('*, cliente_principal:cliente_id(id,nombre,cpf), cliente_secundario:cliente_relacionado_id(id,nombre,cpf)')
    .or(`cliente_id.eq.${clientId},cliente_relacionado_id.eq.${clientId}`);
  if (error) throw error;
  return data || [];
};

export const insertRelacion = async ({ cliente_id, cliente_relacionado_id, tipo_relacion }) => {
  // 1. Insertar relación original
  const { error } = await supabase.from('relaciones_clientes').insert({ cliente_id, cliente_relacionado_id, tipo_relacion });
  if (error) throw error;
  registrarAccionHistorial(cliente_id, 'NUEVA_RELACION', `Vinculó a otro cliente como ${tipo_relacion}`);

  // 2. Lógica de transitividad (Vincular todo el grupo familiar)
  try {
    const { data: relsA } = await supabase
      .from('relaciones_clientes')
      .select('cliente_id, cliente_relacionado_id')
      .or(`cliente_id.eq.${cliente_id},cliente_relacionado_id.eq.${cliente_id}`);
      
    const { data: relsB } = await supabase
      .from('relaciones_clientes')
      .select('cliente_id, cliente_relacionado_id')
      .or(`cliente_id.eq.${cliente_relacionado_id},cliente_relacionado_id.eq.${cliente_relacionado_id}`);
      
    const famA = (relsA || []).map(r => r.cliente_id === cliente_id ? r.cliente_relacionado_id : r.cliente_id).filter(id => id !== cliente_relacionado_id);
    const famB = (relsB || []).map(r => r.cliente_id === cliente_relacionado_id ? r.cliente_relacionado_id : r.cliente_id).filter(id => id !== cliente_id);

    const grupoIds = Array.from(new Set([cliente_id, cliente_relacionado_id, ...famA, ...famB]));
    
    // Obtener todas las relaciones existentes en este grupo
    const { data: existingRels } = await supabase
      .from('relaciones_clientes')
      .select('cliente_id, cliente_relacionado_id')
      .in('cliente_id', grupoIds)
      .in('cliente_relacionado_id', grupoIds);
      
    const existingPairs = new Set();
    if (existingRels) {
      existingRels.forEach(r => {
        const min = Math.min(r.cliente_id, r.cliente_relacionado_id);
        const max = Math.max(r.cliente_id, r.cliente_relacionado_id);
        existingPairs.add(`${min}-${max}`);
      });
    }

    const newRels = [];
    for (let i = 0; i < grupoIds.length; i++) {
      for (let j = i + 1; j < grupoIds.length; j++) {
        const id1 = grupoIds[i];
        const id2 = grupoIds[j];
        const min = Math.min(id1, id2);
        const max = Math.max(id1, id2);
        
        if (!existingPairs.has(`${min}-${max}`)) {
          newRels.push({
            cliente_id: min,
            cliente_relacionado_id: max,
            tipo_relacion: tipo_relacion
          });
          existingPairs.add(`${min}-${max}`);
        }
      }
    }

    if (newRels.length > 0) {
      await supabase.from('relaciones_clientes').insert(newRels);
      for (const rel of newRels) {
        registrarAccionHistorial(rel.cliente_id, 'NUEVA_RELACION_AUTOMATICA', `Vínculo automático de grupo como ${tipo_relacion}`);
        registrarAccionHistorial(rel.cliente_relacionado_id, 'NUEVA_RELACION_AUTOMATICA', `Vínculo automático de grupo como ${tipo_relacion}`);
      }
    }
  } catch (err) {
    console.error('Error al generar relaciones transitivas:', err);
  }
};

export const updateRelacionTipo = async (id, tipo_relacion) => {
  const { error } = await supabase.from('relaciones_clientes').update({ tipo_relacion }).eq('id', id);
  if (error) throw error;
};

export const deleteRelacion = async (id) => {
  const { error } = await supabase.from('relaciones_clientes').delete().eq('id', id);
  if (error) throw error;
};

// ── AI Chat ───────────────────────────────────────────────────────────────────
export const getAiChatHistory = async (clienteId) => {
  const { data, error } = await supabase
    .from('ai_chats')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('creado_en', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const insertAiChatMessage = async ({ cliente_id, role, content }) => {
  await supabase.from('ai_chats').insert({ cliente_id, role, content });
};
