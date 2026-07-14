import { createClient } from '@supabase/supabase-js';

// ============================================================================
// CONFIGURACIÓN: ¡LLENA ESTOS DATOS ANTES DE EJECUTAR!
// ============================================================================

// 1. SUPABASE VIEJO (SAAS) - De donde sacaremos los archivos
const OLD_SUPABASE_URL = 'https://rcqkmaxkuxllcyjzqbvn.supabase.co';
const OLD_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcWttYXhrdXhsbGN5anpxYnZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDYzNTc3NCwiZXhwIjoyMDk2MjExNzc0fQ.Gwr_2NxAPbt1i0y7FpJCZGmpJdfGQl-NRUzngrSRk8A';

// 2. SUPABASE NUEVO (PCBR) - A donde subiremos los archivos
const NEW_SUPABASE_URL = 'https://kxtshulqjkkgcrxhegiv.supabase.co'; // Ya puesto según tu .env
const NEW_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4dHNodWxxamtrZ2NyeGhlZ2l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjIxMDA2MCwiZXhwIjoyMDk3Nzg2MDYwfQ.W1GNE3fZ2PAxzPD7X_ZeIh7_e2tLO4AeeLRun6uAMRo';

// Nombre del bucket a migrar
const BUCKET_DOCS = 'documentos_operacionales';

// ============================================================================

async function migrateStorage() {
  console.log('Iniciando migración de Storage...');

  if (OLD_SUPABASE_URL.includes('TU_PROYECTO_VIEJO')) {
    console.error('❌ ERROR: Debes editar el archivo migrateStorage.js y poner tus credenciales reales.');
    process.exit(1);
  }

  // Inicializar clientes saltando RLS (por usar Service Role Key)
  const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SERVICE_ROLE_KEY);
  const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY);

  // 1. Obtener lista de archivos necesarios (con paginación para superar límite de 1000)
  console.log('Consultando base de datos nueva para encontrar archivos faltantes...');
  
  let allDocs = [];
  let from = 0;
  let to = 999;
  while (true) {
    const { data, error } = await newSupabase.from('documentos_operacionales').select('url_archivo').range(from, to);
    if (error) throw new Error('Error docs: ' + error.message);
    if (!data || data.length === 0) break;
    allDocs = allDocs.concat(data);
    from += 1000;
    to += 1000;
  }

  const { data: templates, error: errTemplates } = await newSupabase.from('plantillas_documentos').select('url_archivo');
  if (errTemplates) throw new Error('Error plantillas: ' + errTemplates.message);

  const allPaths = new Set([
    ...allDocs.map(d => d.url_archivo).filter(Boolean),
    ...(templates || []).map(t => t.url_archivo).filter(Boolean)
  ]);

  console.log(`Se encontraron ${allPaths.size} archivos únicos registrados en la base de datos.`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let path of allPaths) {
    // Si la ruta por error guarda una URL completa, extraemos solo el path relativo
    if (path.startsWith('http')) {
      const urlParts = path.split(`/${BUCKET_DOCS}/`);
      if (urlParts.length === 2) path = urlParts[1];
    }

    // 2. Verificar si el archivo ya existe en el NUEVO storage
    // Usamos el list en lugar de download para que sea más rápido
    const folder = path.substring(0, path.lastIndexOf('/')) || '';
    const filename = path.split('/').pop();
    
    const { data: existingFiles } = await newSupabase.storage.from(BUCKET_DOCS).list(folder, {
      limit: 1,
      search: filename
    });

    if (existingFiles && existingFiles.length > 0 && existingFiles[0].name === filename) {
      console.log(`⏭️  Saltando (ya existe): ${path}`);
      skipCount++;
      continue;
    }

    console.log(`⬇️  Descargando: ${path}`);
    const { data: fileData, error: downloadError } = await oldSupabase.storage.from(BUCKET_DOCS).download(path);

    if (downloadError) {
      console.error(`❌ Error descargando ${path}:`, downloadError.message);
      errorCount++;
      continue;
    }

    console.log(`⬆️  Subiendo: ${path}`);
    const { error: uploadError } = await newSupabase.storage.from(BUCKET_DOCS).upload(path, fileData, {
      contentType: fileData.type,
      upsert: true
    });

    if (uploadError) {
      console.error(`❌ Error subiendo ${path}:`, uploadError.message);
      errorCount++;
    } else {
      console.log(`✅ Completado: ${path}`);
      successCount++;
    }
  }

  console.log('\n=========================================');
  console.log('🎉 Migración Finalizada');
  console.log(`✅ Exitosos: ${successCount}`);
  console.log(`⏭️  Saltados (ya existían): ${skipCount}`);
  console.log(`❌ Errores: ${errorCount}`);
  console.log('=========================================');
}

migrateStorage().catch(console.error);
