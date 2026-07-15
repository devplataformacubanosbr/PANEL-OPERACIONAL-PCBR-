import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageCircle, ArrowRightCircle, Trash2, Plus, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Select from '../ui/Select';
import AutocompleteTextarea from '../ui/AutocompleteTextarea';
import { cn } from '@/lib/utils';
import {
  getStageAutomations, createAutomation, updateAutomation, deleteAutomation,
  getPipelines, getPipelineStages,
} from '../../services/pipelineService';

const ACTION_LABELS = {
  mensaje: { icon: MessageCircle, label: 'Enviar mensaje de WhatsApp' },
  mover_etapa: { icon: ArrowRightCircle, label: 'Mover a otra etapa' },
};

export default function AutomationsModal({ isOpen, onClose, stage, pipelineId }) {
  const [automations, setAutomations] = useState([]);
  const [pipelineGroups, setPipelineGroups] = useState([]); // [{ pipeline, stages }] across ALL pipelines
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [tipoAccion, setTipoAccion] = useState('mensaje');
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [etapaDestinoId, setEtapaDestinoId] = useState('');
  const [saving, setSaving] = useState(false);

  const destinationGroups = pipelineGroups
    .map(g => ({
      label: g.pipeline.id === pipelineId ? `${g.pipeline.nombre} (esta)` : g.pipeline.nombre,
      options: g.stages.filter(s => s.id !== stage?.id).map(s => ({ value: s.id, label: s.label })),
    }))
    .filter(g => g.options.length > 0);

  useEffect(() => {
    if (!isOpen || !stage) return;
    setLoading(true);
    Promise.all([
      getStageAutomations(stage.id),
      getPipelines().then(pipelines => Promise.all(
        pipelines.map(async (pipeline) => ({
          pipeline,
          stages: (await getPipelineStages(pipeline.id)).map(s => ({ id: s.id, label: s.nombre })),
        }))
      )),
    ])
      .then(([autos, groups]) => { setAutomations(autos); setPipelineGroups(groups); })
      .catch((err) => { console.error(err); toast.error('No se pudieron cargar las automatizaciones'); })
      .finally(() => setLoading(false));
  }, [isOpen, stage, pipelineId]);

  const handleToggle = async (auto) => {
    try {
      await updateAutomation(auto.id, { activo: !auto.activo });
      setAutomations(prev => prev.map(a => a.id === auto.id ? { ...a, activo: !a.activo } : a));
      toast.success(!auto.activo ? 'Automatización activada' : 'Automatización desactivada');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo actualizar');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta automatización?')) return;
    try {
      await deleteAutomation(id);
      setAutomations(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
      toast.error('No se pudo eliminar');
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setTipoAccion('mensaje');
    setMensajeTexto('');
    setEtapaDestinoId('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (tipoAccion === 'mensaje' && !mensajeTexto.trim()) return;
    if (tipoAccion === 'mover_etapa' && !etapaDestinoId) return;

    setSaving(true);
    try {
      const created = await createAutomation({
        pipeline_id: pipelineId,
        stage_id: stage.id,
        tipo_accion: tipoAccion,
        mensaje_texto: tipoAccion === 'mensaje' ? mensajeTexto.trim() : null,
        etapa_destino_id: tipoAccion === 'mover_etapa' ? etapaDestinoId : null,
      });
      setAutomations(prev => [...prev, created]);
      toast.success('Automatización creada, desactivada hasta que la actives');
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo crear la automatización');
    } finally {
      setSaving(false);
    }
  };

  if (!stage) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Automatizaciones — ${stage.label}`}
      ariaLabel={`Automatizaciones de la etapa ${stage.label}`}
      maxWidth={560}
      footer={<Button variant="ghost" onClick={onClose}>Cerrar</Button>}
    >
      <p className="mt-0 mb-4 text-sm text-text-secondary">
        Se ejecutan automáticamente cada vez que una tarjeta entra a esta etapa.
      </p>

      {loading ? (
        <div className="flex justify-center py-8 text-text-muted"><Loader2 className="animate-spin" size={20} /></div>
      ) : (
        <div className="flex flex-col gap-2">
          {automations.map((auto) => {
            const info = ACTION_LABELS[auto.tipo_accion];
            const Icon = info.icon;
            const destGroup = auto.etapa_destino_id ? pipelineGroups.find(g => g.stages.some(s => s.id === auto.etapa_destino_id)) : null;
            const destStage = destGroup?.stages.find(s => s.id === auto.etapa_destino_id);
            const destLabel = destStage
              ? (destGroup.pipeline.id === pipelineId ? destStage.label : `${destGroup.pipeline.nombre} → ${destStage.label}`)
              : 'Etapa eliminada';
            return (
              <div key={auto.id} className="flex items-start gap-3 rounded-md border border-border bg-bg-elevated p-3">
                <Icon size={16} className="mt-0.5 shrink-0 text-brand-primary" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary">{info.label}</div>
                  <div className="truncate text-xs text-text-secondary">
                    {auto.tipo_accion === 'mensaje' ? auto.mensaje_texto : destLabel}
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(auto)}
                  className={cn('h-5 w-9 shrink-0 rounded-full transition-colors', auto.activo ? 'bg-success' : 'bg-bg-surface')}
                  aria-label={auto.activo ? 'Desactivar' : 'Activar'}
                  title={auto.activo ? 'Activada — click para desactivar' : 'Desactivada — click para activar'}
                >
                  <span className={cn('block h-4 w-4 rounded-full bg-white transition-transform', auto.activo ? 'translate-x-4' : 'translate-x-0.5')} />
                </button>
                <button onClick={() => handleDelete(auto.id)} className="shrink-0 text-text-muted hover:text-danger" aria-label="Eliminar">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}

          {automations.length === 0 && !isAdding && (
            <p className="py-2 text-center text-sm text-text-muted">Todavía no hay automatizaciones en esta etapa.</p>
          )}

          {isAdding ? (
            <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-md border border-border bg-bg-elevated p-3">
              <Select
                value={tipoAccion}
                onChange={(e) => setTipoAccion(e.target.value)}
                options={[
                  { value: 'mensaje', label: 'Enviar mensaje de WhatsApp' },
                  { value: 'mover_etapa', label: 'Mover a otra etapa' },
                ]}
              />
              {tipoAccion === 'mensaje' ? (
                <div>
                  <AutocompleteTextarea
                    value={mensajeTexto}
                    onChange={(e) => setMensajeTexto(e.target.value)}
                    placeholder="Ej. Hola {nombre}, tu solicitud avanzó de etapa. Te contactaremos pronto."
                    className="w-full resize-none rounded-sm border border-border bg-bg-surface px-2.5 py-2 text-sm text-text-primary outline-none focus:border-brand-primary"
                  />
                  <p className="mt-1 text-xs text-text-muted">Usá {'{nombre}'} para insertar el nombre del cliente.</p>
                </div>
              ) : (
                <div>
                  <Select
                    value={etapaDestinoId}
                    onChange={(e) => setEtapaDestinoId(e.target.value)}
                    placeholder="Elegí la etapa destino..."
                    groups={destinationGroups}
                  />
                  <p className="mt-1 text-xs text-text-muted">Puede ser una etapa de este pipeline o de otro.</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
                <Button type="submit" variant="primary" size="sm" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" size={14} /> : 'Crear regla'}
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setIsAdding(true)} className="mt-1 self-start">
              <Plus size={14} /> Nueva automatización
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
