import React, { useState } from 'react';
import { ChevronDown, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PipelineSwitcher({ pipelines, selectedId, onSelect, onCreate, onRename, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const selected = pipelines.find(p => p.id === selectedId);

  const startEdit = (pipeline) => {
    setEditingId(pipeline.id);
    setEditValue(pipeline.nombre);
  };

  const saveEdit = () => {
    if (editValue.trim()) onRename(editingId, editValue.trim());
    setEditingId(null);
  };

  const submitCreate = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
    setIsCreating(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-bg-surface px-3 py-1.5 text-sm font-semibold text-text-primary hover:border-border-hover"
      >
        Pipeline
        <span className="text-text-muted">·</span>
        {selected?.nombre || 'Sin pipeline'}
        <ChevronDown size={14} className="text-text-muted" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setEditingId(null); setIsCreating(false); }} />
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-bg-surface p-1.5 shadow-lg">
            {pipelines.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                  p.id === selectedId ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-elevated'
                )}
              >
                {editingId === p.id ? (
                  <>
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      className="min-w-0 flex-1 rounded border border-border bg-bg-elevated px-1.5 py-0.5 text-sm text-text-primary outline-none"
                    />
                    <button onClick={saveEdit} className="shrink-0 text-success"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="shrink-0 text-text-muted"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <button className="min-w-0 flex-1 truncate text-left" onClick={() => { onSelect(p.id); setIsOpen(false); }}>
                      {p.nombre}
                    </button>
                    <button className="hidden shrink-0 text-text-muted hover:text-text-primary group-hover:inline-flex" onClick={() => startEdit(p)} aria-label="Renombrar pipeline">
                      <Pencil size={13} />
                    </button>
                    {pipelines.length > 1 && (
                      <button className="hidden shrink-0 text-text-muted hover:text-danger group-hover:inline-flex" onClick={() => onDelete(p.id)} aria-label="Eliminar pipeline">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}

            <div className="mt-1 border-t border-border pt-1.5">
              {isCreating ? (
                <form onSubmit={submitCreate} className="flex items-center gap-1.5 px-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setIsCreating(false); }}
                    placeholder="Nombre del pipeline"
                    className="min-w-0 flex-1 rounded border border-border bg-bg-elevated px-1.5 py-1 text-sm text-text-primary outline-none"
                  />
                  <button type="submit" className="shrink-0 text-success"><Check size={14} /></button>
                </form>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-brand-primary hover:bg-bg-elevated"
                >
                  <Plus size={14} /> Nuevo pipeline
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
