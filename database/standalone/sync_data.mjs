#!/usr/bin/env node
// =====================================================================
// sync_data.mjs — refreshes business data for ONE organization
// (b4a9f43d-2065-48f2-a5c7-f8c0feacc309, "PLATAFORMA CUBANOS BR") from
// Avante into the standalone DASHBOARDOperacional-PCBR project.
//
// Unlike migrate_data.mjs (one-time initial load, plain INSERT — fails
// on rows that already exist), this script UPSERTs: existing rows are
// overwritten with Avante's current values ("Avante siempre gana"),
// new rows are inserted, nothing already in the target is deleted.
// Safe to re-run repeatedly.
//
// Same credentials as migrate_data.mjs — see that file's header for
// the full explanation. Quick version:
//   AVANTE_SUPABASE_SERVICE_ROLE_KEY   (or ANON_KEY+EMAIL+PASSWORD)
//   NEW_SUPABASE_URL
//   NEW_SUPABASE_SERVICE_ROLE_KEY
//   DRY_RUN=1   optional, logs counts without writing
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ORG_ID = 'b4a9f43d-2065-48f2-a5c7-f8c0feacc309'; // PLATAFORMA CUBANOS BR
const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 500;

const AVANTE_URL = process.env.AVANTE_SUPABASE_URL || 'https://rcqkmaxkuxllcyjzqbvn.supabase.co';
const AVANTE_ANON_KEY = process.env.AVANTE_SUPABASE_ANON_KEY;
const AVANTE_SERVICE_ROLE_KEY = process.env.AVANTE_SUPABASE_SERVICE_ROLE_KEY;
const AVANTE_EMAIL = process.env.AVANTE_EMAIL;
const AVANTE_PASSWORD = process.env.AVANTE_PASSWORD;

const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_SERVICE_ROLE_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;

const DRY_RUN = process.env.DRY_RUN === '1';

function fail(msg) {
  console.error(`\n[sync_data] FATAL: ${msg}\n`);
  process.exit(1);
}

if (!AVANTE_SERVICE_ROLE_KEY && (!AVANTE_ANON_KEY || !AVANTE_EMAIL || !AVANTE_PASSWORD)) {
  fail('Missing Avante read credentials. See header comment.');
}
if (!NEW_URL || !NEW_SERVICE_ROLE_KEY) {
  fail('Missing NEW_SUPABASE_URL / NEW_SUPABASE_SERVICE_ROLE_KEY.');
}

