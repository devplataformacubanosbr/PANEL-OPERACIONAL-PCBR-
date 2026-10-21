import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { getCliente } from '../services/clientesService';
import { getDocuments, deleteDocument } from '../services/storageService';
import { getRequisitosTramite, getFastopAcciones } from '../services/tramitesService';
import { buildSlotsForRequirements, isValidForMerge } from '../services/documentMatcherService';

// Tipo con el que se marca un PDF Único generado automáticamente en borrador
export const BORRADOR_TIPO = 'PDF_UNICO_BORRADOR';

/**
 * GlobalDocumentoUnicoListener
 * ─────────────────────────────────────────────────────────────────────────────
 * Automatiza por completo la creación de los "PDFs Únicos":
 * 
 * 1. Escucha en tiempo real la llegada o clasificación de documentos desde:
 *    - WhatsApp / Kommo (`documentos_pendientes`).
 *    - Portal del Cliente (`documentos_operacionales` de la app).
 *    - Subidas manuales del operador o re-clasificación con IA (`organizeClientDocuments`).
 * 2. Cruza los documentos del cliente contra las variantes de PDF Único configuradas
 *    (tramites_catalogo.fastop_tipo = 'pdf_unico') usando coincidencia inteligente
 *    por tipos, nombres estandarizados y sinónimos migratorios.
 * 3. Si hay documentos disponibles, compila automáticamente el PDF Único:
 *    - Si faltan documentos, inserta páginas de aviso indicando con precisión qué falta.
 *    - Si ya existía un borrador pendiente y llegaron documentos nuevos más recientes,
 *      reemplaza el borrador obsoleto para que el operario siempre tenga la versión más completa.
 * 4. Guarda el resultado como `PDF_UNICO_BORRADOR` (estado 'pendiente') y emite un toast
 *    para que el operario lo revise y apruebe con un solo clic.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const GlobalDocumentoUnicoListener = () => {
  const inFlightRef = useRef(new Set());

  useEffect(() => {
    console.log('[GlobalDocumentoUnicoListener] Escuchando en tiempo real para generación automática de PDF Único...');

    const processClientQueue = async (rawClientId) => {
      const clienteId = Number(rawClientId);
      if (!clienteId || isNaN(clienteId)) return;

      const lockKey = String(clienteId);
      if (inFlightRef.current.has(lockKey)) return;
      inFlightRef.current.add(lockKey);

      try {
        await checkAndGenerateDrafts(clienteId);
      } catch (err) {
        console.error('[GlobalDocumentoUnicoListener] Error en checkAndGenerateDrafts:', err);
      } finally {
        // Pausa breve para evitar ráfagas si entran 3 documentos simultáneos
        setTimeout(() => {
          inFlightRef.current.delete(lockKey);
        }, 1500);
      }
    };

    // 1. Suscripción a documentos_operacionales (Portal y Dashboard)
    const channelOperacionales = supabase
      .channel('documento_unico_listener_operacionales')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documentos_operacionales' },
        async (payload) => {
          const doc = payload.new;
          if (!doc || !doc.id_cliente) return;

          // Ignorar eventos generados por el propio PDF Único para evitar bucles infinitos
          if (doc.tipo_documento === BORRADOR_TIPO) return;
          if ((doc.nombre_archivo || '').toUpperCase().startsWith('PDF UNICO')) return;
          if (doc.estado === 'rechazado') return;

          processClientQueue(doc.id_cliente);
        }
      )
      .subscribe();

    // 2. Suscripción a documentos_pendientes (WhatsApp / Kommo)
    const channelPendientes = supabase
      .channel('documento_unico_listener_pendientes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documentos_pendientes' },
        async (payload) => {
          const doc = payload.new;
          if (!doc || !doc.cliente_id) return;

          const name = (doc.nombre_archivo || '').toUpperCase();
          if (name.includes('BORROSO')) return;

          processClientQueue(doc.cliente_id);
        }
      )
      .subscribe();

    // 3. Escuchar eventos internos del navegador (tras IA organize o WhatsApp processing)
    const handleCheckEvent = (event) => {
      const clientId = event.detail?.clientId || event.detail?.targetClient?.id;
      if (clientId) {
        processClientQueue(clientId);
      }
    };

    window.addEventListener('generatePdfUnicoCheck', handleCheckEvent);
    window.addEventListener('documentProcessed', handleCheckEvent);

    return () => {
      supabase.removeChannel(channelOperacionales);
      supabase.removeChannel(channelPendientes);
      window.removeEventListener('generatePdfUnicoCheck', handleCheckEvent);
      window.removeEventListener('documentProcessed', handleCheckEvent);
    };
  }, []);

  return null;
};

/**
 * Revisa el expediente del cliente y genera o actualiza los borradores de PDF Único.
 * Puede ser invocada externamente tras subir o reordenar documentos.
 * @param {number|string} clienteId 
 */
