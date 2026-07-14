import React, { useState } from 'react';
import { Pencil, Trash2, Palette, Zap, Plus } from 'lucide-react';
import KanbanCard from './KanbanCard';
import { formatCurrency } from '../../utils/currencyFormatter';
import { cn } from '@/lib/utils';
import AutomationsModal from '../pipeline/AutomationsModal';

const SWATCHES = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4'];

export default function KanbanColumn({ stage, entradas, onMoveCard, onOpenDetail, onQuickAdd, onNavigateToClient, onNavigateToClientsList, onRenameStage, onRecolorStage, onDeleteStage, onReorderStage, allStages, etiquetasList }) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(stage.label);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [isAutomationsOpen, setIsAutomationsOpen] = useState(false);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.style.background = 'var(--surface-elevated)';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.style.background = 'transparent';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.background = 'transparent';

    const draggedStageId = e.dataTransfer.getData('application/x-stage-id');
    if (draggedStageId) {
      if (draggedStageId !== stage.id) onReorderStage?.(draggedStageId, stage.id);
      return;
    }

    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId) {
      onMoveCard(cardId, stage.id);
    }
  };

  const handleColumnDragStart = (e) => {
    e.dataTransfer.setData('application/x-stage-id', stage.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const saveTitle = () => {
    setIsEditingTitle(false);
    if (titleValue.trim() && titleValue.trim() !== stage.label) {
      onRenameStage?.(stage.id, titleValue.trim());
    } else {
      setTitleValue(stage.label);
    }
  };

  const totalValue = entradas.reduce((sum, e) => sum + (Number(e.valor) || 0), 0);

  return (
    <div
      className="flex h-full flex-1 basis-[300px] flex-col rounded-lg bg-transparent transition-all duration-200"
      style={{ minWidth: '280px', maxWidth: '100%' }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        draggable={Boolean(onReorderStage) && !isEditingTitle}
        onDragStart={handleColumnDragStart}
        className="group/col mb-3 flex cursor-grab items-center gap-2 px-1 py-1"
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stage.color || 'var(--color-primary)' }} />

        {isEditingTitle ? (
          <input
            autoFocus
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleValue(stage.label); setIsEditingTitle(false); } }}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 rounded border border-brand-primary bg-bg-elevated px-1 text-[0.85rem] font-semibold text-text-primary outline-none"
          />
        ) : (
          <h3 className="m-0 truncate text-[0.85rem] font-semibold text-text-primary">
            {stage.label}
          </h3>
        )}

        <span
          className="shrink-0 rounded-full bg-bg-elevated px-1.5 py-0.5 text-[0.7rem] font-semibold text-text-secondary"
          title={totalValue > 0 ? formatCurrency(totalValue) : undefined}
        >
          {entradas.length}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {!isEditingTitle && (onRenameStage || onRecolorStage || onDeleteStage) && (
            <div className="hidden items-center gap-1 group-hover/col:flex">
              {onRecolorStage && (
                <div className="relative">
                  <button onClick={() => setIsPickingColor(o => !o)} className="text-text-muted hover:text-text-primary" aria-label="Cambiar color">
                    <Palette size={13} />
                  </button>
                  {isPickingColor && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsPickingColor(false)} />
                      <div className="absolute right-0 top-full z-50 mt-1 grid grid-cols-4 gap-1 rounded-md border border-border bg-bg-surface p-2 shadow-lg">
                        {SWATCHES.map((c) => (
                          <button
                            key={c}
                            className={cn('h-5 w-5 rounded-full', stage.color === c && 'ring-2 ring-offset-1 ring-brand-primary')}
                            style={{ background: c }}
                            onClick={() => { onRecolorStage(stage.id, c); setIsPickingColor(false); }}
                            aria-label={`Color ${c}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              {allStages && (
                <button onClick={() => setIsAutomationsOpen(true)} className="text-text-muted hover:text-brand-primary" aria-label="Automatizaciones de esta etapa">
                  <Zap size={13} />
                </button>
              )}
              {onRenameStage && (
                <button onClick={() => setIsEditingTitle(true)} className="text-text-muted hover:text-text-primary" aria-label="Renombrar etapa">
                  <Pencil size={13} />
                </button>
              )}
              {onDeleteStage && (
                <button
                  onClick={() => {
                    if (window.confirm(`¿Eliminar la etapa "${stage.label}"? ${entradas.length > 0 ? `Las ${entradas.length} tarjetas se moverán a otra etapa.` : ''}`)) {
                      onDeleteStage(stage.id);
                    }
                  }}
                  className="text-text-muted hover:text-danger"
                  aria-label="Eliminar etapa"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )}
          {onQuickAdd && (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickAdd(stage.id); }}
              className="text-text-muted hover:text-brand-primary"
              aria-label={`Nueva operación en ${stage.label}`}
              title="Nueva operación"
            >
              <Plus size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-[100px] flex-1 flex-col gap-4 overflow-y-auto p-2">
        {entradas.map(entrada => (
          <KanbanCard
            key={entrada.id}
            entrada={entrada}
            onOpenDetail={onOpenDetail}
            onNavigateToClient={onNavigateToClient}
            onNavigateToClientsList={onNavigateToClientsList}
            etiquetasList={etiquetasList}
          />
        ))}
      </div>

      {allStages && (
        <AutomationsModal
          isOpen={isAutomationsOpen}
          onClose={() => setIsAutomationsOpen(false)}
          stage={stage}
          pipelineId={stage.pipeline_id}
        />
      )}
    </div>
  );
}
