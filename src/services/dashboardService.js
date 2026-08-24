import { supabase } from '../supabaseClient';

export async function getDashboardStats() {
  try {
    // 1. Total de clientes
    const { count: totalClientes, error: errClientes } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true });
    
    if (errClientes) throw errClientes;

    // 2. Clientes por estado
    const { data: clientesPorEstadoData, error: errEstado } = await supabase
      .from('clientes')
      .select('estado_cliente');

    if (errEstado) throw errEstado;

    const clientesPorEstado = clientesPorEstadoData.reduce((acc, client) => {
      const estado = client.estado_cliente || 'nuevo';
      acc[estado] = (acc[estado] || 0) + 1;
      return acc;
    }, {});

    // 3. Entradas (Trámites)
    const { data: entradasData, error: errEntradas } = await supabase
      .from('entradas')
      .select('valor, estado_tramite, fecha_completacion, creado_en, servicio');
      
    if (errEntradas) throw errEntradas;

    let ingresosTotales = 0;
    const tramitesPorEstado = {
      pendiente: 0,
      esperando_docs: 0,
      procesando: 0,
      cancelada: 0,
      completada: 0
    };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let tramitesCompletadosMes = 0;
    let agendamientosMes = 0;

    entradasData.forEach(entrada => {
      // Ingresos Totales
      if (entrada.valor) {
        ingresosTotales += Number(entrada.valor);
      }

      // Por estado
      const estado = entrada.estado_tramite || 'pendiente';
      if (tramitesPorEstado[estado] !== undefined) {
        tramitesPorEstado[estado]++;
      } else {
        tramitesPorEstado[estado] = 1;
      }

      // Completados este mes
      if (estado === 'completada' && entrada.fecha_completacion) {
        const fecha = new Date(entrada.fecha_completacion);
        if (fecha >= startOfMonth) {
          tramitesCompletadosMes++;
        }
      }

      // Agendamientos creados este mes
      if (entrada.servicio && entrada.servicio.toLowerCase().includes('agendamiento')) {
        const fechaCreacion = new Date(entrada.creado_en);
        if (fechaCreacion >= startOfMonth) {
          agendamientosMes++;
        }
      }
    });

    return {
      totalClientes,
      clientesPorEstado,
      totalTramites: entradasData.length,
      tramitesPorEstado,
      ingresosTotales,
      tramitesCompletadosMes,
      agendamientosMes
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
}
