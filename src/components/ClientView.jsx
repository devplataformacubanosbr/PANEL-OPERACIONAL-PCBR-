/**
 * ClientView.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Vista principal de un cliente. Actúa como orquestador puro: conecta hooks
 * de lógica de negocio con componentes de presentación. Toda la lógica pesada
 * se delegó a custom hooks en /hooks/.
 *
 * Hooks extraídos:
 *   - useClientViewEdit         → edición de datos del cliente
 *   - useClientViewDocuments    → subida/eliminación/drag de documentos
 *   - useClientViewRelations    → vínculos familiares
 *   - useClientViewTramites     → gestión de trámites
 *   - useClientViewExtraction   → extracción IA y copia a relacionamientos
 *   - useHorizontalDragScroll   → scroll horizontal con arrastre de mouse
 *
 * Constantes extraídas:
 *   - clientView.constants.js   → FIXED_FIELDS_CATALOG, TRAMITE_COLORS, etc.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useCallback, lazy, Suspense, useRef } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { analyzeDocumentImage } from '../services/aiService';
import useClientAiChat from '../hooks/useClientAiChat';
import { useOrganization } from '../context/OrganizationContext';

// ── Extracted hooks ──────────────────────────────────────────────────────────
import useClientViewEdit from '../hooks/useClientViewEdit';
import useClientViewDocuments from '../hooks/useClientViewDocuments';
import useClientViewRelations from '../hooks/useClientViewRelations';
import useClientViewTramites from '../hooks/useClientViewTramites';
import useClientViewExtraction from '../hooks/useClientViewExtraction';
import useHorizontalDragScroll from '../hooks/useHorizontalDragScroll';

// ── Constants ────────────────────────────────────────────────────────────────
import { FIXED_FIELDS_CATALOG, toIsoDate, toSlashDate } from './clientView.constants';

// ── Child components ─────────────────────────────────────────────────────────
import NewClientWizard from './newClientWizard/NewClientWizard';
import ClientPersonalData from './ClientPersonalData';
import ClientDocuments from './ClientDocuments';
import ClientWhatsApp from './ClientWhatsApp';
import ClientEmail from './ClientEmail';
import ClientRelations from './ClientRelations';
import ClientViewHeader from './ClientViewHeader';
import ClientViewTramites from './ClientViewTramites';
import ClientViewAiChat from './ClientViewAiChat';
import DuplicateContactsWarning from './DuplicateContactsWarning';
import ClientHistory from './ClientHistory';

const TemplateManager = lazy(() => import('./TemplateManager'));
const DocumentViewerModal = lazy(() => import('./DocumentViewerModal'));
const ClientForms = lazy(() => import('./ClientForms'));
const ClientViewRelateModal = lazy(() => import('./ClientViewRelateModal'));
const ClientViewNewTramiteModal = lazy(() => import('./ClientViewNewTramiteModal'));
const ClientViewEditModal = lazy(() => import('./ClientViewEditModal'));
const ClientViewExtractionModal = lazy(() => import('./ClientViewExtractionModal'));
const ClientMediaLibrary = lazy(() => import('./ClientMediaLibrary'));
const SignatureExtractorModal = lazy(() => import('./SignatureExtractorModal'));
const SyncDataModal = lazy(() => import('./SyncDataModal'));
import useClientData from '../hooks/useClientData';
import { useQueryClient, useQuery } from '@tanstack/react-query';

export default function ClientView({ clientId, onBack, onNavigateToClient }) {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const {
    client,
    relations: relaciones,
    documents: documentos,
    entradas,
    formularios,
    duplicateContacts,
    customFieldsConfig,
    isLoading,
    isError,
    error: clientDataError,
  } = useClientData(clientId);

  if (isError) {
    console.error('[ClientView] Error cargando datos del cliente:', clientDataError);
  }

  const { data: allClientes = [] } = useQuery({
    queryKey: ['allClientesBase'],
    queryFn: async () => {
      const { data } = await supabase.from('clientes').select('id, nombre, cpf');
      return data || [];
    }
  });

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [copiedId, setCopiedId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [activeCommTab, setActiveCommTab] = useState('whatsapp');
  const [col3Width, setCol3Width] = useState(450); // Ancho inicial
  const col3Ref = useRef(null);

  const fetchClientData = async (_fullReload = false) => {
    await queryClient.invalidateQueries();
  };

  // ── Compose hooks ──────────────────────────────────────────────────────────
  const extraction = useClientViewExtraction({ clientId, fetchClientData, client });

  const edit = useClientViewEdit({
    clientId,
    client,
    customFieldsConfig,
    fetchClientData,
  });

  const docs = useClientViewDocuments({
    clientId,
    queryClient,
    fetchClientData,
    setExtractedData: extraction.setExtractedData,
    setIsExtractionModalOpen: extraction.setIsExtractionModalOpen,
    setUploadedDocRecord: extraction.setUploadedDocRecord,
  });

  const relations = useClientViewRelations({ clientId, queryClient });
  const tramites = useClientViewTramites({ clientId, queryClient });
  const { scrollContainerRef, scrollHandlers } = useHorizontalDragScroll();

  const {
    isAiChatOpen,
    setIsAiChatOpen,
    aiChatMessages,
    aiChatInput,
    setAiChatInput,
    isAiChatLoading,
    crmContext,
    handleSendAiMessage,
  } = useClientAiChat(client, [], entradas);

  // ── Merge custom fields with fixed fields ──────────────────────────────────
  // Los 13 campos migratorios de FIXED_FIELDS_CATALOG siguen siendo columnas
  // fijas de `clientes`. Los campos dinámicos nuevos (creados desde
  // Configuración > Campos Base, tabla config_campos_clientes) se guardan en
  // clientes.campos_personalizados y se marcan con is_custom_json para que el
  // resto de los componentes sepan leer/escribir ahí en vez de en una columna.
  const mergedFields = [
    ...FIXED_FIELDS_CATALOG,
    ...(customFieldsConfig || []).map(cf => ({
      id: cf.identificador,
      nombre_campo: cf.nombre_campo,
      requerido: cf.requerido,
      es_fijo: true,
      category_name: cf.categoria,
      is_custom_json: true,
      tipo: cf.tipo,
    }))
  ];

  // ── Simple handlers ────────────────────────────────────────────────────────
  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDeleteClient = useCallback(async () => {
    if (!window.confirm('Eliminar este cliente y TODOS sus datos? Esta acción no puede deshacerse.')) return;
    setIsDeleting(true);
    const toastId = toast.loading('Eliminando cliente...');
    try {
      await supabase.from('relaciones_clientes').delete().or(`cliente_id.eq.${clientId},cliente_relacionado_id.eq.${clientId}`);
      await supabase.from('documentos_operacionales').delete().eq('id_cliente', clientId);
      const { error } = await supabase.from('clientes').delete().eq('id', clientId);
      if (error) throw error;
      toast.success('Cliente eliminado', { id: toastId });
      onBack();
    } catch (err) {
      console.error('[ClientView] deleteClient:', err);
      toast.error('Error al eliminar. Puede tener operaciones vinculadas.', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  }, [clientId, onBack]);

  const handleSendToExtension = () => {
    const fullData = { ...client };

    const nameField = edit.editFormData.find(f => f.id === 'nombre');
    if (nameField) {
      if (nameField._nombres) fullData.nombres = nameField._nombres.trim();
      if (nameField._apellidos) fullData.apellidos = nameField._apellidos.trim();
    }
    
    // Inject formularios data
    if (formularios && formularios.length > 0) {
      const mappingFijos = {
        'nombres': 'nombres',
        'apellidos': 'apellidos',
        'cpf': 'cpf',
        'rnm / protocolo anterior': 'rnm',
        'rnm': 'rnm',
        'género': 'sexo',
        'sexo': 'sexo',
        'fecha de nacimiento': 'fecha_nacimiento',
        'estado civil': 'estado_civil',
        'nacionalidad': 'nacionalidad',
        'profesión / ocupación': 'profesion',
        'profesión': 'profesion',
        'correo': 'email',
        'email': 'email',
        'teléfono': 'telefono',
        'celular': 'telefono'
      };

      formularios.forEach(form => {
        if (form.respuestas) {
          Object.keys(form.respuestas).forEach(key => {
            const cleanKey = key.toLowerCase().trim();
            const mappedKey = mappingFijos[cleanKey] || cleanKey;
            fullData[mappedKey] = form.respuestas[key];
          });
        }
      });
    }

    // Inject relatives data
    const relatives = relaciones.map(r => {
      if (String(r.cliente_id) === String(clientId)) {
         return { ...r.cliente_secundario, tipo_relacion: r.tipo_relacion };
      } else {
         return { ...r.cliente_principal, tipo_relacion: r.tipo_relacion };
      }
    }).filter(r => r && r.id);

    relatives.forEach(rel => {
      if (!rel.tipo_relacion) return;
      const prefix = rel.tipo_relacion.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, '_'); 
        
      Object.keys(rel).forEach(key => {
        if (key !== 'tipo_relacion' && key !== 'id') {
          fullData[`${prefix}_${key}`] = rel[key];
        }
      });
    });

    window.postMessage({ type: 'DASHBOARD_SYNC', clientData: fullData, activeClientRelatives: relatives }, '*');
    toast.success(`Datos de ${client.nombre} enviados a la extensión.`);
  };

  const handleMouseDownResizer = (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const startX = e.clientX;
    const startWidth = col3Ref.current ? col3Ref.current.offsetWidth : col3Width;

    const handleMouseMove = (moveEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.max(300, Math.min(startWidth + deltaX, 2500));
      if (col3Ref.current) {
        col3Ref.current.style.width = `${newWidth}px`;
      }
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (col3Ref.current) {
        setCol3Width(col3Ref.current.offsetWidth);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // ── Loading / Error / Empty guards ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header skeleton */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ height: 24, width: '40%', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ height: 16, width: '60%', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
        {/* Content skeletons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ height: 64, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite` }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {[1, 2].map(i => (
              <div key={i} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[1, 2, 3].map(j => (
                  <div key={j} style={{ height: 44, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', animation: `pulse 1.5s ease-in-out ${j * 0.1}s infinite` }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: 'var(--section-gap, 16px)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ maxWidth: '480px', padding: '1.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 0.5rem', color: 'var(--color-text-primary)' }}>No se pudieron cargar los datos del cliente</h2>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Intenta volver a cargar la vista o seleccionar otro cliente.</p>
          {clientDataError && (
            <p style={{ margin: '0.75rem 0 0', color: 'var(--color-danger, #ef4444)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
              {clientDataError.message || String(clientDataError)}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ padding: 'var(--section-gap, 16px)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ maxWidth: '480px', padding: '1.5rem', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 0.5rem', color: 'var(--color-text-primary)' }}>No hay datos disponibles</h2>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Selecciona otro cliente para ver su información.</p>
        </div>
      </div>
    );
  }

  const handleAnalyzeViewedDocument = async (doc) => {
    if (!doc?.url_archivo) return;
    const toastId = toast.loading('Analizando documento con IA...');
    try {
      let downloadUrl = doc.url_archivo;
      if (!downloadUrl.startsWith('http')) {
        const { getSignedUrl } = await import('../services/storageService');
        downloadUrl = await getSignedUrl(doc.url_archivo);
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Error al descargar archivo: HTTP ${response.status}`);
      }

      const blob = await response.blob();
      
      const textPreview = await blob.slice(0, 15).text();
      if (textPreview.toLowerCase().includes('<!doctype') || textPreview.toLowerCase().includes('<html')) {
        throw new Error(`¡El archivo descargado es HTML en vez de PDF! URL: ${downloadUrl}`);
      }

      const isPdf = doc.tipo_contenido === 'application/pdf';
      const file = new File([blob], isPdf ? 'documento.pdf' : 'imagen.jpg', { type: doc.tipo_contenido });

      let fileOrBase64 = file;
      if (isPdf) {
        const { convertPdfPageToImageBase64 } = await import('../services/pdfToImage');
        fileOrBase64 = await convertPdfPageToImageBase64(file);
      }

      const aiData = await analyzeDocumentImage(fileOrBase64);
      if (aiData && Object.keys(aiData).filter(k => aiData[k]).length > 0) {
        toast.dismiss(toastId);
        docs.setViewingDocument(null);

        // Auto-renombrar inmediatamente y añadir al estado
        const tipo = aiData.TIPO_DOCUMENTO || 'DOCUMENTO';
        const nombre = aiData.NOMBRE_COMPLETO || 'DESCONOCIDO';
        const newFileName = `${tipo} - ${nombre}`.toUpperCase();
        
        aiData.NOMBRE_ARCHIVO = newFileName;

        if (doc) {
          const isUuid = typeof doc.id === 'string' && doc.id.includes('-');
          const table = isUuid ? 'documentos_pendientes' : 'documentos_operacionales';
          supabase.from(table).update({ nombre_archivo: newFileName }).eq('id', doc.id).then(() => fetchClientData(true));
        }

        extraction.setExtractedData(aiData);
        extraction.setUploadedDocRecord(doc);
        extraction.setIsExtractionModalOpen(true);
      } else {
        toast.error('La IA no encontró datos extraíbles.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Error durante el análisis de IA.', { id: toastId });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 'var(--section-gap, 16px)', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="animate-fade-in">
      <ClientViewHeader
        client={client}
        duplicateContacts={duplicateContacts}
        setShowMergeModal={setShowMergeModal}
        handleDeleteClient={handleDeleteClient}
        isDeleting={isDeleting}
        isAiChatOpen={isAiChatOpen}
        setIsAiChatOpen={setIsAiChatOpen}
        handleSendToExtension={handleSendToExtension}
        openEditModal={edit.openEditModal}
        openSignatureModal={() => setIsSignatureModalOpen(true)}
        configCabecera={organization?.config_cabecera_cliente}
      />

      <div
        ref={scrollContainerRef}
        {...scrollHandlers}
        style={{ display: 'flex', gap: '1.5rem', flex: 1, overflowX: 'auto', overflowY: 'hidden', minHeight: 0, position: 'relative', paddingBottom: '0.5rem', cursor: 'grab' }}
      >
        {/* Columna 1: Datos del Cliente */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '0.5rem', height: '100%', minWidth: '380px', flex: 1.2, flexShrink: 0 }}>
          <ClientPersonalData
            client={client}
            onRelateClick={() => relations.setIsRelateModalOpen(true)}
            fixedFields={mergedFields}
            localSearchQuery={localSearchQuery}
            setLocalSearchQuery={setLocalSearchQuery}
            openEditModal={edit.openEditModal}
            handleCopy={handleCopy}
            copiedId={copiedId}
          />
          <ClientHistory clientId={clientId} />
        </div>

        {/* Columna 2: Trámites, Documentos, Relacionamientos, Kommo, Plantillas y Biblioteca */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '0.5rem', height: '100%', minWidth: '360px', flex: 1.5, flexShrink: 0 }}>
          <ClientViewTramites
            clientId={clientId}
            entradas={entradas}
            catalogoTramites={tramites.catalogoTramites}
            operariosList={tramites.operariosList}
            onCreateTramite={() => tramites.setIsNewTramiteModalOpen(true)}
            onUpdateEstado={tramites.handleChangeTramiteState}
            onUpdateServicio={tramites.handleChangeTramiteServicio}
            onUpdateOperario={tramites.handleChangeTramiteOperario}
            onUpdateDatos={tramites.handleChangeTramiteDatos}
            onDeleteTramite={tramites.handleDeleteTramite}
          />
          <ClientDocuments
            client={client}
            defaultExpanded={false}
            documentos={documentos}
            uploading={docs.uploading}
            isDragging={docs.isDragging}
            draggedDocument={docs.draggedDocument}
            handleDragOver={docs.handleDragOver}
            handleDragLeave={docs.handleDragLeave}
            handleDrop={docs.handleDrop}
            handleFileUpload={docs.handleFileUpload}
            setDraggedDocument={docs.setDraggedDocument}
            setDragOverRelId={docs.setDragOverRelId}
            setViewingDocument={docs.setViewingDocument}
            handleDeleteDocument={docs.handleDeleteDocument}
            stagedFile={docs.stagedFile}
            setStagedFile={docs.setStagedFile}
            handleConfirmUpload={docs.handleConfirmUpload}
            onRefresh={() => fetchClientData(true)}
          />
          <ClientRelations
            defaultExpanded={false}
            relaciones={relaciones}
            clientId={clientId}
            sourceClient={client}
            draggedDocument={docs.draggedDocument}
            dragOverRelId={docs.dragOverRelId}
            setDragOverRelId={docs.setDragOverRelId}
            handleCopyDocumentToClient={(doc, targetId) => extraction.handleCopyDocumentToClient(doc, targetId, docs.setDraggedDocument)}
            onNavigateToClient={onNavigateToClient}
            editingRelId={relations.editingRelId}
            setEditingRelId={relations.setEditingRelId}
            handleUpdateRelationType={relations.handleUpdateRelationType}
            handleDeleteRelation={relations.handleDeleteRelation}
            setSearchQuery={relations.setSearchQuery}
            setSelectedRelateId={relations.setSelectedRelateId}
            setIsRelateModalOpen={relations.setIsRelateModalOpen}
            handleOpenSyncModal={relations.handleOpenSyncModal}
          />
          
          <ClientForms
            clientId={clientId}
            client={client}
            formularios={formularios}
            onRefresh={() => fetchClientData(true)}
            onSendToExtension={handleSendToExtension}
            customFieldsConfig={customFieldsConfig}
          />
          <TemplateManager 
            defaultExpanded={false} 
            client={client} 
            entradas={entradas} 
            onGenerate={() => fetchClientData(true)} 
          />
          <Suspense fallback={<div>Cargando biblioteca...</div>}>
            <ClientMediaLibrary
              clientId={clientId}
              clientName={client.nombre}
              clientCpf={client.cpf}
            />
          </Suspense>
        </div>

        {/* Resizer Handle */}
        <div 
          onMouseDown={handleMouseDownResizer}
          style={{ width: '12px', cursor: 'col-resize', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', margin: '0 -0.35rem', zIndex: 10, flexShrink: 0, position: 'relative' }}
          className="hover:bg-brand-primary/30 transition-colors"
          title="Arrastra para ajustar el tamaño de la columna"
        >
           <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', gap: '2px' }}>
              <div style={{ width: '1px', height: '16px', backgroundColor: '#9CA3AF' }} />
              <div style={{ width: '1px', height: '16px', backgroundColor: '#9CA3AF' }} />
           </div>
        </div>

        {/* Columna 3: Comunicaciones */}
        <div ref={col3Ref} style={{ display: 'flex', flexDirection: 'column', gap: '0', overflowY: 'hidden', paddingRight: '0.5rem', height: '100%', width: `${col3Width}px`, flexShrink: 0 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--surface-base)', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
            <button 
              onClick={() => setActiveCommTab('whatsapp')}
              style={{ flex: 1, padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none',
                color: activeCommTab === 'whatsapp' ? 'var(--color-info)' : 'var(--color-text-secondary)', 
                borderBottom: activeCommTab === 'whatsapp' ? '2px solid var(--color-info)' : '2px solid transparent' 
              }}>
              WhatsApp
            </button>
            <button 
              onClick={() => setActiveCommTab('email')}
              style={{ flex: 1, padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none',
                color: activeCommTab === 'email' ? '#D93025' : 'var(--color-text-secondary)', 
                borderBottom: activeCommTab === 'email' ? '2px solid #D93025' : '2px solid transparent' 
              }}>
              Email (Gmail)
            </button>
          </div>
          
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface-base)', borderRadius: '0 0 12px 12px' }}>
            {activeCommTab === 'whatsapp' ? (
              <ClientWhatsApp clientId={clientId} telefono={client?.telefono} idKommo={client?.id_kommo} />
            ) : (
              <ClientEmail clientId={clientId} clientName={client?.nombre} clientEmail={client?.email} tramitesContext={entradas} />
            )}
          </div>
        </div>
      </div>

      {/* ── Modales ─────────────────────────────────────────────────────────── */}

      <DuplicateContactsWarning
        clientId={clientId}
        duplicateContacts={duplicateContacts}
        onMergeCompleteCallback={() => fetchClientData(true)}
        externalShowModal={showMergeModal}
        setExternalShowModal={setShowMergeModal}
        onNavigateToClient={onNavigateToClient}
      />

      <ClientViewAiChat
        isOpen={isAiChatOpen}
        onClose={() => setIsAiChatOpen(false)}
        messages={aiChatMessages}
        input={aiChatInput}
        onInputChange={setAiChatInput}
        onSend={handleSendAiMessage}
        isLoading={isAiChatLoading}
        crmContext={crmContext}
      />

      <Suspense fallback={null}>
        <ClientViewRelateModal
          isOpen={relations.isRelateModalOpen}
          onClose={() => {
            relations.setIsRelateModalOpen(false);
            relations.setSearchQuery('');
          }}
          searchQuery={relations.searchQuery}
          onSearchChange={relations.setSearchQuery}
          searchResults={relations.searchResults}
          allClientes={allClientes}
          selectedId={relations.selectedRelateId}
          onSelectId={relations.setSelectedRelateId}
          selectedType={relations.selectedRelateType}
          onSelectType={relations.setSelectedRelateType}
          onOpenNewClient={() => relations.setIsNewRelateClientModalOpen(true)}
          clientId={clientId}
          onRelate={relations.handleRelateClient}
        />

        <SyncDataModal
          isOpen={relations.isSyncModalOpen}
          onClose={() => relations.setIsSyncModalOpen(false)}
          sourceClient={client}
          targetClient={relations.syncTargetClient}
          onSync={relations.handleSyncData}
          isSyncing={relations.isSyncing}
        />

        {relations.isNewRelateClientModalOpen && (
          <NewClientWizard
            mode="quick"
            onClose={() => relations.setIsNewRelateClientModalOpen(false)}
            onClientCreated={(newClient) => {
              queryClient.setQueryData(['allClientesBase'], [newClient, ...allClientes]);
              relations.setSearchQuery('');
              relations.setSelectedRelateId(newClient.id);
              relations.setIsNewRelateClientModalOpen(false);
            }}
          />
        )}

        <ClientViewEditModal
          isOpen={edit.isEditModalOpen}
          onClose={() => edit.setIsEditModalOpen(false)}
          client={client}
          relaciones={relaciones}
          editFormData={edit.editFormData}
          onEditFormDataChange={edit.setEditFormData}
          newFields={edit.newFields}
          onNewFieldsChange={edit.setNewFields}
          onSaveEdits={edit.handleSaveEdits}
          isSaving={edit.isSaving}
          searchQuery={edit.editModalSearchQuery}
          onSearchChange={edit.setEditModalSearchQuery}
          fixedFieldsCatalog={mergedFields}
          handleCepSearch={edit.handleCepSearch}
          toIsoDate={toIsoDate}
          toSlashDate={toSlashDate}
          onCreateField={edit.handleCreateFieldDefinition}
        />

        <ClientViewExtractionModal
          isOpen={extraction.isExtractionModalOpen}
          extractedData={extraction.extractedData}
          cliente={extraction.extractionTargetClientData || client}
          uploadedDocRecord={extraction.uploadedDocRecord}
          onClose={extraction.closeExtractionModal}
          onExtractedDataChange={extraction.setExtractedData}
          onSave={extraction.handleSaveExtractedData}
          isSaving={extraction.isSaving}
          onNavigateToClient={onNavigateToClient}
        />

        <ClientViewNewTramiteModal
          isOpen={tramites.isNewTramiteModalOpen}
          onClose={() => tramites.setIsNewTramiteModalOpen(false)}
          catalogoTramites={tramites.catalogoTramites}
          operariosList={tramites.operariosList}
          servicio={tramites.newTramiteData.servicio}
          onServicioChange={(val) => tramites.setNewTramiteData(prev => ({ ...prev, servicio: val }))}
          operario={tramites.newTramiteData.operario}
          onOperarioChange={(val) => tramites.setNewTramiteData(prev => ({ ...prev, operario: val }))}
          onCreate={tramites.handleCreateTramite}
          isCreating={tramites.isCreatingTramite}
        />

        {isSignatureModalOpen && (
          <SignatureExtractorModal
            client={client}
            onClose={() => setIsSignatureModalOpen(false)}
            onSaved={(_doc) => {
              toast.success('Firma guardada en documentos');
              fetchClientData(true);
            }}
          />
        )}

        {docs.viewingDocument && (
          <DocumentViewerModal
            document={docs.viewingDocument}
            onClose={() => docs.setViewingDocument(null)}
            onAnalyze={handleAnalyzeViewedDocument}
          />
        )}
      </Suspense>

    </div>
  );
}
