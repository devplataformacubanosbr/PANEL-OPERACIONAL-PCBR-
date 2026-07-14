import React from 'react';
import { X, ArrowRight, Phone, Mail, MapPin } from 'lucide-react';
import { formatDate } from '../../utils/dateFormatter';
import { formatCurrency } from '../../utils/currencyFormatter';

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[0.75rem] text-text-muted">{label}</span>
      <span className="truncate text-[0.8125rem] font-medium text-text-primary">{value}</span>
    </div>
  );
}

export default function CardDetailPanel({ entrada, stage, etiquetasList = [], onClose, onNavigateToClient, onNavigateToClientsList }) {
  if (!entrada) return null;

  const cliente = entrada.clientes;
  const clientId = entrada.id_cliente || cliente?.id;
  const clientName = cliente?.nombre || entrada.cliente || entrada.nombre_pix || 'Cliente Desconocido';
  const origen = [cliente?.ciudad, cliente?.estado_federal || cliente?.estado, cliente?.nacionalidad].filter(Boolean).join(', ');

  const tags = (entrada.etiquetas_ids || [])
    .map(id => etiquetasList.find(e => e.id === id))
    .filter(Boolean);

  const goToClient = () => {
    if (clientId && onNavigateToClient) {
      onNavigateToClient(clientId);
    } else if (clientName && onNavigateToClientsList) {
      onNavigateToClientsList(clientName);
    }
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label={`Resumen de ${clientName}`}>
      <style>{`
        @keyframes cardDetailBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cardDetailPanelIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      <div
        className="absolute inset-0 bg-black/50"
        style={{ animation: 'cardDetailBackdropIn 150ms ease-out' }}
        onClick={onClose}
      />

      <div
        className="relative flex h-full w-full max-w-[380px] flex-col border-l border-border bg-bg-elevated shadow-lg"
        style={{ animation: 'cardDetailPanelIn 180ms ease-out' }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="m-0 truncate text-[0.95rem] font-bold text-text-primary">{clientName}</h2>
            <p className="m-0 mt-0.5 truncate text-[0.8rem] text-text-secondary">{entrada.servicio || 'Operación'}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-text-muted transition-colors hover:bg-bg-base hover:text-text-primary"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-1.5">
            {stage && (
              <span className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-[0.7rem] font-semibold text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: stage.color || 'var(--color-primary)' }} />
                {stage.label}
              </span>
            )}
            {tags.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded px-2 py-1 text-[0.7rem] font-semibold"
                style={{ background: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40` }}
              >
                {tag.nombre}
              </span>
            ))}
          </div>

          <div className="mt-4">
            <h3 className="m-0 mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-text-muted">Resumen de la operación</h3>
            <div className="divide-y divide-border/60">
              <Row label="Fecha ingreso" value={formatDate(entrada.creado_en)} />
              <Row label="Responsable" value={entrada.operario} />
              {Number(entrada.valor) > 0 && <Row label="Valor" value={formatCurrency(entrada.valor)} />}
            </div>
          </div>

          {(cliente?.telefono || cliente?.email || origen) && (
            <div className="mt-4">
              <h3 className="m-0 mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-text-muted">Cliente</h3>
              <div className="flex flex-col gap-2">
                {cliente?.telefono && (
                  <div className="flex items-center gap-2 text-[0.8125rem] text-text-primary">
                    <Phone size={14} className="shrink-0 text-text-muted" /> {cliente.telefono}
                  </div>
                )}
                {cliente?.email && (
                  <div className="flex items-center gap-2 text-[0.8125rem] text-text-primary">
                    <Mail size={14} className="shrink-0 text-text-muted" /> {cliente.email}
                  </div>
                )}
                {origen && (
                  <div className="flex items-center gap-2 text-[0.8125rem] text-text-primary">
                    <MapPin size={14} className="shrink-0 text-text-muted" /> {origen}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <button
            onClick={goToClient}
            className="flex w-full items-center justify-between rounded-md border border-border bg-bg-base px-3 py-2.5 text-[0.85rem] font-semibold text-text-primary transition-colors hover:border-brand-primary hover:text-brand-primary"
          >
            Ir al cliente
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
