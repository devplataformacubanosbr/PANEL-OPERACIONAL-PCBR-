/**
 * useClientViewExtraction.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Encapsula la lógica de extracción IA de documentos: estado del modal,
 * datos extraídos, guardado en tabla `clientes`, y la copia de documentos
 * a clientes relacionados (que dispara análisis IA sobre el documento copiado).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { analyzeDocumentImage } from '../services/aiService';
import { normalizeDateToDDMMYYYY } from '../utils/dateFormatter';
import { toIsoDate } from '../components/clientView.constants';

/** Mapeo de claves IA → columnas de la tabla `clientes` */
const AI_FIELD_MAP = {
  'NOMBRE_COMPLETO': 'nombre',
  'CPF': 'cpf',
  'RNM': 'rnm',
  'CARNET_IDENTIDAD': 'carnet_identidad',
  'FECHA_NACIMIENTO': 'fecha_nacimiento',
  'LUGAR_NACIMIENTO': 'lugar_nacimiento',
  'NACIONALIDAD': 'nacionalidad',
  'NUMERO_DOCUMENTO': 'numero_pasaporte',
  'NUMERO_REFUGIO': 'numero_refugio',
  'FECHA_EMISION_PASAPORTE': 'fecha_emision_pasaporte',
  'FECHA_VENCIMIENTO_PASAPORTE': 'fecha_vencimiento_pasaporte',
  'FECHA_VENCIMIENTO_REFUGIO': 'fecha_vencimiento_refugio',
  'SEXO': 'sexo',
  'NOMBRE_MADRE': 'nombre_madre',
  'NOMBRE_PADRE': 'nombre_padre',
};

/** Claves de la IA que contienen fechas (para normalizar a DD/MM/YYYY) */
const AI_DATE_KEYS = new Set([
  'FECHA_NACIMIENTO',
  'FECHA_EMISION_PASAPORTE',
  'FECHA_VENCIMIENTO_PASAPORTE',
  'FECHA_VENCIMIENTO_REFUGIO',
]);

