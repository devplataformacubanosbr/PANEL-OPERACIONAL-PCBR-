import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Download } from 'lucide-react';

export default function ViewManualModal({ isOpen, onClose, manual }) {
  if (!isOpen || !manual) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={manual.titulo}
      maxWidth={800}
      footer={(
        <div className="flex justify-end gap-3 w-full">
          {manual.url_pdf && (
            <a
              href={manual.url_pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-brand-primary text-brand-primary rounded-lg text-sm font-medium hover:bg-brand-primary/10 transition-colors"
            >
              <Download size={16} />
              Descargar PDF
            </a>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      )}
    >
      <div className="flex flex-col gap-4 py-2 text-chrome-text">
        {manual.descripcion && (
          <p className="text-sm font-medium text-chrome-text-muted">
            {manual.descripcion}
          </p>
        )}
        <div className="prose prose-sm prose-invert max-w-none mt-2 whitespace-pre-wrap">
          {manual.contenido || (
            <span className="italic text-chrome-text-muted">
              No hay contenido detallado para este manual.
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}
