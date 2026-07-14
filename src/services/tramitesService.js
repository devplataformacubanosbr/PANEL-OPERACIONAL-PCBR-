/**
 * tramitesService.js
 * Capa de servicio — Agente 2 (Arquitecto)
 * Centraliza TODAS las llamadas a Supabase relacionadas con trámites (entradas).
 */
import { supabase } from '../supabaseClient';
import { registrarAccionHistorial } from './equipoService';

export const getEntradas = async (clientId) => {
  const { data, error } = await supabase
    .from('entradas')
    .select('*')
    .eq('id_cliente', clientId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createEntrada = async ({ id_cliente, servicio, operario, pipeline_id, stage_id }) => {
  let finalPipelineId = pipeline_id;
  let finalStageId = stage_id;

  if (!finalPipelineId || !finalStageId) {
    try {
      const { data: pipelines } = await supabase
        .from('pipelines')
        .select('*')
        .eq('activo', true)
        .order('orden', { ascending: true });
        
      if (pipelines && pipelines.length > 0) {
        const target = pipelines.find(p => p.es_predeterminado) || pipelines[0];
        finalPipelineId = target.id;
        
        const { data: stages } = await supabase
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
      console.error('Error auto-asignando pipeline/stage default:', err);
    }
  }

  const { data, error } = await supabase
    .from('entradas')
    .insert({
      id_cliente,
      servicio: servicio.trim().toUpperCase(),
      operario: operario?.trim().toUpperCase() || null,
      estado_tramite: 'pendiente',
      pipeline_id: finalPipelineId || null,
      stage_id: finalStageId || null,
    })
    .select()
    .single();
  if (error) throw error;
  registrarAccionHistorial(id_cliente, 'NUEVO_TRAMITE', `Creó trámite de ${servicio}`);
  return data;
};

export const updateEntradaEstado = async (id, estado_tramite) => {
  const { error } = await supabase
    .from('entradas')
    .update({ estado_tramite })
    .eq('id', id);
  if (error) throw error;
};

/**
 * Mueve una entrada a otra etapa del pipeline. Si la etapa tiene un `codigo` que coincide
 * con uno de los 5 estados legacy, también sincroniza estado_tramite para que las vistas
 * que todavía lo usan (badge de estado en ClientViewTramites, etc.) se mantengan consistentes.
 */
const LEGACY_CODES = ['entrante', 'esperando_cliente', 'esperando', 'cobranza', 'logrado'];
const LEGACY_MAP = { entrante: 'pendiente', esperando_cliente: 'esperando_docs', esperando: 'procesando', cobranza: 'cancelada', logrado: 'completada' };

export const updateEntradaStage = async (id, stage) => {
  const updates = { stage_id: stage.id, pipeline_id: stage.pipeline_id };
  if (stage.codigo && LEGACY_CODES.includes(stage.codigo)) {
    updates.estado_tramite = LEGACY_MAP[stage.codigo];
  }
  const { error } = await supabase.from('entradas').update(updates).eq('id', id);
  if (error) throw error;
};

export const deleteEntrada = async (id) => {
  const { error } = await supabase
    .from('entradas')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const updateEntradaServicio = async (id, servicio) => {
  const { error } = await supabase
    .from('entradas')
    .update({ servicio: servicio?.trim().toUpperCase() })
    .eq('id', id);
  if (error) throw error;
};

export const updateEntradaOperario = async (id, operario) => {
  const { error } = await supabase
    .from('entradas')
    .update({ operario: operario?.trim().toUpperCase() || null })
    .eq('id', id);
  if (error) throw error;
};

export const updateEntradaDatosPersonalizados = async (id, datos_personalizados) => {
  const { error } = await supabase
    .from('entradas')
    .update({ datos_personalizados })
    .eq('id', id);
  if (error) throw error;
};

export const getCatalogoTramites = async () => {
  const { data, error } = await supabase
    .from('tramites_catalogo')
    .select('id, nombre, codigo, costo')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return data || [];
};

export const getAllCatalogoTramites = async () => {
  const { data, error } = await supabase
    .from('tramites_catalogo')
    .select('*')
    .order('nombre');
  if (error) throw error;
  return data || [];
};

export const createCatalogoTramite = async (tramite) => {
  const { data, error } = await supabase
    .from('tramites_catalogo')
    .insert(tramite)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateCatalogoTramite = async (id, updates) => {
  const { data, error } = await supabase
    .from('tramites_catalogo')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getNotasTramite = async (entradaId) => {
  const { data, error } = await supabase
    .from('notas_tramite')
    .select('*')
    .eq('entrada_id', entradaId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createNotaTramite = async ({ entrada_id, texto }) => {
  const { data, error } = await supabase
    .from('notas_tramite')
    .insert({
      entrada_id,
      texto: texto.trim(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateNotaTramite = async (id, texto) => {
  const { data, error } = await supabase
    .from('notas_tramite')
    .update({ texto: texto.trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── Pagos ─────────────────────────────────────────────────────────────────────

export const getPagos = async (entradaId) => {
  const { data, error } = await supabase
    .from('pagos_tramite')
    .select('*')
    .eq('entrada_id', entradaId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createPago = async ({ entrada_id, monto, fecha, nota }) => {
  const { data, error } = await supabase
    .from('pagos_tramite')
    .insert({ entrada_id, monto, fecha: fecha || undefined, nota: nota || null })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deletePago = async (id) => {
  const { error } = await supabase.from('pagos_tramite').delete().eq('id', id);
  if (error) throw error;
};

export const getOperarios = async () => {
  const { data, error } = await supabase
    .from('operarios')
    .select('id, nombre, iniciales')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return data || [];
};

export const getAllOperarios = async () => {
  const { data, error } = await supabase
    .from('operarios')
    .select('*')
    .order('nombre');
  if (error) throw error;
  return data || [];
};

export const createOperario = async (operario) => {
  const { data, error } = await supabase
    .from('operarios')
    .insert(operario)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateOperario = async (id, updates) => {
  const { data, error } = await supabase
    .from('operarios')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── Etiquetas ─────────────────────────────────────────────────────────────────

export const getEtiquetas = async () => {
  const { data, error } = await supabase
    .from('etiquetas')
    .select('*')
    .order('creado_en', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createEtiqueta = async (etiqueta) => {
  const { data, error } = await supabase
    .from('etiquetas')
    .insert(etiqueta)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateEtiqueta = async (id, updates) => {
  const { data, error } = await supabase
    .from('etiquetas')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteEtiqueta = async (id) => {
  const { error } = await supabase.from('etiquetas').delete().eq('id', id);
  if (error) throw error;
};

export const updateEntradaEtiquetas = async (id, etiquetas_ids) => {
  const { error } = await supabase
    .from('entradas')
    .update({ etiquetas_ids: etiquetas_ids || [] })
    .eq('id', id);
  if (error) throw error;
};