export default function useClientViewExtraction({ clientId, fetchClientData, client }) {
  // Extraction modal state
  const [extractedData, setExtractedData] = useState(null);
  const [isExtractionModalOpen, setIsExtractionModalOpen] = useState(false);
  const [extractionTargetClientId, setExtractionTargetClientId] = useState(null);
  const [extractionTargetClientData, setExtractionTargetClientData] = useState(null);
  const [uploadedDocRecord, setUploadedDocRecord] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Save extracted data to `clientes` table ────────────────────────────────
  const handleSaveExtractedData = async () => {
    setIsSaving(true);
    try {
      const updates = {};

      for (const [key, value] of Object.entries(extractedData)) {
        if (!value) continue;
        const upperKey = key.toUpperCase();

        const mappedCol = AI_FIELD_MAP[upperKey];
        if (mappedCol) {
          // Normalize dates to YYYY-MM-DD, uppercase everything else
          let finalValue;
          if (AI_DATE_KEYS.has(upperKey)) {
            const normalized = normalizeDateToDDMMYYYY(value);
            finalValue = normalized ? toIsoDate(normalized) : String(value).toUpperCase();
          } else {
            finalValue = String(value).toUpperCase();
          }

          updates[mappedCol] = finalValue;
        }
      }

      if (Object.keys(updates).length > 0) {
        const targetId = extractionTargetClientId || clientId;
        await supabase.from('clientes').update(updates).eq('id', targetId);
      }

      if (uploadedDocRecord && extractedData.NOMBRE_ARCHIVO) {
        const newFileName = extractedData.NOMBRE_ARCHIVO.trim().toUpperCase();
        
        const isUuid = typeof uploadedDocRecord.id === 'string' && uploadedDocRecord.id.includes('-');
        const table = isUuid ? 'documentos_pendientes' : 'documentos_operacionales';
        await supabase.from(table).update({ nombre_archivo: newFileName }).eq('id', uploadedDocRecord.id);
      }

      await fetchClientData();
      setIsExtractionModalOpen(false);
      setExtractionTargetClientId(null);
      setExtractionTargetClientData(null);
    } catch (err) {
      console.error('[useClientViewExtraction] Error saving extracted data:', err);
      alert('Error guardando los datos extraídos.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Copy document to a related client + run AI analysis ────────────────────
  const handleCopyDocumentToClient = useCallback(async (doc, targetClientId, setDraggedDocument) => {
    if (!doc || !targetClientId || targetClientId === clientId) return;

    try {
      // Fetch the source document to get its URL
      const { data: sourceDoc } = await supabase
        .from('documentos_operacionales')
        .select('*')
        .eq('id', doc.id)
        .single();

      if (!sourceDoc) {
        alert('Error: Documento no encontrado en la base de datos.');
        return;
      }

      // Update the document record to move it to the target client
      const { data: newDoc, error } = await supabase
        .from('documentos_operacionales')
        .update({
          id_cliente: targetClientId,
          estado: 'pendiente'
        })
        .eq('id', doc.id)
        .select()
        .single();

      if (error) {
        alert(`Error al mover el documento: ${error.message}`);
        return;
      }

      alert('Documento movido al cliente relacionado exitosamente.');
      if (setDraggedDocument) setDraggedDocument(null);

      // If the document is an image or PDF, run AI analysis targeting the related client
      if (sourceDoc.tipo_contenido.startsWith('image/') || sourceDoc.tipo_contenido === 'application/pdf') {
        const toastId = toast.loading('Analizando documento para el cliente relacionado...');
        try {
          const { data: targetClient } = await supabase.from('clientes').select('*').eq('id', targetClientId).single();

          let downloadUrl = sourceDoc.url_archivo;
          if (!downloadUrl.startsWith('http')) {
            const { getSignedUrl } = await import('../services/storageService');
            downloadUrl = await getSignedUrl(sourceDoc.url_archivo);
          }

          const response = await fetch(downloadUrl);
          if (!response.ok) {
            throw new Error(`Error al descargar archivo: HTTP ${response.status}`);
          }
          
          const blob = await response.blob();
          
          // Verificar si realmente es un HTML mirando su contenido real
          const textPreview = await blob.slice(0, 15).text();
          if (textPreview.toLowerCase().includes('<!doctype') || textPreview.toLowerCase().includes('<html')) {
            throw new Error(`¡El archivo descargado es una página web (HTML) en lugar de un PDF! Esto significa que la URL está redirigiendo a la aplicación en lugar del archivo real. URL intentada: ${downloadUrl}`);
          }

          const isPdf = sourceDoc.tipo_contenido === 'application/pdf';
          const file = new File([blob], isPdf ? 'documento.pdf' : 'imagen.jpg', { type: sourceDoc.tipo_contenido });

          let fileOrBase64 = file;
          if (isPdf) {
            const { convertPdfPageToImageBase64 } = await import('../services/pdfToImage');
            fileOrBase64 = await convertPdfPageToImageBase64(file);
          }

          const aiData = await analyzeDocumentImage(fileOrBase64);
          if (aiData && Object.keys(aiData).filter(k => aiData[k]).length > 0) {
            toast.dismiss(toastId);

            // Auto-renombrar inmediatamente y añadir al estado
            const tipo = aiData.TIPO_DOCUMENTO || 'DOCUMENTO';
            const nombre = aiData.NOMBRE_COMPLETO || 'DESCONOCIDO';
            const newFileName = `${tipo} - ${nombre}`.toUpperCase();
            
            aiData.NOMBRE_ARCHIVO = newFileName;

            if (newDoc) {
              const isUuid = typeof newDoc.id === 'string' && newDoc.id.includes('-');
              const table = isUuid ? 'documentos_pendientes' : 'documentos_operacionales';
              supabase.from(table).update({ nombre_archivo: newFileName }).eq('id', newDoc.id).then(() => {
                if (typeof fetchClientData === 'function') fetchClientData(true);
              });
            }

            setExtractedData(aiData);
            setExtractionTargetClientId(targetClientId);
            setExtractionTargetClientData(targetClient);
            setUploadedDocRecord(newDoc);
            setIsExtractionModalOpen(true);
          } else {
            toast.error('La IA no encontró datos extraíbles.', { id: toastId });
          }
        } catch (aiErr) {
          console.warn('[useClientViewExtraction] AI copy analysis error:', aiErr.message);
          toast.error('Error durante el análisis de IA.', { id: toastId });
        }
      }

    } catch (err) {
      console.error('[useClientViewExtraction] Error copying document:', err);
      alert('Error al copiar el documento. Verifica la consola.');
    }
  }, [clientId]);

  // ── Close / reset extraction modal ─────────────────────────────────────────
  const closeExtractionModal = useCallback((shouldRefresh = false) => {
    setIsExtractionModalOpen(false);
    setExtractionTargetClientId(null);
    setExtractionTargetClientData(null);
    if (shouldRefresh === true && typeof fetchClientData === 'function') {
      fetchClientData(true);
    }
  }, [fetchClientData]);

  return {
    // State
    extractedData,
    setExtractedData,
    isExtractionModalOpen,
    setIsExtractionModalOpen,
    extractionTargetClientId,
    extractionTargetClientData,
    uploadedDocRecord,
    setUploadedDocRecord,
    isSaving,
    // Handlers
    handleSaveExtractedData,
    handleCopyDocumentToClient,
    closeExtractionModal,
  };
}
