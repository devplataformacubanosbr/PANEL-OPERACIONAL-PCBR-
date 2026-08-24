import 'dotenv/config';

// Store temporal en memoria para evitar procesamiento duplicado
const requerimientosEnProceso = new Map();
const requerimientosStore = {
  listar: () => Array.from(requerimientosEnProceso.values()),
  agregar: (r) => requerimientosEnProceso.set(r.requerimento, r)
};

// --- POLLING DE AGENDAMIENTOS PENDIENTES DESDE SUPABASE ---
console.log('[Supabase Bridge] Bot de agendamiento iniciado. Monitoreando...');

setInterval(async () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return;
  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/agendamientos_pendientes?estado=eq.pendiente&select=*`;
    const res = await fetch(url, {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) return;
    const pendientes = await res.json();
    
    if (pendientes && pendientes.length > 0) {
      for (const p of pendientes) {
        // Evitar inyectar tareas sin campos requeridos
        if (!p.requerimento || !p.dataNascimento) continue;
        
        // Verificar si ya existe
        const existe = requerimientosStore.listar().find(r => r.requerimento === p.requerimento);
        if (!existe) {
          console.log(`[Supabase Bridge] Recibido nuevo requerimiento desde PCBR: ${p.requerimento}`);
          requerimientosStore.agregar({
            requerimento: p.requerimento,
            dataNascimento: p.dataNascimento,
            uf: p.uf,
            ciudad: p.ciudad,
            posto: p.posto
          });
          
          // Marcar como procesando
          await fetch(`${process.env.SUPABASE_URL}/rest/v1/agendamientos_pendientes?id=eq.${p.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': process.env.SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ estado: 'procesando', actualizado_em: new Date().toISOString() })
          });
        }
      }
    }
  } catch (e) {
    console.error('[Supabase Bridge] Error en polling:', e.message);
  }
}, 30000); // 30 segundos
