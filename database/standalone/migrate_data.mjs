#!/usr/bin/env node
// =====================================================================
// migrate_data.mjs — copies business data for ONE organization
// (b4a9f43d-2065-48f2-a5c7-f8c0feacc309, "PLATAFORMA CUBANOS BR") from
// the multi-tenant Avante project into the standalone
// DASHBOARDOperacional-PCBR project, whose schema is 001_schema.sql.
//
// ALREADY RUN ONCE (2026-07-13) — this was the initial one-time load.
// 6 tables (chat_equipo, ai_chats, biblioteca_multimedia, chat_privado,
// configuracion_bot, documentos_pendientes) were missed in the original
// table list and added to 001_schema.sql + migrated separately afterwards.
// For any FUTURE re-migration from scratch, add those 6 tables to this
// script too (copy the fetch/insert pattern from sync_data.mjs, which
// already covers them and additionally handles re-mapping
// chat_equipo.usuario_id / chat_privado.emisor_id+receptor_id by email
// since those are perfiles/auth.users FKs that don't carry over 1:1).
// Going forward, prefer sync_data.mjs (upsert, safe to re-run) over this
// file (plain insert, only safe against an empty target).
//
// THIS SCRIPT IS NOT EXECUTED AS PART OF GENERATING THESE FILES.
// Review it, fill in the environment variables below, then run it
// yourself with `node database/standalone/migrate_data.mjs` from the
// DASHBOARDOperacional-PCBR folder (where @supabase/supabase-js is
// already installed).
//
// -----------------------------------------------------------------
// CREDENTIALS NEEDED (none of these are available to the agent that
// wrote this script — you must supply them):
//
//   READ SIDE (Avante, rcqkmaxkuxllcyjzqbvn):
//     We do NOT have an Avante service_role key. Avante's RLS policies
//     filter every table by `organization_id = get_user_org_id()`,
//     where get_user_org_id() resolves from the CALLER'S JWT — so an
//     anonymous/unauthenticated client reads ZERO rows. You must sign
//     in as a real Avante user who belongs to organization
//     b4a9f43d-2065-48f2-a5c7-f8c0feacc309 (any of the 5 perfiles in
//     that org will do) and pass their credentials via:
//       AVANTE_SUPABASE_URL       (defaults to https://rcqkmaxkuxllcyjzqbvn.supabase.co)
//       AVANTE_SUPABASE_ANON_KEY  (Avante's anon/public key)
//       AVANTE_EMAIL              (login email of a user in that org)
//       AVANTE_PASSWORD           (their password)
//     Alternatively, if you DO obtain Avante's service_role key later,
//     set AVANTE_SUPABASE_SERVICE_ROLE_KEY instead and the script will
//     use it directly (bypassing RLS, no sign-in needed, ORG_FILTER
//     below is still applied manually in every query either way).
//
//   WRITE SIDE (new project, kxtshulqjkkgcrxhegiv):
//     NEW_SUPABASE_URL                 e.g. https://kxtshulqjkkgcrxhegiv.supabase.co
//     NEW_SUPABASE_SERVICE_ROLE_KEY    service role key of the new project
//     (service role is required on the write side to bypass RLS and to
//     insert explicit bigint ids / uuids so foreign keys stay intact.)
//
// Example:
//   AVANTE_SUPABASE_ANON_KEY=xxx \
//   AVANTE_EMAIL=someone@example.com AVANTE_PASSWORD=xxx \
//   NEW_SUPABASE_URL=https://kxtshulqjkkgcrxhegiv.supabase.co \
//   NEW_SUPABASE_SERVICE_ROLE_KEY=xxx \
//   node database/standalone/migrate_data.mjs
// -----------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------
// Config
// -----------------------------------------------------------------
const ORG_ID = 'b4a9f43d-2065-48f2-a5c7-f8c0feacc309'; // PLATAFORMA CUBANOS BR
const PAGE_SIZE = 1000; // Supabase's default/enforced max rows per request
const WRITE_BATCH_SIZE = 500;

