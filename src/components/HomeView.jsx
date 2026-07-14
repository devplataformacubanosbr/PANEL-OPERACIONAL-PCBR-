import { useState, useEffect, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { EmptyState } from './ui/EmptyState';
import { SkeletonCard, SkeletonTramiteCard } from './ui/SkeletonCard';
import KanbanBoard from './ui/KanbanBoard';
import { useOrganization } from '../context/OrganizationContext';
import NewClientWizard from './newClientWizard/NewClientWizard';
import PipelineSwitcher from './pipeline/PipelineSwitcher';
import { formatCurrency } from '../utils/currencyFormatter';
import { updateEntradaStage, getEtiquetas } from '../services/tramitesService';
import {
  getPipelines, createPipeline, updatePipeline, deletePipeline,
  getPipelineStages, createStage, updateStage, deleteStage, reorderStages, runStageAutomations,
} from '../services/pipelineService';

const MISSING_TABLE_CODE = '42P01';

// Supabase corta cada request en 1000 filas — para mostrar TODOS los
// trámites de un pipeline (no solo los primeros) hay que paginar en loop
// en vez de un solo .limit(N) fijo.
async function fetchAllEntradas(pipelineId) {
  const PAGE_SIZE = 1000;
  let all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('entradas')
      .select('*, clientes(*)')
      .eq('pipeline_id', pipelineId)
      .order('creado_en', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export default function HomeView({ onNavigateToClient, onNavigateToClientsList, searchQuery = '', onClearSearch }) {
  const { loading: orgLoading } = useOrganization();
  const [entradas, setEntradas] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [_etiquetas, setEtiquetas] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState(null);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [tramiteFilter, setTramiteFilter] = useState('');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [quickAddStageId, setQuickAddStageId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load pipelines for the org, pick the default one, then its stages + entradas
  useEffect(() => {
    if (orgLoading) return;

    async function load() {
      setLoading(true);
      setMigrationMissing(false);
      try {
        const [pipelineList, etiqsData] = await Promise.all([
          getPipelines(),
          getEtiquetas()
        ]);
        setPipelines(pipelineList);
        setEtiquetas(etiqsData);

        if (pipelineList.length === 0) {
          setStages([]);
          setEntradas([]);
          setLoading(false);
          return;
        }

        const active = pipelineList.find(p => p.id === selectedPipelineId) || pipelineList.find(p => p.es_predeterminado) || pipelineList[0];
        setSelectedPipelineId(active.id);

        const [stageList, entradasList] = await Promise.all([
          getPipelineStages(active.id),
          fetchAllEntradas(active.id),
        ]);

        setStages(stageList);
        setEntradas(entradasList);
      } catch (err) {
        console.error('Error loading pipeline:', err);
        if (err?.code === MISSING_TABLE_CODE) {
          setMigrationMissing(true);
        } else {
          toast.error('No se pudo cargar el pipeline. Intenta nuevamente.');
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgLoading, refreshKey, selectedPipelineId]);

  const reloadStagesAndEntradas = useCallback(async (pipelineId) => {
    try {
      const [stageList, entradasList] = await Promise.all([
        getPipelineStages(pipelineId),
        fetchAllEntradas(pipelineId),
      ]);
      setStages(stageList);
      setEntradas(entradasList);
    } catch (err) {
      console.error('Error reloading pipeline:', err);
    }
  }, []);

  const handleMoveCard = async (entradaId, newStageId) => {
    const stage = stages.find(s => s.id === newStageId);
    if (!stage) return;
    const previous = entradas.find(e => String(e.id) === String(entradaId));

    setEntradas(prev => prev.map(e => String(e.id) === String(entradaId) ? { ...e, stage_id: newStageId } : e));

    try {
      await updateEntradaStage(entradaId, stage);
      if (previous) runStageAutomations(newStageId, previous);
    } catch (err) {
      console.error('Error moving card:', err);
      toast.error('No se pudo mover la tarjeta. Se revirtió el cambio.');
      setEntradas(prev => prev.map(e => String(e.id) === String(entradaId) ? { ...e, stage_id: previous?.stage_id } : e));
    }
  };

  const handleSelectPipeline = (id) => {
    setSelectedPipelineId(id);
    setLoading(true);
    reloadStagesAndEntradas(id).finally(() => setLoading(false));
  };

  const handleCreatePipeline = async (nombre) => {
    const toastId = toast.loading('Creando pipeline...');
    try {
      const pipeline = await createPipeline(nombre);
      setPipelines(prev => [...prev, pipeline]);
      setSelectedPipelineId(pipeline.id);
      await reloadStagesAndEntradas(pipeline.id);
      toast.success('Pipeline creado', { id: toastId });
    } catch (err) {
      console.error('Error creating pipeline:', err);
      toast.error('No se pudo crear el pipeline', { id: toastId });
    }
  };

  const handleRenamePipeline = async (id, nombre) => {
    try {
      await updatePipeline(id, { nombre });
      setPipelines(prev => prev.map(p => p.id === id ? { ...p, nombre } : p));
      toast.success('Pipeline renombrado');
    } catch (err) {
      console.error('Error renaming pipeline:', err);
      toast.error('No se pudo renombrar el pipeline');
    }
  };

  const handleDeletePipeline = async (id) => {
    if (!window.confirm('¿Eliminar este pipeline? Las tarjetas que contiene dejarán de estar visibles en un pipeline.')) return;
    try {
      await deletePipeline(id);
      const remaining = pipelines.filter(p => p.id !== id);
      setPipelines(remaining);
      if (selectedPipelineId === id && remaining.length > 0) {
        handleSelectPipeline(remaining[0].id);
      }
      toast.success('Pipeline eliminado');
    } catch (err) {
      console.error('Error deleting pipeline:', err);
      toast.error('No se pudo eliminar el pipeline');
    }
  };

  const handleAddStage = async (nombre) => {
    try {
      const stage = await createStage({ pipeline_id: selectedPipelineId, nombre, orden: stages.length });
      setStages(prev => [...prev, stage]);
    } catch (err) {
      console.error('Error creating stage:', err);
      toast.error('No se pudo crear la etapa');
    }
  };

  const handleRenameStage = async (id, nombre) => {
    try {
      await updateStage(id, { nombre });
      setStages(prev => prev.map(s => s.id === id ? { ...s, nombre } : s));
    } catch (err) {
      console.error('Error renaming stage:', err);
      toast.error('No se pudo renombrar la etapa');
    }
  };

  const handleRecolorStage = async (id, color) => {
    try {
      await updateStage(id, { color });
      setStages(prev => prev.map(s => s.id === id ? { ...s, color } : s));
    } catch (err) {
      console.error('Error recoloring stage:', err);
      toast.error('No se pudo cambiar el color');
    }
  };

  const handleDeleteStage = async (id) => {
    try {
      await deleteStage(id, selectedPipelineId);
      setStages(prev => prev.filter(s => s.id !== id));
      await reloadStagesAndEntradas(selectedPipelineId);
      toast.success('Etapa eliminada');
    } catch (err) {
      console.error('Error deleting stage:', err);
      toast.error('No se pudo eliminar la etapa');
    }
  };

  const handleReorderStage = async (draggedId, targetId) => {
    const ordered = [...stages];
    const fromIdx = ordered.findIndex(s => s.id === draggedId);
    const toIdx = ordered.findIndex(s => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    setStages(ordered);
    try {
      await reorderStages(ordered.map((s, i) => ({ id: s.id, orden: i })));
    } catch (err) {
      console.error('Error reordering stages:', err);
      toast.error('No se pudo reordenar las etapas');
    }
  };

  const filteredEntradas = useMemo(() => entradas.filter(entrada => {
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const clienteNombre = (entrada.clientes?.nombre || entrada.cliente || '').toLowerCase();
      const clienteCpf = (entrada.clientes?.cpf || '').toLowerCase();
      const servicio = (entrada.servicio || '').toLowerCase();
      if (!clienteNombre.includes(searchLower) && !clienteCpf.includes(searchLower) && !servicio.includes(searchLower)) {
        return false;
      }
    }

    if (tramiteFilter && entrada.servicio !== tramiteFilter) {
      return false;
    }

    return true;
  }), [entradas, searchQuery, tramiteFilter]);

  // Get unique service types for the filter (trámite, remesa, venta, compra, etc.)
  const uniqueTramites = useMemo(() => [...new Set(entradas.map(e => e.servicio).filter(Boolean))].sort(), [entradas]);
  const totalValue = useMemo(() => filteredEntradas.reduce((sum, e) => sum + (Number(e.valor) || 0), 0), [filteredEntradas]);
  const kanbanStages = useMemo(() => stages.map(s => ({ id: s.id, label: s.nombre, color: s.color, codigo: s.codigo, pipeline_id: s.pipeline_id })), [stages]);
  const isFiltering = Boolean(searchQuery || tramiteFilter);

  if (migrationMissing) {
    return (
      <div style={{ padding: 'var(--section-gap, 16px)' }}>
        <EmptyState
          title="Falta activar los pipelines"
          description="Un administrador tiene que aplicar la migración database/migrations/saas/011_pipelines_and_stages.sql en Supabase antes de poder usar esta pantalla."
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--section-gap, 16px)', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="animate-fade-in">
      <header style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--gap-md, 12px)', flexWrap: 'wrap', flexShrink: 0 }}>
        <div>
          {pipelines.length > 0 ? (
            <PipelineSwitcher
              pipelines={pipelines}
              selectedId={selectedPipelineId}
              onSelect={handleSelectPipeline}
              onCreate={handleCreatePipeline}
              onRename={handleRenamePipeline}
              onDelete={handleDeletePipeline}
            />
          ) : (
            <h1 style={{ font: 'var(--font-page-title)', marginBottom: '4px' }}>Pipeline</h1>
          )}
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {filteredEntradas.length} registros{totalValue > 0 && `: ${formatCurrency(totalValue)}`}
            {isFiltering && (
              <button
                onClick={() => { setTramiteFilter(''); onClearSearch?.(); }}
                style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                title="Limpiar filtro"
                aria-label="Limpiar filtro"
              >
                <X size={14} />
              </button>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select
            value={tramiteFilter}
            onChange={(e) => setTramiteFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--surface-base)',
              color: 'var(--color-text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">Todas las operaciones</option>
            {uniqueTramites.map(t => (
              <option key={t} value={t}>{t.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <div className="flex h-full gap-4">
            {[1, 2, 3, 4].map((col) => (
              <div key={col} className="flex h-full w-80 shrink-0 flex-col gap-3 rounded-md bg-bg-base p-4">
                <SkeletonCard height={16} width="60%" />
                <SkeletonTramiteCard />
                <SkeletonTramiteCard />
              </div>
            ))}
          </div>
        ) : pipelines.length === 0 ? (
          <EmptyState
            title="Todavía no tenés ningún pipeline"
            description="Creá tu primer pipeline para empezar a organizar tus operaciones en columnas, como en Kommo."
            actionLabel="Crear pipeline"
            onAction={() => handleCreatePipeline('Pipeline principal')}
          />
        ) : entradas.length === 0 && !searchQuery && !tramiteFilter ? (
          <EmptyState
            title="Todavía no hay operaciones en este pipeline"
            description="Creá tu primer cliente y su operación para empezar a ver el flujo de trabajo acá."
            actionLabel="Crear primer cliente"
            onAction={() => setIsWizardOpen(true)}
          />
        ) : (
          <KanbanBoard
            entradas={filteredEntradas}
            stages={kanbanStages}
            onMoveCard={handleMoveCard}
            onNavigateToClient={onNavigateToClient}
            onNavigateToClientsList={onNavigateToClientsList}
            onRenameStage={handleRenameStage}
            onRecolorStage={handleRecolorStage}
            onDeleteStage={stages.length > 1 ? handleDeleteStage : undefined}
            onReorderStage={handleReorderStage}
            onAddStage={handleAddStage}
            onQuickAdd={(stageId) => { setQuickAddStageId(stageId); setIsWizardOpen(true); }}
          />
        )}
      </div>

      {isWizardOpen && (
        <NewClientWizard
          onClose={() => { setIsWizardOpen(false); setQuickAddStageId(null); }}
          pipelineId={selectedPipelineId}
          stageId={quickAddStageId || stages[0]?.id}
          onClientCreated={(client) => {
            setIsWizardOpen(false);
            setQuickAddStageId(null);
            setRefreshKey((key) => key + 1);
            if (onNavigateToClient) onNavigateToClient(client.id);
          }}
        />
      )}
    </div>
  );
}
