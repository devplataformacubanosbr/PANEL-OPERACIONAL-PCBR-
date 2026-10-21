import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { getCliente } from '../services/clientesService';
import { reassignDocument } from '../services/storageService';
import { analyzeDocumentImage } from '../services/aiService';
import { resolvePersonAndApplyData } from '../services/clientExtractionService';

/**
 * GlobalIncomingDocumentListener
 * ─────────────────────────────────────────────────────────────────────────────
 * Escucha en tiempo real la llegada de nuevos documentos a `documentos_pendientes`
 * (enviados por clientes desde WhatsApp / Kommo).
 *
 * Flujo totalmente automático:
 * 1. Descarga el archivo de Storage (`whatsapp_media`).
 * 2. Lo analiza con IA de Visión (Groq).
 * 3. REGLA DE NO ALUCINACIÓN: Si la imagen está borrosa, fuera de foco o ilegible,
 *    la IA no inventa datos. Renombra el archivo como `⚠️ BORROSO - ...`, avisa
 *    al equipo y NO contamina la ficha del cliente con datos inventados.
 * 4. Si es legible y pertenece a un familiar: crea o vincula al familiar en
 *    `clientes` y `relaciones_clientes`, le transfiere el documento renombrado
 *    (`${TIPO} - ${NOMBRE}`) y autocompleta sus datos personales.
 * 5. Si pertenece al cliente titular: auto-renombra el documento y autocompleta
 *    los campos que aún falten en su ficha sin pisar datos ya verificados.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const GlobalIncomingDocumentListener = () => {
  const inFlightRef = useRef(new Set());

  useEffect(() => {
    console.log('[GlobalIncomingDocumentListener] Escuchando documentos entrantes de WhatsApp/Kommo...');

    const channel = supabase
      .channel('global_incoming_whatsapp_docs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'documentos_pendientes' },
        async (payload) => {
          const doc = payload.new;
          if (!doc || !doc.id || !doc.url_archivo || !doc.cliente_id) return;

          // Ignorar audios y notas de voz
          const tipoContenido = (doc.tipo_contenido || '').toLowerCase();
          if (tipoContenido.startsWith('audio/')) return;

          // Evitar procesar dos veces el mismo documento
          const lockKey = String(doc.id);
          if (inFlightRef.current.has(lockKey)) return;
          inFlightRef.current.add(lockKey);

          try {
            // Verificar si el documento es analizable (imagen o PDF)
            const nombre = (doc.nombre_archivo || '').toLowerCase();
            const isImage = tipoContenido.startsWith('image/') || nombre.endsWith('.jpg') || nombre.endsWith('.jpeg') || nombre.endsWith('.png') || nombre.endsWith('.webp');
            const isPdf = tipoContenido === 'application/pdf' || nombre.endsWith('.pdf');

            if (!isImage && !isPdf) return;

            // Descargar blob del storage
            let path = doc.url_archivo;
            if (path.startsWith('http')) {
              const parts = path.split('/whatsapp_media/');
              path = parts.length === 2 ? decodeURIComponent(parts[1].split('?')[0]) : null;
            }
            if (!path) return;

            const { data: blob, error: downloadError } = await supabase.storage.from('whatsapp_media').download(path);
            if (downloadError || !blob) {
              console.warn('[GlobalIncomingDocumentListener] No se pudo descargar el archivo:', downloadError?.message);
              return;
            }

            let fileOrBase64 = blob;
            if (isPdf) {
              const { convertPdfPageToImageBase64 } = await import('../services/pdfToImage');
              ({ base64: fileOrBase64 } = await convertPdfPageToImageBase64(blob));
            }

            // Analizar con IA de Visión (Groq) con prompts estrictos anti-alucinación
            const aiData = await analyzeDocumentImage(fileOrBase64);
            if (!aiData) return;

            // CASO A: Imagen borrosa o ilegible detectada
            if (aiData.DOCUMENTO_BORROSO === true || aiData.ILEGIBLE === true) {
              const motivo = aiData.MOTIVO_ILEGIBLE || 'Imagen borrosa o sin nitidez suficiente';
              const originalName = doc.nombre_archivo || 'Documento WhatsApp';
              const flaggedName = originalName.startsWith('⚠️ BORROSO - ') ? originalName : `⚠️ BORROSO - ${originalName}`;

              await supabase.from('documentos_pendientes').update({
                nombre_archivo: flaggedName
              }).eq('id', doc.id);

              toast.error(
                `⚠️ Documento de WhatsApp borroso o ilegible detectado (${motivo}). La IA no inventó datos. Solicita una nueva foto al cliente.`,
                { duration: 10000, icon: '🔍' }
              );

              try {
                await supabase.from('notificaciones_equipo').insert({
                  cliente_id: doc.cliente_id,
                  mensaje: `⚠️ Documento borroso recibido por WhatsApp para cliente #${doc.cliente_id}: ${motivo}. Solicitar reenvío nítido.`
                });
              } catch (_) {}

              window.dispatchEvent(new CustomEvent('documentProcessed', { detail: { documentId: doc.id, blurry: true } }));
              return;
            }

            // CASO B: Documento nítido con datos legibles
            const tieneDatos = Object.keys(aiData).filter(
              k => aiData[k] && !['DOCUMENTO_BORROSO', 'ILEGIBLE', 'MOTIVO_ILEGIBLE', 'TIPO_DOCUMENTO'].includes(k)
            ).length > 0;

            if (!tieneDatos) return;

            const currentCliente = await getCliente(doc.cliente_id);
            if (!currentCliente) return;

            const tipoDoc = aiData.TIPO_DOCUMENTO || 'DOCUMENTO';

            const { moved, targetClient, isNewClient, isBlurry } = await resolvePersonAndApplyData({
              currentCliente,
              extractedData: aiData,
              moveDocument: (targetId, newName) => reassignDocument(doc.id, targetId, newName),
            });

            if (isBlurry) {
              return;
            }

            if (moved) {
              toast.success(
                `🔀 Documento de WhatsApp "${tipoDoc}" de ${aiData.NOMBRE_COMPLETO || 'familiar'} detectado — ` +
                `${isNewClient ? 'se creó la ficha de' : 'se vinculó a'} ` +
                `"${targetClient.nombre}", se le pasó el documento y se completaron sus datos personales ✨`,
                { duration: 10000, icon: '🔀' }
              );
            } else {
              // Auto-renombrar el documento del titular para mantener orden
              const formattedName = `${tipoDoc.toUpperCase()} - ${(currentCliente.nombre || aiData.NOMBRE_COMPLETO || '').toUpperCase()}`;
              await supabase.from('documentos_pendientes').update({ nombre_archivo: formattedName }).eq('id', doc.id);

              toast.success(
                `✨ Documento de WhatsApp "${tipoDoc}" procesado automáticamente para ${currentCliente.nombre}`,
                { duration: 9000, icon: '📄' }
              );
            }

            // Notificar a componentes en pantalla para refrescar y evaluar PDF Único
            const finalClientId = targetClient?.id || currentCliente.id;
            window.dispatchEvent(new CustomEvent('documentProcessed', { detail: { documentId: doc.id, moved, targetClient, clientId: finalClientId } }));
            window.dispatchEvent(new CustomEvent('generatePdfUnicoCheck', { detail: { clientId: finalClientId } }));
            window.dispatchEvent(new CustomEvent('refreshClientData', { detail: { clientId: finalClientId } }));

          } catch (err) {
            console.error('[GlobalIncomingDocumentListener] Error procesando documento automático:', err);
          } finally {
            inFlightRef.current.delete(lockKey);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
};
