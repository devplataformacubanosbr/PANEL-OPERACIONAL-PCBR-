import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, MessageCircle, ArrowRightCircle, Bot, Mail, Globe, Tags, UserPlus, FileText, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOrganization } from '../context/OrganizationContext';
import { EmptyState } from './ui/EmptyState';
import Select from './ui/Select';
import Button from './ui/Button';
import Modal from './ui/Modal';
import PipelineSwitcher from './pipeline/PipelineSwitcher';
import { cn } from '@/lib/utils';
import {
  getPipelines, getPipelineStages, getStageAutomations,
  createAutomation, updateAutomation, deleteAutomation
} from '../services/pipelineService';
import { getCatalogoTramites, getOperarios, getEtiquetas } from '../services/tramitesService';
import { getAiWorkflows } from '../services/workflowService';

const ACTION_LABELS = {
  mensaje: { icon: MessageCircle, label: 'Enviar mensaje de WhatsApp' },
  mover_etapa: { icon: ArrowRightCircle, label: 'Mover a otra etapa' },
  webhook: { icon: Globe, label: 'Enviar Webhook' },
  operario: { icon: UserPlus, label: 'Cambiar Responsable' },
  etiqueta: { icon: Tags, label: 'Añadir Etiqueta' }
};

const ACTION_GRID = [
  { id: 'mensaje', title: 'Enviar WhatsApp', description: 'Envía un mensaje automático al cliente.', icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  { id: 'mover_etapa', title: 'Mover tarjeta', description: 'Cambia la tarjeta a otra etapa de un pipeline.', icon: ArrowRightCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'ia', title: 'Lanzar Agente IA', description: 'Conecta con n8n o inicia un Bot.', icon: Bot, soon: false, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'email', title: 'Enviar Correo', description: 'Dispara un email transaccional.', icon: Mail, soon: true, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'webhook', title: 'Enviar Webhook', description: 'Envía datos del trámite y cliente a Zapier, Make o n8n.', icon: Globe, bg: 'bg-emerald-500/10', color: 'text-emerald-500', soon: false },
  { id: 'etiqueta', title: 'Añadir Etiqueta', description: 'Categoriza el trámite automáticamente.', icon: Tags, soon: false, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { id: 'operario', title: 'Cambiar Responsable', description: 'Asigna la tarjeta a un operario.', icon: UserPlus, soon: false, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { id: 'formulario', title: 'Generar Formulario', description: 'Crea y envía un link para rellenar.', icon: FileText, soon: true, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
];

export default function AutomationsView() {
  const { loading: orgLoading } = useOrganization();
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState(null);
  const [stages, setStages] = useState([]);
  const [automationsByStage, setAutomationsByStage] = useState({}); // { stageId: [automations] }
  const [pipelineGroups, setPipelineGroups] = useState([]); // para el dropdown de destinos
  const [loading, setLoading] = useState(true);

  // Estados para el modal
  const [pickerModalOpen, setPickerModalOpen] = useState(false);
  const [targetStageId, setTargetStageId] = useState(null);
  const [selectedActionId, setSelectedActionId] = useState(null);

  // Estados del formulario
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [etapaDestinoId, setEtapaDestinoId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [operarioNombre, setOperarioNombre] = useState('');
  const [etiquetaId, setEtiquetaId] = useState('');
  const [condicionServicios, setCondicionServicios] = useState([]);
  const [catalogoTramites, setCatalogoTramites] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [etiquetas, setEtiquetas] = useState([]);
  const [aiWorkflows, setAiWorkflows] = useState([]);
  const [iaWorkflowId, setIaWorkflowId] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (orgLoading) return;
    setLoading(true);
    try {
      const pipelineList = await getPipelines();
      setPipelines(pipelineList);

      if (pipelineList.length === 0) {
        setStages([]);
        setLoading(false);
        return;
      }

      const active = pipelineList.find(p => p.id === selectedPipelineId) || pipelineList.find(p => p.es_predeterminado) || pipelineList[0];
      setSelectedPipelineId(active.id);

      const stageList = await getPipelineStages(active.id);
      setStages(stageList);

      // Cargar grupos para el dropdown
      const groups = await Promise.all(pipelineList.map(async (pipeline) => ({
        pipeline,
        stages: (await getPipelineStages(pipeline.id)).map(s => ({ id: s.id, label: s.nombre })),
      })));
      setPipelineGroups(groups);

      // Cargar catálogo de trámites
      const catalogo = await getCatalogoTramites();
      setCatalogoTramites(catalogo);

      // Cargar operarios y etiquetas y flujos IA
      const [ops, etiqs, wfs] = await Promise.all([getOperarios(), getEtiquetas(), getAiWorkflows()]);
      setOperarios(ops);
      setEtiquetas(etiqs);
      setAiWorkflows(wfs);

      // Cargar automatizaciones de las etapas actuales
      const automationsObj = {};
      await Promise.all(stageList.map(async (stage) => {
        const autos = await getStageAutomations(stage.id);
        automationsObj[stage.id] = autos;
      }));
      setAutomationsByStage(automationsObj);
      
    } catch (err) {
      console.error('Error loading automations view:', err);
      toast.error('No se pudieron cargar las automatizaciones');
    } finally {
      setLoading(false);
    }
  }, [orgLoading, selectedPipelineId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectPipeline = (id) => {
    setSelectedPipelineId(id);
  };

  const handleToggle = async (auto, stageId) => {
    try {
      await updateAutomation(auto.id, { activo: !auto.activo });
      setAutomationsByStage(prev => ({
        ...prev,
        [stageId]: prev[stageId].map(a => a.id === auto.id ? { ...a, activo: !auto.activo } : a)
      }));
      toast.success(!auto.activo ? 'Automatización activada' : 'Automatización desactivada');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo actualizar');
    }
  };

  const handleDelete = async (id, stageId) => {
    if (!window.confirm('¿Eliminar esta automatización?')) return;
    try {
      await deleteAutomation(id);
      setAutomationsByStage(prev => ({
        ...prev,
        [stageId]: prev[stageId].filter(a => a.id !== id)
      }));
      toast.success('Automatización eliminada');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo eliminar');
    }
  };

  const resetForm = () => {
    setSelectedActionId(null);
    setMensajeTexto('');
    setEtapaDestinoId('');
    setWebhookUrl('');
    setOperarioNombre('');
    setEtiquetaId('');
    setCondicionServicios([]);
  };

  const openPickerModal = (stageId) => {
    setTargetStageId(stageId);
    setSelectedActionId(null);
    setMensajeTexto('');
    setEtapaDestinoId('');
    setWebhookUrl('');
    setOperarioNombre('');
    setEtiquetaId('');
    setIaWorkflowId('');
    setCondicionServicios([]);
    setPickerModalOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (selectedActionId === 'mensaje' && !mensajeTexto.trim()) return;
    if (selectedActionId === 'mover_etapa' && !etapaDestinoId) return;
    if (selectedActionId === 'webhook' && !webhookUrl.trim()) return;
    if (selectedActionId === 'operario' && !operarioNombre) return;
    if (selectedActionId === 'etiqueta' && !etiquetaId) return;

    setSaving(true);
    try {
      const created = await createAutomation({
        pipeline_id: selectedPipelineId,
        stage_id: targetStageId,
        tipo_accion: selectedActionId,
        mensaje_texto: selectedActionId === 'mensaje' ? mensajeTexto.trim() : null,
        etapa_destino_id: selectedActionId === 'mover_etapa' ? etapaDestinoId : null,
        webhook_url: selectedActionId === 'webhook' ? webhookUrl.trim() : null,
        operario_nombre: selectedActionId === 'operario' ? operarioNombre : null,
        etiqueta_id: selectedActionId === 'etiqueta' ? etiquetaId : null,
        ia_workflow_id: selectedActionId === 'ia' ? iaWorkflowId : null,
        condiciones: condicionServicios.length > 0 ? { servicios: condicionServicios } : {}
      });
      setAutomationsByStage(prev => ({
        ...prev,
        [targetStageId]: [...(prev[targetStageId] || []), created]
      }));
      toast.success('Automatización creada. Actívala cuando estés listo.');
      setPickerModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo crear la automatización');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-brand-primary" size={32} />
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title="Sin pipelines"
          description="Debes crear un pipeline primero para configurar sus automatizaciones."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4 animate-fade-in overflow-hidden">
      <header className="mb-6 flex shrink-0 flex-col gap-2">
        <h1 style={{ font: 'var(--font-page-title)' }}>Automatizaciones</h1>
        <div className="flex items-center">
          <PipelineSwitcher
            pipelines={pipelines}
            selectedId={selectedPipelineId}
            onSelect={handleSelectPipeline}
          />
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {stages.length === 0 ? (
          <EmptyState title="Sin etapas" description="Este pipeline no tiene etapas configuradas." />
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-6 items-start h-full">
            {stages.map(stage => {
              const automations = automationsByStage[stage.id] || [];

              const _destinationGroups = pipelineGroups
                .map(g => ({
                  label: g.pipeline.id === selectedPipelineId ? `${g.pipeline.nombre} (esta)` : g.pipeline.nombre,
                  options: g.stages.filter(s => s.id !== stage.id).map(s => ({ value: s.id, label: s.label })),
                }))
                .filter(g => g.options.length > 0);

              return (
                <div key={stage.id} className="flex shrink-0 w-80 flex-col">
                  <div className="mb-3 flex items-center gap-2 px-1">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stage.color }} />
                    <h3 className="flex-1 truncate text-sm font-semibold text-text-primary">{stage.nombre}</h3>
                    <span className="shrink-0 rounded-full bg-bg-elevated px-1.5 py-0.5 text-[0.7rem] font-semibold text-text-secondary">{automations.length}</span>
                  </div>

                  <div className={cn('flex flex-col divide-y divide-border/60', automations.length > 0 && 'rounded-md border border-border')}>
                    {automations.map(auto => {
                      const info = ACTION_LABELS[auto.tipo_accion] || { icon: Bot, label: auto.tipo_accion };
                      const Icon = info.icon;
                      const destGroup = auto.etapa_destino_id ? pipelineGroups.find(g => g.stages.some(s => s.id === auto.etapa_destino_id)) : null;
                      const destStage = destGroup?.stages.find(s => s.id === auto.etapa_destino_id);
                      const destLabel = destStage
                        ? (destGroup.pipeline.id === selectedPipelineId ? destStage.label : `${destGroup.pipeline.nombre} → ${destStage.label}`)
                        : 'Etapa eliminada';
                      
                      let secondaryText = '';
                      if (auto.tipo_accion === 'mensaje') secondaryText = auto.mensaje_texto;
                      else if (auto.tipo_accion === 'mover_etapa') secondaryText = destLabel;
                      else if (auto.tipo_accion === 'webhook') secondaryText = auto.webhook_url;
                      else if (auto.tipo_accion === 'operario') secondaryText = auto.operario_nombre;
                      else if (auto.tipo_accion === 'ia') {
                        const wf = aiWorkflows.find(w => w.id === auto.ia_workflow_id);
                        secondaryText = wf ? wf.nombre : 'Bot eliminado';
                      }
                      else if (auto.tipo_accion === 'etiqueta') {
                        const etiq = etiquetas.find(e => e.id === auto.etiqueta_id);
                        secondaryText = etiq ? etiq.nombre : 'Etiqueta eliminada';
                      }

                      return (
                        <div key={auto.id} className="flex items-start gap-3 p-3 transition-colors hover:bg-bg-elevated">
                          <Icon size={16} className="mt-0.5 shrink-0 text-brand-primary" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-text-primary">{info.label}</div>
                            <div className="truncate text-xs text-text-secondary mt-0.5" title={secondaryText}>
                              {secondaryText}
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggle(auto, stage.id)}
                            className={cn('h-5 w-9 shrink-0 rounded-full transition-colors', auto.activo ? 'bg-success' : 'bg-border')}
                            aria-label={auto.activo ? 'Desactivar' : 'Activar'}
                          >
                            <span className={cn('block h-4 w-4 rounded-full bg-white transition-transform', auto.activo ? 'translate-x-4' : 'translate-x-0.5')} />
                          </button>
                          <button onClick={() => handleDelete(auto.id, stage.id)} className="shrink-0 text-text-muted hover:text-danger">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}

                  </div>

                  {automations.length === 0 && (
                    <p className="text-center text-sm text-text-muted py-2 italic">Sin reglas</p>
                  )}

                  <Button variant="secondary" size="sm" onClick={() => openPickerModal(stage.id)} className="w-full justify-center mt-2">
                    <Plus size={14} className="mr-1" /> Añadir regla
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pickerModalOpen && (
        <Modal 
          isOpen 
          onClose={() => setPickerModalOpen(false)} 
          title={selectedActionId ? "Configurar Acción" : "Seleccionar Acción"} 
          maxWidth={750}
        >
          {!selectedActionId ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
              {ACTION_GRID.map(action => (
                <button 
                  key={action.id} 
                  type="button"
                  onClick={() => !action.soon && setSelectedActionId(action.id)}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border text-left transition-all",
                    action.soon 
                      ? "opacity-60 cursor-not-allowed bg-bg-surface border-border" 
                      : "hover:border-brand-primary bg-bg-elevated border-border cursor-pointer hover:shadow-md"
                  )}
                >
                   <div className={cn("p-3 rounded-lg shrink-0", action.bg, action.color)}>
                     <action.icon size={26} />
                   </div>
                   <div className="flex-1">
                     <div className="flex flex-wrap items-center gap-2">
                       <h4 className="font-semibold text-text-primary text-[15px]">{action.title}</h4>
                       {action.soon && (
                         <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-brand-primary/10 text-brand-primary">
                           Próximamente
                         </span>
                       )}
                     </div>
                     <p className="text-[13px] leading-snug text-text-secondary mt-1.5">{action.description}</p>
                   </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-5 pb-2">
              <button 
                type="button" 
                onClick={() => setSelectedActionId(null)} 
                className="flex items-center text-sm font-medium text-text-muted hover:text-text-primary w-fit transition-colors"
              >
                <ChevronLeft size={18} className="mr-1" /> Volver a las opciones
              </button>
              <form onSubmit={handleCreate} className="flex flex-col gap-5">
                {/* Bloque de Condiciones */}
                <div className="rounded-md border border-border bg-bg-surface p-4 shadow-sm">
                  <label className="mb-1 block text-sm font-semibold text-text-primary">Filtros (Opcional)</label>
                  <p className="mb-3 text-[13px] text-text-muted leading-snug">Selecciona para qué trámites debe ejecutarse esta regla. Si no seleccionas ninguno, aplicará para todos.</p>
                  
                  <div className="max-h-36 overflow-y-auto space-y-2 rounded-md border border-border bg-bg-base p-3">
                    {catalogoTramites.map(t => (
                      <label key={t.id} className="flex items-center gap-2.5 text-sm text-text-secondary hover:text-text-primary cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-border text-brand-primary focus:ring-brand-primary focus:ring-offset-bg-base cursor-pointer"
                          checked={condicionServicios.includes(t.nombre.toUpperCase())}
                          onChange={(e) => {
                            const val = t.nombre.toUpperCase();
                            if (e.target.checked) {
                              setCondicionServicios(prev => [...prev, val]);
                            } else {
                              setCondicionServicios(prev => prev.filter(s => s !== val));
                            }
                          }}
                        />
                        <span className="mt-0.5">{t.nombre}</span>
                      </label>
                    ))}
                    {catalogoTramites.length === 0 && (
                      <span className="text-xs text-text-muted italic block py-1">No hay trámites configurados en el catálogo.</span>
                    )}
                  </div>
                </div>

                {selectedActionId === 'mensaje' ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-text-primary">Texto del mensaje</label>
                    <textarea
                      value={mensajeTexto}
                      onChange={(e) => setMensajeTexto(e.target.value)}
                      placeholder="Hola {nombre}, te contactamos de..."
                      rows={4}
                      autoFocus
                      className="w-full resize-none rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all"
                    />
                    <p className="mt-1.5 text-xs text-text-muted">Usa {'{nombre}'} para insertar el nombre del cliente dinámicamente.</p>
                  </div>
                ) : selectedActionId === 'mover_etapa' ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-text-primary">Etapa de destino</label>
                    <Select
                      value={etapaDestinoId}
                      onChange={(e) => setEtapaDestinoId(e.target.value)}
                      placeholder="Selecciona hacia dónde se moverá la tarjeta..."
                      groups={pipelineGroups
                        .map(g => ({
                          label: g.pipeline.id === selectedPipelineId ? `${g.pipeline.nombre} (este pipeline)` : g.pipeline.nombre,
                          options: g.stages.filter(s => s.id !== targetStageId).map(s => ({ value: s.id, label: s.label })),
                        }))
                        .filter(g => g.options.length > 0)
                      }
                    />
                  </div>
                ) : selectedActionId === 'operario' ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-text-primary">Responsable Asignado</label>
                    <Select
                      value={operarioNombre}
                      onChange={(e) => setOperarioNombre(e.target.value)}
                      placeholder="Selecciona el operario..."
                      options={operarios.map(o => ({ value: o.nombre, label: o.nombre }))}
                    />
                  </div>
                ) : selectedActionId === 'etiqueta' ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-text-primary">Etiqueta a añadir</label>
                    <Select
                      value={etiquetaId}
                      onChange={(e) => setEtiquetaId(e.target.value)}
                      placeholder="Selecciona la etiqueta..."
                      options={etiquetas.map(e => ({ value: e.id, label: e.nombre }))}
                    />
                    {etiquetas.length === 0 && (
                      <p className="mt-2 text-xs text-brand-primary">No hay etiquetas creadas. Ve a Configuración &gt; Etiquetas para crear la primera.</p>
                    )}
                  </div>
                ) : selectedActionId === 'ia' ? (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-text-primary">Bot IA a Lanzar</label>
                    <Select
                      value={iaWorkflowId}
                      onChange={(e) => setIaWorkflowId(e.target.value)}
                      placeholder="Selecciona el bot..."
                      options={aiWorkflows.map(w => ({ value: w.id, label: w.nombre }))}
                    />
                    {aiWorkflows.length === 0 && (
                      <p className="mt-2 text-xs text-brand-primary">No tienes bots creadas. Ve a Configuración &gt; Agentes IA para diseñar tu primer bot.</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-text-primary">URL del Webhook (Make, n8n, Zapier)</label>
                    <input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://hook.us1.make.com/..."
                      required
                      className="w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all"
                    />
                    <div className="mt-2.5 p-3 rounded bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
                      <p className="text-xs font-medium">Información enviada por POST (JSON):</p>
                      <ul className="list-disc ml-4 mt-1 text-[11px] opacity-80">
                        <li><strong>tramite:</strong> ID, servicio, estado actual</li>
                        <li><strong>cliente:</strong> Nombre, teléfono, documento</li>
                        <li><strong>evento:</strong> STAGE_CHANGED</li>
                      </ul>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                  <Button type="button" variant="ghost" onClick={() => setPickerModalOpen(false)}>Cancelar</Button>
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? <><Loader2 className="animate-spin mr-2" size={16} /> Guardando...</> : 'Guardar Automatización'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
