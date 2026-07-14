import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import KanbanColumn from './KanbanColumn';
import CardDetailPanel from '../pipeline/CardDetailPanel';

export default function KanbanBoard({
  entradas,
  onMoveCard,
  stages,
  onNavigateToClient,
  onNavigateToClientsList,
  onRenameStage,
  onRecolorStage,
  onDeleteStage,
  onReorderStage,
  onAddStage,
  onQuickAdd,
  etiquetasList,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [selectedEntrada, setSelectedEntrada] = useState(null);

  const handleMoveCard = (entradaId, newStageId) => {
    onMoveCard(entradaId, newStageId);
  };

  const submitNewStage = (e) => {
    e.preventDefault();
    if (!newStageName.trim()) return;
    onAddStage(newStageName.trim());
    setNewStageName('');
    setIsAdding(false);
  };

  return (
    <div className="flex h-full w-full gap-6 overflow-x-auto pb-6">
      {stages.map(stage => {
        const columnEntradas = entradas.filter(e => e.stage_id === stage.id);

        return (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            entradas={columnEntradas}
            onMoveCard={handleMoveCard}
            onOpenDetail={setSelectedEntrada}
            onQuickAdd={onQuickAdd}
            onNavigateToClient={onNavigateToClient}
            onNavigateToClientsList={onNavigateToClientsList}
            onRenameStage={onRenameStage}
            onRecolorStage={onRecolorStage}
            onDeleteStage={onDeleteStage}
            onReorderStage={onReorderStage}
            allStages={stages}
            etiquetasList={etiquetasList}
          />
        );
      })}

      {selectedEntrada && (
        <CardDetailPanel
          entrada={selectedEntrada}
          stage={stages.find(s => s.id === selectedEntrada.stage_id)}
          etiquetasList={etiquetasList}
          onClose={() => setSelectedEntrada(null)}
          onNavigateToClient={onNavigateToClient}
          onNavigateToClientsList={onNavigateToClientsList}
        />
      )}

      {onAddStage && (
        <div className="flex h-full w-[220px] shrink-0 flex-col">
          {isAdding ? (
            <form onSubmit={submitNewStage} className="rounded-md bg-bg-base p-3">
              <input
                autoFocus
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onBlur={() => { if (!newStageName.trim()) setIsAdding(false); }}
                onKeyDown={(e) => { if (e.key === 'Escape') setIsAdding(false); }}
                placeholder="Nombre de la etapa"
                className="w-full rounded border border-border bg-bg-elevated px-2 py-1.5 text-sm text-text-primary outline-none"
              />
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 rounded-md p-3 text-sm text-text-muted transition-colors hover:bg-bg-base hover:text-text-primary"
            >
              <Plus size={16} /> Agregar etapa
            </button>
          )}
        </div>
      )}
    </div>
  );
}