const AVANTE_URL = process.env.AVANTE_SUPABASE_URL || 'https://rcqkmaxkuxllcyjzqbvn.supabase.co';
const AVANTE_ANON_KEY = process.env.AVANTE_SUPABASE_ANON_KEY;
const AVANTE_SERVICE_ROLE_KEY = process.env.AVANTE_SUPABASE_SERVICE_ROLE_KEY; // optional, preferred if available
const AVANTE_EMAIL = process.env.AVANTE_EMAIL;
const AVANTE_PASSWORD = process.env.AVANTE_PASSWORD;

const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_SERVICE_ROLE_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;

const DRY_RUN = process.env.DRY_RUN === '1'; // if set, reads from Avante and logs counts but does not write to NEW project

function fail(msg) {
  console.error(`\n[migrate_data] FATAL: ${msg}\n`);
  process.exit(1);
}

if (!AVANTE_SERVICE_ROLE_KEY && (!AVANTE_ANON_KEY || !AVANTE_EMAIL || !AVANTE_PASSWORD)) {
  fail(
    'Missing Avante read credentials. Set either AVANTE_SUPABASE_SERVICE_ROLE_KEY, ' +
    'or all of AVANTE_SUPABASE_ANON_KEY + AVANTE_EMAIL + AVANTE_PASSWORD (a login ' +
    'belonging to org b4a9f43d-2065-48f2-a5c7-f8c0feacc309). See header comment.'
  );
}
if (!NEW_URL || !NEW_SERVICE_ROLE_KEY) {
  fail('Missing NEW_SUPABASE_URL / NEW_SUPABASE_SERVICE_ROLE_KEY for the write side.');
}

const avante = createClient(AVANTE_URL, AVANTE_SERVICE_ROLE_KEY || AVANTE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const target = createClient(NEW_URL, NEW_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/** Paginate a table filtered by organization_id, ordered by a stable column. */
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

/** True if the target (new project) table already has at least one row. */
async function targetTableHasRows(table) {
  if (DRY_RUN) return false;
  const { count, error } = await target.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`targetTableHasRows(${table}) failed: ${error.message}`);
  return (count ?? 0) > 0;
}

async function insertBatches(table, rows) {
  if (DRY_RUN) {
    console.log(`  [dry-run] would insert ${rows.length} rows into ${table}`);
    return;
  }
  for (let i = 0; i < rows.length; i += WRITE_BATCH_SIZE) {
    const batch = rows.slice(i, i + WRITE_BATCH_SIZE);
    const { error } = await target.from(table).insert(batch);
    if (error) {
      throw new Error(`insertBatches(${table}) failed at batch starting ${i}: ${error.message}`);
    }
  }
}

/** Strip organization_id from a row (shallow copy). */
function stripOrg(row) {
  const { organization_id, ...rest } = row;
  return rest;
}

/**
 * Parse dates that show up in Avante as free-form text in a mix of
 * formats: ISO (YYYY-MM-DD), YYYY/MM/DD, and DD/MM/YYYY. Returns an
 * ISO 'YYYY-MM-DD' string or null if unparseable.
 */
function parseFlexibleDate(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;

  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/); // ISO
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = v.match(/^(\d{4})\/(\d{2})\/(\d{2})$/); // YYYY/MM/DD
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  return null; // unparseable — left null, logged by caller
}

const unmappedKeysReport = []; // { cliente_id, keys: {...} } for campos_personalizados keys we don't have a dedicated column for
const dateParseFailures = []; // { cliente_id, field, raw }