const avante = createClient(AVANTE_URL, AVANTE_SERVICE_ROLE_KEY || AVANTE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const target = createClient(NEW_URL, NEW_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAllRows(table, { orderBy = 'id', filterOrg = true, select = '*' } = {}) {
  const rows = [];
  let from = 0;
  for (;;) {
    let q = avante.from(table).select(select).order(orderBy, { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (filterOrg) q = q.eq('organization_id', ORG_ID);
    const { data, error } = await q;
    if (error) throw new Error(`fetchAllRows(${table}) failed at offset ${from}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function upsertBatches(table, rows, conflictColumn = 'id') {
  if (DRY_RUN) {
    console.log(`  [dry-run] would upsert ${rows.length} rows into ${table} (onConflict: ${conflictColumn})`);
    return;
  }
  for (let i = 0; i < rows.length; i += WRITE_BATCH_SIZE) {
    const batch = rows.slice(i, i + WRITE_BATCH_SIZE);
    const { error } = await target.from(table).upsert(batch, { onConflict: conflictColumn });
    if (error) throw new Error(`upsertBatches(${table}) failed at batch starting ${i}: ${error.message}`);
  }
}

function stripOrg(row) {
  const { organization_id, ...rest } = row;
  return rest;
}

function parseFlexibleDate(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

const unmappedKeysReport = [];
const dateParseFailures = [];

const CLIENTES_JSON_FIELDS = [
  'rnm', 'numero_refugio', 'numero_pasaporte', 'carnet_identidad',
  'policia_federal', 'lugar_entrada_brasil', 'nombre_madre', 'nombre_padre', 'tramite',
];
const CLIENTES_JSON_DATE_FIELDS = [
  'fecha_vencimiento_refugio', 'fecha_emision_pasaporte', 'fecha_vencimiento_pasaporte', 'fecha_entrada_brasil',
];

function transformCliente(row) {
  const camposJson = row.campos_personalizados || {};
  const out = stripOrg(row);
  delete out.campos_personalizados;

  for (const field of CLIENTES_JSON_FIELDS) {
    const dedicated = row[field];
    if (dedicated !== null && dedicated !== undefined && dedicated !== '') {
      out[field] = dedicated;
    } else if (camposJson[field] !== undefined && camposJson[field] !== null && camposJson[field] !== '') {
      out[field] = camposJson[field];
    } else {
      out[field] = null;
    }
  }

  for (const field of CLIENTES_JSON_DATE_FIELDS) {
    const dedicated = row[field];
    let raw = null;
    if (dedicated !== null && dedicated !== undefined && dedicated !== '') {
      raw = dedicated instanceof Date ? dedicated.toISOString().slice(0, 10) : String(dedicated);
    } else if (camposJson[field] !== undefined && camposJson[field] !== null && camposJson[field] !== '') {
      raw = String(camposJson[field]);
    }
    if (raw === null) {
      out[field] = null;
      continue;
    }
    const parsed = parseFlexibleDate(raw);
    out[field] = parsed;
    if (parsed === null) dateParseFailures.push({ cliente_id: row.id, field, raw });
  }

  const knownKeys = new Set([...CLIENTES_JSON_FIELDS, ...CLIENTES_JSON_DATE_FIELDS]);
  const leftover = Object.fromEntries(Object.entries(camposJson).filter(([k]) => !knownKeys.has(k)));
  if (Object.keys(leftover).length > 0) unmappedKeysReport.push({ cliente_id: row.id, leftover });

  return out;
}

async function syncSimple(table, { orderBy = 'id', transform = stripOrg, filterOrg = true, conflictColumn = 'id' } = {}) {
  console.log(`\n[sync_data] ${table} ...`);
  const rows = await fetchAllRows(table, { orderBy, filterOrg });
  console.log(`  fetched ${rows.length} rows from Avante`);
  const transformed = rows.map(transform);
  await upsertBatches(table, transformed, conflictColumn);
  console.log(`  ${DRY_RUN ? 'would upsert' : 'upserted'} ${transformed.length} rows into ${table}`);
  return transformed.length;
}

async function main() {
  console.log(`[sync_data] org = ${ORG_ID}${DRY_RUN ? '  (DRY RUN — no writes to NEW project)' : ''}`);

  // Build Avante perfil id -> email map, and target email -> perfil id map,
  // so historial_clientes.usuario_id (an Avante perfiles.id) can be
  // re-mapped to the matching perfiles.id in the NEW project (different
  // uuid, since NEW auth.users were created fresh via invite, not copied).
  const avantePerfiles = await fetchAllRows('perfiles', { select: 'id, email' });
  const avanteIdToEmail = new Map(avantePerfiles.map((p) => [p.id, p.email]));
  const { data: targetPerfiles, error: targetPerfilesErr } = await target.from('perfiles').select('id, email');
  if (targetPerfilesErr) throw new Error(`fetch target perfiles failed: ${targetPerfilesErr.message}`);
  const targetEmailToId = new Map((targetPerfiles || []).map((p) => [p.email, p.id]));

  const counts = {};

  counts.operarios = await syncSimple('operarios');
  counts.etiquetas = await syncSimple('etiquetas');
  counts.ia_workflows = await syncSimple('ia_workflows');
  counts.pipelines = await syncSimple('pipelines');
  counts.tramites_categorias = await syncSimple('tramites_categorias');
  counts.salidas = await syncSimple('salidas');
  counts.clientes = await syncSimple('clientes', { transform: transformCliente });
  counts.configuraciones_app = await syncSimple('configuraciones_app', { orderBy: 'clave', conflictColumn: 'clave' });
  // perfiles is intentionally NOT synced here — accounts in the NEW project
  // are created via the invite-team-member flow (real auth.users, new ids),
  // not copied from Avante. Adding a team member in Avante does not
  // automatically create their NEW-project account.
  counts.integraciones_whatsapp = await syncSimple('integraciones_whatsapp');
  counts.integraciones_kommo = await syncSimple('integraciones_kommo');
  counts.kommo_field_mappings = await syncSimple('kommo_field_mappings');
  counts.kommo_stage_mappings = await syncSimple('kommo_stage_mappings');
  counts.plantillas_documentos = await syncSimple('plantillas_documentos');

  counts.pipeline_etapas = await syncSimple('pipeline_etapas');
  counts.tramites_catalogo = await syncSimple('tramites_catalogo');
  counts.documentos_operacionales = await syncSimple('documentos_operacionales');
  counts.documentos_pendientes = await syncSimple('documentos_pendientes');
  counts.biblioteca_multimedia = await syncSimple('biblioteca_multimedia');
  counts.configuracion_bot = await syncSimple('configuracion_bot');
  counts.ai_chats = await syncSimple('ai_chats');

  counts.historial_clientes = await syncSimple('historial_clientes', {
    transform: (row) => {
      const out = stripOrg(row);
      const email = avanteIdToEmail.get(row.usuario_id);
      out.usuario_id = (email && targetEmailToId.get(email)) || null;
      return out;
    },
  });
  counts.relaciones_clientes = await syncSimple('relaciones_clientes');
  counts.mensajes = await syncSimple('mensajes');
  counts.notificaciones_equipo = await syncSimple('notificaciones_equipo');

  // chat_equipo/chat_privado reference perfiles/auth.users — remap via email
  // (see historial_clientes above) and DROP rows whose author doesn't have a
  // matching account in the NEW project yet (most Avante team members won't,
  // until they're invited here too), instead of failing the whole batch on
  // one bad FK.
  {
    console.log(`\n[sync_data] chat_equipo ...`);
    const rows = await fetchAllRows('chat_equipo');
    console.log(`  fetched ${rows.length} rows from Avante`);
    const mapped = rows
      .map((row) => {
        const email = avanteIdToEmail.get(row.usuario_id);
        const newId = email && targetEmailToId.get(email);
        if (!newId) return null;
        const out = stripOrg(row);
        out.usuario_id = newId;
        return out;
      })
      .filter(Boolean);
    await upsertBatches('chat_equipo', mapped);
    console.log(`  ${DRY_RUN ? 'would upsert' : 'upserted'} ${mapped.length}/${rows.length} rows into chat_equipo (rest skipped — author has no account in the NEW project yet)`);
    counts.chat_equipo = mapped.length;
  }
  {
    console.log(`\n[sync_data] chat_privado ...`);
    const rows = await fetchAllRows('chat_privado');
    console.log(`  fetched ${rows.length} rows from Avante`);
    const mapped = rows
      .map((row) => {
        const emisorEmail = avanteIdToEmail.get(row.emisor_id);
        const receptorEmail = avanteIdToEmail.get(row.receptor_id);
        const newEmisorId = emisorEmail && targetEmailToId.get(emisorEmail);
        const newReceptorId = receptorEmail && targetEmailToId.get(receptorEmail);
        if (!newEmisorId || !newReceptorId) return null;
        const out = stripOrg(row);
        out.emisor_id = newEmisorId;
        out.receptor_id = newReceptorId;
        return out;
      })
      .filter(Boolean);
    await upsertBatches('chat_privado', mapped);
    console.log(`  ${DRY_RUN ? 'would upsert' : 'upserted'} ${mapped.length}/${rows.length} rows into chat_privado (rest skipped — one or both sides have no account in the NEW project yet)`);
    counts.chat_privado = mapped.length;
  }

  counts.entradas = await syncSimple('entradas');
  counts.notas_tramite = await syncSimple('notas_tramite');
  counts.pagos_tramite = await syncSimple('pagos_tramite');
  counts.formularios_clientes = await syncSimple('formularios_clientes');
  counts.historial_cambios = await syncSimple('historial_cambios');
  counts.tramites_precios = await syncSimple('tramites_precios');
  counts.tramites_requisitos = await syncSimple('tramites_requisitos');
  counts.pipeline_automatizaciones = await syncSimple('pipeline_automatizaciones');

  counts.estados_br = await syncSimple('estados_br', { orderBy: 'uf', transform: (r) => r, filterOrg: false, conflictColumn: 'uf' });

  console.log('\n[sync_data] Row counts synced:');
  console.table(counts);

  if (dateParseFailures.length > 0) {
    const p = path.join(__dirname, 'sync_data_date_failures.json');
    fs.writeFileSync(p, JSON.stringify(dateParseFailures, null, 2));
    console.log(`\n[sync_data] ${dateParseFailures.length} date values could not be parsed — left NULL. Details: ${p}`);
  }
  if (unmappedKeysReport.length > 0) {
    const p = path.join(__dirname, 'sync_data_unmapped_campos_personalizados.json');
    fs.writeFileSync(p, JSON.stringify(unmappedKeysReport, null, 2));
    console.log(`\n[sync_data] ${unmappedKeysReport.length} clientes had campos_personalizados keys with no dedicated column. Review: ${p}`);
  }

  console.log('\n[sync_data] IMPORTANT — after this script finishes, bump identity sequences past the max synced id '
    + '(same setval(...) statements as after migrate_data.mjs — see database/standalone/README.md), in case new rows '
    + 'with higher ids than before were inserted.');
}

main().catch((err) => {
  console.error('\n[sync_data] FAILED:', err);
  process.exit(1);
});
