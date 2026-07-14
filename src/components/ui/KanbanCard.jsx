import React, { useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { formatDate } from '../../utils/dateFormatter';
import { formatCurrency } from '../../utils/currencyFormatter';
import Avatar from './Avatar';

const CLICK_DELAY = 220;

export default function KanbanCard({ entrada, onOpenDetail, onNavigateToClient, onNavigateToClientsList, etiquetasList = [] }) {
  const clickTimerRef = useRef(null);
  const didDragRef = useRef(false);

  const handleDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', entrada.id);
    e.dataTransfer.effectAllowed = 'move';

    // Un arrastre real no debe abrir el panel de detalle: cancelamos cualquier
    // clic pendiente y marcamos que hubo drag para que el click que el navegador
    // a veces dispara al soltar (si el mouseup cae sobre la propia tarjeta) se ignore.
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    didDragRef.current = true;

    // Optional: make it look slightly transparent while dragging
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    // El click espurio del navegador (si lo hay) llega justo después de dragend;
    // liberamos la bandera en el siguiente tick para no bloquear clics futuros legítimos.
    setTimeout(() => { didDragRef.current = false; }, 0);
  };

  const navigateToClient = () => {
    const clientId = entrada.id_cliente || entrada.clientes?.id;
    const clientName = entrada.clientes?.nombre || entrada.cliente || entrada.nombre_pix;

    if (clientId && onNavigateToClient) {
      onNavigateToClient(clientId);
    } else if (clientName && onNavigateToClientsList) {
      onNavigateToClientsList(clientName);
    }
  };

  // Un solo clic abre el resumen rápido; doble clic salta directo a la ficha del
  // cliente. Como el navegador dispara "click" antes de "dblclick", el clic simple
  // se posterga un poco para poder cancelarlo si llega un segundo clic a tiempo.
  const handleClick = () => {
    if (didDragRef.current || clickTimerRef.current) return;
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      onOpenDetail?.(entrada);
    }, CLICK_DELAY);
  };

  const handleDoubleClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (didDragRef.current) return;
    navigateToClient();
  };

  const hasPendingDocs = () => {
    const txt = [entrada.estado_tramite, entrada.servicio, entrada.clientes?.observaciones, entrada.observaciones, entrada.notas]
      .filter(Boolean).join(' ').toLowerCase();
    return ['pendiente', 'esperando', 'faltante', 'pendente', 'aguardando'].some(k => txt.includes(k));
  };

  const pendingDocs = hasPendingDocs();
  const clientName = entrada.clientes?.nombre || entrada.cliente || entrada.nombre_pix || 'Cliente Desconocido';
  const operario = entrada.operario || 'SIN ASIGNAR';
  const lastNote = entrada.notas || entrada.observaciones || entrada.clientes?.observaciones;

  return (
    <div
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className="flex cursor-grab flex-col gap-2.5 rounded-lg border border-border bg-bg-elevated p-3.5 shadow-md transition-all duration-200 active:cursor-grabbing"
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[0.875rem] font-semibold text-text-primary">
            {clientName}
          </span>
          <span className="truncate text-[0.75rem] text-text-secondary">
            {entrada.servicio || 'Operación'}
          </span>
        </div>
        {Number(entrada.valor) > 0 && (
          <span className="shrink-0 text-[0.75rem] font-bold text-success">
            {formatCurrency(entrada.valor)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[0.65rem] font-medium text-text-muted">
          {entrada.servicio || 'GENERAL'}
        </span>

        {entrada.etiquetas_ids?.map(tagId => {
          const tag = etiquetasList.find(e => e.id === tagId);
          if (!tag) return null;
          return (
            <span
              key={tag.id}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.65rem] font-semibold"
              style={{ background: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40` }}
            >
              {tag.nombre}
            </span>
          );
        })}

        {pendingDocs && (
          <span className="inline-flex items-center rounded border border-danger/30 px-1.5 py-0.5 text-[0.65rem] font-semibold text-danger">
            RETORNO PERDIDO
          </span>
        )}
      </div>

      {lastNote && (
        <div className="flex w-full items-center gap-2 rounded-xl bg-info/[0.08] px-3 py-2">
          <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-info">
            <MessageCircle size={10} color="white" />
          </div>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-info">
            {lastNote}
          </span>
        </div>
      )}

      <div className="mt-0.5 flex items-center justify-between">
        <span className="text-[0.7rem] text-text-muted">
          {formatDate(entrada.creado_en)}
        </span>
        <Avatar name={operario === 'SIN ASIGNAR' ? '?' : operario} size={22} />
      </div>
    </div>
  );
}