// The 13 dedicated columns added to clientes (see 001_schema.sql) and
// the exact campos_personalizados jsonb keys they correspond to in
// live Avante data (confirmed by introspection on 2026-07-13).
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
  // campos_personalizados se mantiene como espejo completo del JSONB de
  // Avante — las columnas fijas de abajo son lo que usa la app, el JSONB es
  // solo copia de respaldo/compatibilidad, a pedido explícito del usuario.

  for (const field of CLIENTES_JSON_FIELDS) {
    const dedicated = row[field];
    if (dedicated !== null && dedicated !== undefined && dedicated !== '') {
      out[field] = dedicated; // already-populated dedicated column wins
    } else if (camposJson[field] !== undefined && camposJson[field] !== null && camposJson[field] !== '') {
      out[field] = camposJson[field];
    } else {
      out[field] = null;
    }
  }

  for (const field of CLIENTES_JSON_DATE_FIELDS) {
    // fecha_vencimiento_refugio / fecha_vencimiento_pasaporte are already
    // DATE columns in Avante; fecha_emision_pasaporte / fecha_entrada_brasil
    // are TEXT there. Prefer the dedicated column, fall back to JSON, then
    // normalize whatever text we got into ISO 'YYYY-MM-DD'.
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
    if (parsed === null) {
      dateParseFailures.push({ cliente_id: row.id, field, raw });
    }
  }

  // Anything left in campos_personalizados that isn't one of the 13
  // dedicated fields would otherwise be silently lost (schema drops
  // the jsonb column entirely, per instructions). Record it instead.
  const knownKeys = new Set([...CLIENTES_JSON_FIELDS, ...CLIENTES_JSON_DATE_FIELDS]);
  const leftover = Object.fromEntries(Object.entries(camposJson).filter(([k]) => !knownKeys.has(k)));
  if (Object.keys(leftover).length > 0) {
    unmappedKeysReport.push({ cliente_id: row.id, leftover });
  }

  return out;
}

// -----------------------------------------------------------------
// Migration steps, in FK dependency order (must match 001_schema.sql)
// -----------------------------------------------------------------

async function migrateSimple(table, { orderBy = 'id', transform = stripOrg, filterOrg = true } = {}) {
  console.log(`\n[migrate_data] ${table} ...`);
  const rows = await fetchAllRows(table, { orderBy, filterOrg });
  console.log(`  fetched ${rows.length} rows from Avante`);
  const transformed = rows.map(transform);
  await insertBatches(table, transformed);
  console.log(`  ${DRY_RUN ? 'would insert' : 'inserted'} ${transformed.length} rows into ${table}`);
  return transformed.length;
}

