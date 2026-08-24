import React, { useEffect, useState } from 'react';
import { getDashboardStats } from '../../services/dashboardService';
import StatCard from './StatCard';
import { 
  Users, 
  FileText, 
  DollarSign, 
  CheckCircle2,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { LoadingSpinner } from '../../shared/components/ui/LoadingSpinner';

export default function DashboardView({ navigateToClientsList }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (err) {
        setError('Error al cargar las estadísticas.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-chrome-text-muted">
        <AlertCircle size={48} className="text-red-500" />
        <p>{error}</p>
      </div>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-chrome-bg-subtle p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-chrome-text">Panel Operacional</h1>
        <p className="text-chrome-text-muted mt-1">Resumen general del estado de la plataforma.</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Total de Clientes" 
          value={stats.totalClientes} 
          icon={Users} 
          description="Registrados en la plataforma"
        />
        <StatCard 
          title="Trámites Activos" 
          value={stats.totalTramites} 
          icon={FileText} 
          description="Total de operaciones registradas"
        />
        <StatCard 
          title="Valor de Operaciones" 
          value={formatCurrency(stats.ingresosTotales)} 
          icon={DollarSign} 
          description="Ingresos totales brutos"
        />
        <StatCard 
          title="Completados Este Mes" 
          value={stats.tramitesCompletadosMes} 
          icon={CheckCircle2} 
          description="Trámites cerrados este mes"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Clientes por Estado */}
        <div className="rounded-xl border border-chrome-border bg-chrome-bg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-chrome-text mb-4">Clientes por Estado</h2>
          <div className="space-y-4">
            {Object.entries(stats.clientesPorEstado || {}).map(([estado, count]) => (
              <div key={estado} className="flex items-center justify-between">
                <span className="text-chrome-text capitalize">{estado}</span>
                <span className="font-semibold text-chrome-text">{count}</span>
              </div>
            ))}
            {Object.keys(stats.clientesPorEstado || {}).length === 0 && (
              <p className="text-chrome-text-muted text-sm italic">No hay datos de clientes.</p>
            )}
          </div>
        </div>

        {/* Trámites por Estado */}
        <div className="rounded-xl border border-chrome-border bg-chrome-bg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-chrome-text mb-4">Trámites por Estado</h2>
          <div className="space-y-4">
            {Object.entries(stats.tramitesPorEstado || {}).map(([estado, count]) => (
              <div key={estado} className="flex items-center justify-between">
                <span className="text-chrome-text capitalize">{estado.replace(/_/g, ' ')}</span>
                <span className="font-semibold text-chrome-text">{count}</span>
              </div>
            ))}
             {Object.keys(stats.tramitesPorEstado || {}).length === 0 && (
              <p className="text-chrome-text-muted text-sm italic">No hay datos de trámites.</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex justify-center">
        <button 
          onClick={navigateToClientsList}
          className="rounded-md bg-chrome-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-chrome-accent-hover transition-colors"
        >
          Ir al listado de Clientes
        </button>
      </div>

    </div>
  );
}
