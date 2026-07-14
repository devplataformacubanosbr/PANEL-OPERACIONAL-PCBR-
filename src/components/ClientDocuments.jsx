import React, { useRef, useState } from 'react';
import {  FileText, Loader2, UploadCloud, X , ChevronDown, ChevronUp } from 'lucide-react';
import { SignedImage } from './SignedImage';
import EmptyState from './ui/EmptyState';
import PreUploadDocumentModal from './PreUploadDocumentModal';

const ClientDocuments = ({
  documentos = [],
  defaultExpanded = false,
  uploading,
  isDragging,
  draggedDocument,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileUpload,
  setDraggedDocument,
  setDragOverRelId,
  setViewingDocument,
  handleDeleteDocument,
  stagedFile,
  setStagedFile,
  handleConfirmUpload
}) => {
  const [isSectionExpanded, setIsSectionExpanded] = useState(defaultExpanded);
  const inputRef = useRef(null);

  const openFilePicker = () => inputRef.current?.click();

  return (
    <section id="documentos-subidos" className="glass-panel" style={{ overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: isSectionExpanded ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }} onClick={() => setIsSectionExpanded(!isSectionExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <FileText size={18} color="var(--color-info)" />
          <h3 style={{ font: 'var(--font-section-title)', margin: 0, fontSize: '1rem' }}>Documentos ({documentos.length})</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={(e) => { e.stopPropagation(); openFilePicker(); }} disabled={uploading} className="btn btn-ghost" style={{ padding: '0.4rem', color: 'var(--color-text-muted)' }} title="Subir documento">
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
          </button>
          {isSectionExpanded ? <ChevronUp size={18} color="var(--color-text-muted)" /> : <ChevronDown size={18} color="var(--color-text-muted)" />}
        </div>
      </div>

      {isSectionExpanded && (
        <div style={{ padding: '1.25rem' }}>
        <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFilePicker();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--gap-sm, 8px)',
          minHeight: '60px',
          border: `1px dashed ${isDragging ? 'var(--brand-primary)' : 'var(--border-default)'}`,
          backgroundColor: isDragging ? 'var(--brand-primary-light)' : 'var(--surface-elevated)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem',
          textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          transition: 'all var(--transition-normal)',
          marginBottom: '1rem',
          color: isDragging ? 'var(--brand-primary)' : 'var(--color-text-muted)'
        }}
      >
        <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
        <UploadCloud size={18} />
        <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
          {uploading ? 'Subiendo...' : isDragging ? 'Suelta aquí' : 'Arrastra un documento o haz clic'}
        </span>
      </label>

      {documentos.length > 0 ? (        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {documentos.map(doc => {
            const selected = draggedDocument?.id === doc.id;
            const verified = doc.estado === 'verificado';
            return (
              <div
                key={doc.id}
                role="button"
                tabIndex={0}
                draggable
                onKeyDown={(e) => { if (e.key === 'Enter') setViewingDocument(doc); }}
                onDragStart={(event) => {
                  setDraggedDocument(doc);
                  event.dataTransfer.setData('text/plain', doc.nombre_archivo || 'documento');
                  event.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'document_copy',
                    url: doc.url_archivo,
                    nombre: doc.nombre_archivo || 'documento',
                    tipo: doc.tipo_contenido || 'application/octet-stream'
                  }));
                  const isPdf = doc.url_archivo?.toLowerCase().endsWith('.pdf') || doc.tipo_contenido === 'application/pdf';
                  const mimeType = doc.tipo_contenido || (isPdf ? 'application/pdf' : 'application/octet-stream');
                  let fileName = doc.nombre_archivo || 'documento';
                  if (!fileName.includes('.')) fileName += isPdf ? '.pdf' : '';
                  const safeFileName = fileName.replace(/\s+/g, '_');
                  event.dataTransfer.setData('DownloadURL', `${mimeType}:${safeFileName}:${doc.url_archivo}`);
                  try { event.dataTransfer.setData('text/uri-list', doc.url_archivo); } catch (_err) { }
                  event.dataTransfer.effectAllowed = 'copyLink';
                }}
                onDragEnd={() => { setDraggedDocument(null); setDragOverRelId(null); }}
                onDoubleClick={() => setViewingDocument(doc)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem 1rem',
                  background: selected ? 'var(--brand-primary-light)' : 'var(--surface-elevated)',
                  border: `1px solid ${verified ? 'var(--color-success)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'grab',
                  opacity: selected ? 0.6 : 1,
                  position: 'relative'
                }}
              >
                {/* Image Thumbnail or File Icon */}
                <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: '4px', overflow: 'hidden', background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {doc.url_archivo && doc.tipo_contenido?.startsWith('image/') ? (
                      <>
                        <SignedImage 
                          path={doc.url_archivo} 
                          alt={doc.nombre_archivo} 
                          loading="lazy" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextElementSibling) {
                              e.target.nextElementSibling.style.display = 'flex';
                            }
                          }}
                        />
                        <div style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={20} color="var(--color-info)" />
                      </div>
                    </>
                  ) : (
                    <FileText size={20} color="var(--color-info)" />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {doc.nombre_archivo || 'Documento sin nombre'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    {doc.creado_en ? new Date(doc.creado_en).toLocaleDateString() : '—'} • {doc.tamano ? (doc.tamano / 1024).toFixed(0) + ' KB' : '—'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc); }}
                  style={{
                    width: 24, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', color: 'var(--color-text-muted)', border: 'none', cursor: 'pointer'
                  }}
                  title="Eliminar"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<FileText size={32} />}
          title="Sin documentos"
          description="Aún no hay documentos subidos para este cliente."
          actionLabel="Subir documento"
          onAction={openFilePicker}
          style={{ padding: 'var(--section-gap, 16px)' }}
        />
      )}
    </div>
      )}

      {stagedFile && (
        <PreUploadDocumentModal
          file={stagedFile}
          onClose={() => setStagedFile(null)}
          onConfirm={handleConfirmUpload}
        />
      )}
    </section>
  );
};

export default ClientDocuments;