export async function checkAndGenerateDrafts(clienteId) {
  const [cliente, acciones, docs] = await Promise.all([
    getCliente(clienteId),
    getFastopAcciones('pdf_unico'),
    getDocuments(clienteId),
  ]);

  if (!cliente || !acciones || acciones.length === 0) return;
  const mergeableDocs = (docs || []).filter(isValidForMerge);
  if (mergeableDocs.length === 0) return;

  for (const accion of acciones) {
    const requisitos = await getRequisitosTramite(accion.id);
    if (!requisitos || requisitos.length === 0) continue;

    const obligatorios = requisitos.filter(r => r.obligatorio);

    // Armar slots utilizando el motor de coincidencia inteligente
    const slots = buildSlotsForRequirements(requisitos, mergeableDocs);
    const matchedSlots = slots.filter(s => !!s.doc);

    // Si ningún documento coincide con este trámite, no generar borrador
    if (matchedSlots.length === 0) continue;

    const isComplete = obligatorios.length > 0 && obligatorios.every(req => {
      const slot = slots.find(s => s.req.id === req.id);
      return !!slot?.doc;
    });

    const cityLabel = (accion.nombre || '').replace(/^PDF Únicos?\s*/i, '').trim();
    const draftBaseName = `PDF UNICO BORRADOR${cityLabel ? ' ' + cityLabel.toUpperCase() : ''} - ${(cliente.nombre || 'CLIENTE').toUpperCase()}`;
    const filename = `${draftBaseName.replace(/[^a-zA-Z0-9.\-_ ]/g, '')}.pdf`;

    // Buscar si ya existe un borrador de esta variante esperando aprobación
    const existingDraft = docs.find(d =>
      d.tipo_documento === BORRADOR_TIPO &&
      d.estado === 'pendiente' &&
      d.nombre_archivo === filename
    );

    if (existingDraft) {
      // Verificar la fecha del documento coincidente más reciente
      const latestMatchedDate = Math.max(
        ...matchedSlots.map(s => new Date(s.doc?.creado_en || 0).getTime())
      );
      const draftDate = new Date(existingDraft.creado_en || 0).getTime();

      // Si el borrador existente es más reciente o igual que los documentos que entraron,
      // ya está actualizado: no duplicar.
      if (draftDate >= latestMatchedDate) {
        continue;
      }

      // Si entraron documentos nuevos después del borrador, eliminar el borrador viejo
      // para reemplazarlo con la versión fresca y actualizada.
      try {
        await deleteDocument(existingDraft);
      } catch (e) {
        console.warn('[GlobalDocumentoUnicoListener] No se pudo borrar borrador previo:', e);
      }
    }

    try {
      const { mergeDocumentsToPdfWithGaps } = await import('../services/pdfMergerService');
      const { blob: mergedBlob, missing } = await mergeDocumentsToPdfWithGaps(slots);

      const { uploadGeneratedDocumentToClient } = await import('../services/templateService');
      await uploadGeneratedDocumentToClient(mergedBlob, filename, cliente, {
        estado: 'pendiente',
        tipoDocumento: BORRADOR_TIPO,
        subidoPor: 'Automático (IA)',
        silent: true,
      });

      const estadoLabel = isComplete ? 'completo' : `incompleto — falta: ${missing.join(', ')}`;
      toast.success(
        `PDF Único (${estadoLabel}) listo para revisar — ${cliente.nombre} · ${accion.nombre}`,
        {
          duration: 9000,
          icon: isComplete ? '🤖' : '⚠️',
        }
      );

      // Notificar a componentes en pantalla para refrescar la lista de documentos
      window.dispatchEvent(new CustomEvent('refreshClientData', { detail: { clientId } }));
    } catch (err) {
      console.error(`[GlobalDocumentoUnicoListener] Error generando borrador para cliente ${clienteId} / acción ${accion.id}:`, err);
    }
  }
}