async function main() {
  console.log(`[migrate_data] org = ${ORG_ID}${DRY_RUN ? '  (DRY RUN — no writes to NEW project)' : ''}`);

  const counts = {};

  // Level 0
  counts.operarios = await migrateSimple('operarios');
  counts.etiquetas = await migrateSimple('etiquetas');
  counts.ia_workflows = await migrateSimple('ia_workflows');
  counts.pipelines = await migrateSimple('pipelines');
  counts.tramites_categorias = await migrateSimple('tramites_categorias');
  counts.salidas = await migrateSimple('salidas');
  counts.clientes = await migrateSimple('clientes', { transform: transformCliente });
  counts.configuraciones_app = await migrateSimple('configuraciones_app', { orderBy: 'clave' });
  // perfiles: id must already exist in the NEW project's auth.users (FK).
  // Create matching auth users manually first (see README), THEN run:
  // counts.perfiles = await migrateSimple('perfiles');
  console.log('\n[migrate_data] SKIPPING perfiles automatically — its id column has a FK to '
    + 'auth.users(id) on the NEW project. Create the 5 matching auth users there first '
    + '(e.g. via Supabase Admin API / dashboard), then uncomment the perfiles line in this '
    + 'script and re-run just that step.');
  counts.integraciones_whatsapp = await migrateSimple('integraciones_whatsapp');
  counts.integraciones_kommo = await migrateSimple('integraciones_kommo');
  counts.kommo_field_mappings = await migrateSimple('kommo_field_mappings');
  counts.kommo_stage_mappings = await migrateSimple('kommo_stage_mappings');
  counts.plantillas_documentos = await migrateSimple('plantillas_documentos');

  // Level 1
  counts.pipeline_etapas = await migrateSimple('pipeline_etapas');
  counts.tramites_catalogo = await migrateSimple('tramites_catalogo');
  counts.documentos_operacionales = await migrateSimple('documentos_operacionales');
  // historial_clientes.usuario_id -> perfiles(id) FK. In live Avante,
  // EVERY historial_clientes row for this org has a non-null usuario_id
  // (128/128 as of 2026-07-13), so this FK will fail on every single
  // insert unless perfiles was migrated first (which requires manually
  // creating matching auth.users rows — see README). Auto-detect: if
  // the target perfiles table is still empty, null out usuario_id so
  // the migration doesn't hard-fail; re-run this step after perfiles
  // is populated if you want the attribution preserved.
  const perfilesReady = await targetTableHasRows('perfiles');
  if (!perfilesReady) {
    console.log('\n[migrate_data] perfiles is empty in the NEW project — nulling out '
      + 'historial_clientes.usuario_id to avoid FK violations. Populate perfiles and '
      + 're-run this step afterwards to preserve attribution.');
  }
  counts.historial_clientes = await migrateSimple('historial_clientes', {
    transform: (row) => {
      const out = stripOrg(row);
      if (!perfilesReady) out.usuario_id = null;
      return out;
    },
  });
  counts.relaciones_clientes = await migrateSimple('relaciones_clientes');
  counts.mensajes = await migrateSimple('mensajes');
  counts.notificaciones_equipo = await migrateSimple('notificaciones_equipo');

  // Level 2
  counts.entradas = await migrateSimple('entradas');
  counts.notas_tramite = await migrateSimple('notas_tramite');
  counts.pagos_tramite = await migrateSimple('pagos_tramite');
  counts.formularios_clientes = await migrateSimple('formularios_clientes');
  counts.historial_cambios = await migrateSimple('historial_cambios');
  counts.tramites_precios = await migrateSimple('tramites_precios');
  counts.tramites_requisitos = await migrateSimple('tramites_requisitos');
  counts.pipeline_automatizaciones = await migrateSimple('pipeline_automatizaciones');

  // estados_br is global reference data (no organization_id column in
  // Avante at all) — migrate all 27 rows unconditionally, no org filter.
  counts.estados_br = await migrateSimple('estados_br', { orderBy: 'uf', transform: (r) => r, filterOrg: false });

  console.log('\n[migrate_data] Row counts migrated:');
  console.table(counts);

  if (dateParseFailures.length > 0) {
    const p = path.join(__dirname, 'migrate_data_date_failures.json');
    fs.writeFileSync(p, JSON.stringify(dateParseFailures, null, 2));
    console.log(`\n[migrate_data] ${dateParseFailures.length} clientes date values could not be parsed — left NULL. Details: ${p}`);
  }
  if (unmappedKeysReport.length > 0) {
    const p = path.join(__dirname, 'migrate_data_unmapped_campos_personalizados.json');
    fs.writeFileSync(p, JSON.stringify(unmappedKeysReport, null, 2));
    console.log(`\n[migrate_data] ${unmappedKeysReport.length} clientes had campos_personalizados keys with no dedicated column `
      + `(e.g. profesion_, ocupaci_n, direccion_de_cuba, estatura__cm_, color_de_*, req_ren_ref, req_rnm_1ra_vez, salida_de_cuba, `
      + `direccion_de_trabajo_) — that data was NOT migrated (schema drops campos_personalizados per instructions). Review: ${p}`);
  }

  console.log('\n[migrate_data] IMPORTANT — after this script finishes, bump every '
    + 'GENERATED BY DEFAULT AS IDENTITY sequence past the max migrated id, e.g.:\n'
    + "  SELECT setval(pg_get_serial_sequence('clientes','id'), (SELECT COALESCE(MAX(id),1) FROM clientes));\n"
    + "  -- repeat for: entradas, historial_cambios, documentos_operacionales, relaciones_clientes,\n"
    + "  --             tramites_catalogo, tramites_categorias, tramites_precios, tramites_requisitos, salidas\n"
    + 'This script does not run that SQL itself — run it yourself against the NEW project once you '
    + 'are ready to also allow new rows to be created through the app (INSERTs without explicit id).');
}

main().catch((err) => {
  console.error('\n[migrate_data] FAILED:', err);
  process.exit(1);
});
