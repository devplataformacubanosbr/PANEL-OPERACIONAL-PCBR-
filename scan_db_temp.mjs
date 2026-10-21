import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Connecting to Supabase URL:', url);
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const candidateTables = [
  'configuracion_empresa',
  'configuraciones_app',
  'perfiles',
  'clientes',
  'tramites_catalogo',
  'tramites_categorias',
  'tramites_precios',
  'tramites_requisitos',
  'entradas',
  'notas_tramite',
  'pagos_tramite',
  'salidas',
  'operarios',
  'etiquetas',
  'pipelines',
  'pipeline_etapas',
  'pipeline_automatizaciones',
  'documentos_operacionales',
  'documentos_pendientes',
  'formularios_clientes',
  'relaciones_clientes',
  'historial_clientes',
  'historial_cambios',
  'mensajes',
  'chat_equipo',
  'chat_privado',
  'ai_chats',
  'ia_workflows',
  'biblioteca_multimedia',
  'configuracion_bot',
  'notificaciones_equipo',
  'integraciones_whatsapp',
  'integraciones_kommo',
  'kommo_field_mappings',
  'kommo_stage_mappings',
  'plantillas_documentos',
  'estados_br',
  // standalone additions
  'postos_policia_federal',
  'policia_puntos',
  'policia_procesos',
  'manuales',
  'manual_variantes',
  'email_cuentas',
  'emails_recibidos',
  'email_plantillas',
  'agendamientos'
];

async function scan() {
  const tableSummary = [];
  for (const table of candidateTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) {
        tableSummary.push({ table, status: 'ERROR', code: error.code, message: error.message });
      } else {
        tableSummary.push({ table, status: 'EXISTS', rows: count });
      }
    } catch (e) {
      tableSummary.push({ table, status: 'EXCEPTION', message: e.message });
    }
  }

  let storageBuckets = [];
  try {
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    if (bErr) storageBuckets = { error: bErr.message };
    else storageBuckets = buckets.map(b => ({ name: b.name, id: b.id, public: b.public }));
  } catch (e) {
    storageBuckets = { error: e.message };
  }

  console.log('=== TABLE SCAN RESULTS ===');
  console.table(tableSummary);
  console.log('=== STORAGE BUCKETS ===');
  console.log(JSON.stringify(storageBuckets, null, 2));
}

scan().catch(console.error);
