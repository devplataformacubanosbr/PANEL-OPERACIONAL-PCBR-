// Backfill: mueve los objetos existentes del bucket whatsapp_media a rutas
// con prefijo de organización (`<organization_id>/<nombre-original>`).
//
// Por qué un script y no una migración SQL: el nombre de un objeto en
// storage.objects no es solo metadata — moverlo requiere la Storage API
// (copy+delete en el backend S3), no un UPDATE de la columna `name`. Un
// UPDATE SQL directo dejaría la fila apuntando a una ruta que no existe
// físicamente y rompería la carga de todos los medios ya subidos.
//
// Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (Project Settings →
// API → service_role) como variables de entorno — NUNCA el anon key, y
// nunca correr esto desde el frontend.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node database/scripts/backfill_whatsapp_media_org_prefix.mjs
//     → dry-run: solo reporta qué movería, no toca nada.
//   ... node database/scripts/backfill_whatsapp_media_org_prefix.mjs --apply
//     → ejecuta el move real + actualiza mensajes.media_url.
//
// Requisito previo (Fase 0.2 del plan): correr esto y confirmar 0 errores
// ANTES de aplicar la migración que restringe whatsapp_media_authenticated_select
// por prefijo de organización — si se aplica la policy antes del backfill,
// ningún tenant podrá ver sus medios ya subidos.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const BUCKET = 'whatsapp_media';
const PUBLIC_PATH_MARKER = '/object/public/whatsapp_media/';
const PAGE_SIZE = 500;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Un objeto ya migrado empieza con un UUID de organización seguido de '/'.
const UUID_PREFIX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i;

function extractObjectPath(mediaUrl) {
  const idx = mediaUrl.indexOf(PUBLIC_PATH_MARKER);
  if (idx === -1) return null;
  return decodeURIComponent(mediaUrl.slice(idx + PUBLIC_PATH_MARKER.length));
}

function buildNewMediaUrl(oldMediaUrl, newObjectPath) {
  const idx = oldMediaUrl.indexOf(PUBLIC_PATH_MARKER);
  return oldMediaUrl.slice(0, idx + PUBLIC_PATH_MARKER.length) + encodeURIComponent(newObjectPath).replace(/%2F/g, '/');
}

async function main() {
  console.log(`Modo: ${APPLY ? 'APLICAR CAMBIOS' : 'DRY-RUN (solo reporte)'}`);

  let from = 0;
  let totalSeen = 0;
  let totalMoved = 0;
  let totalSkippedAlreadyPrefixed = 0;
  let totalSkippedNoOrg = 0;
  let totalErrors = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('mensajes')
      .select('id, organization_id, media_url')
      .not('media_url', 'is', null)
      .like('media_url', `%${PUBLIC_PATH_MARKER}%`)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error leyendo mensajes:', error);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      totalSeen++;
      const objectPath = extractObjectPath(row.media_url);
      if (!objectPath) continue;

      if (UUID_PREFIX_RE.test(objectPath)) {
        totalSkippedAlreadyPrefixed++;
        continue;
      }
      if (!row.organization_id) {
        totalSkippedNoOrg++;
        console.warn(`  [SKIP] mensaje ${row.id}: sin organization_id, no se puede prefijar "${objectPath}"`);
        continue;
      }

      const newObjectPath = `${row.organization_id}/${objectPath}`;
      console.log(`  ${objectPath}  ->  ${newObjectPath}`);

      if (!APPLY) continue;

      const { error: moveError } = await supabase.storage.from(BUCKET).move(objectPath, newObjectPath);
      if (moveError) {
        // Si el objeto físico ya no existe (medio borrado manualmente, etc.)
        // no tiene sentido seguir reintentando esta fila.
        console.error(`  [ERROR] moviendo "${objectPath}":`, moveError.message);
        totalErrors++;
        continue;
      }

      const newMediaUrl = buildNewMediaUrl(row.media_url, newObjectPath);
      const { error: updateError } = await supabase
        .from('mensajes')
        .update({ media_url: newMediaUrl })
        .eq('id', row.id);

      if (updateError) {
        console.error(`  [ERROR] actualizando mensajes.media_url para ${row.id}:`, updateError.message);
        totalErrors++;
        continue;
      }

      totalMoved++;
    }

    from += PAGE_SIZE;
  }

  console.log('\n--- Resumen ---');
  console.log(`Mensajes con media revisados: ${totalSeen}`);
  console.log(`Ya tenían prefijo de organización: ${totalSkippedAlreadyPrefixed}`);
  console.log(`Sin organization_id (revisar manualmente): ${totalSkippedNoOrg}`);
  console.log(`${APPLY ? 'Movidos' : 'Se moverían (dry-run)'}: ${totalMoved}`);
  console.log(`Errores: ${totalErrors}`);

  if (!APPLY) {
    console.log('\nEsto fue un dry-run. Volvé a correr con --apply para ejecutar los cambios.');
  } else if (totalErrors === 0 && totalSkippedNoOrg === 0) {
    console.log('\nBackfill completo sin errores. Ahora es seguro aplicar 031_whatsapp_media_org_prefix_policy.sql.');
  } else {
    console.log('\nQuedaron filas sin migrar (errores u organization_id faltante) — resolverlas antes de aplicar la policy restrictiva, o esos medios quedarán inaccesibles.');
  }
}

main();
