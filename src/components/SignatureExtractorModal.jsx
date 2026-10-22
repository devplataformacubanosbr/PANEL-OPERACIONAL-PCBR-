import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Upload,
  Scissors,
  Edit2,
  Loader2,
  Save,
  Trash2,
  CheckCircle,
  Sparkles,
  FileText,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Sliders,
  Palette
} from 'lucide-react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import { getSignedUrl, uploadDocument } from '../services/storageService';
import { detectSignatureBoundingBox } from '../services/aiService';
import { convertPdfPageToImageBase64 } from '../services/pdfToImage';
import {
  processSignatureImage,
  PASSPORT_SIGNATURE_PRESETS,
  INK_COLOR_OPTIONS
} from '../utils/signatureExtractor';

export default function SignatureExtractorModal({ client, documents = [], initialDocument = null, onClose, onSaved }) {
  // ── Document Selection & Source State ─────────────────────────────────────────
  const [documentsList, setDocumentsList] = useState(documents || []);
  const [selectedDocId, setSelectedDocId] = useState(initialDocument?.id || null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [docSourceType, setDocSourceType] = useState('existing'); // 'existing' | 'upload'
  
  // PDF state
  const [isPdf, setIsPdf] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(1);
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState(null);

  // Image & Crop State
  const [src, setSrc] = useState(null);
  const [crop, setCrop] = useState(null);
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  // AI & Processing State
  const [detectingAi, setDetectingAi] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processedBase64, setProcessedBase64] = useState(null);
  const [processedDimensions, setProcessedDimensions] = useState({ width: 0, height: 0 });
  const [saving, setSaving] = useState(false);

  // Settings
  const [threshold, setThreshold] = useState(155);
  const [invert, setInvert] = useState(false);
  const [inkColor, setInkColor] = useState('#0033aa'); // Caneta Azul Bic por defecto
  const [enhanceThinLines, setEnhanceThinLines] = useState(true);
  const [autoTrim, setAutoTrim] = useState(true);
  const [error, setError] = useState(null);

  // ── 1. Cargar documentos del cliente si no vinieron por props ──────────────────
  useEffect(() => {
    if (documents && documents.length > 0) {
      setDocumentsList(documents);
      return;
    }
    if (!client?.id) return;

    supabase
      .from('documentos_operacionales')
      .select('*')
      .eq('id_cliente', client.id)
      .neq('estado', 'descartado')
      .order('creado_en', { ascending: false })
      .then(({ data, error: err }) => {
        if (!err && data) {
          setDocumentsList(data);
        }
      });
  }, [client?.id, documents]);

  // ── 2. Seleccionar automáticamente el pasaporte o documento inicial ───────────
  useEffect(() => {
    if (initialDocument) {
      setSelectedDocId(initialDocument.id);
      loadDocumentSource(initialDocument);
      return;
    }

    if (documentsList.length > 0 && !selectedDocId && docSourceType === 'existing') {
      // Priorizar PASAPORTE, luego CARNET, luego RNM o cualquier documento
      const passportDoc = documentsList.find(d => 
        d.tipo_documento?.toUpperCase().includes('PASAPORTE') ||
        (d.nombre_archivo && /pasaporte|passport|pass/i.test(d.nombre_archivo))
      ) || documentsList.find(d =>
        d.tipo_documento?.toUpperCase().includes('CARNET') ||
        d.tipo_documento?.toUpperCase().includes('RNM') ||
        (d.nombre_archivo && /carnet|ci_|rnm|cie/i.test(d.nombre_archivo))
      ) || documentsList[0];

      if (passportDoc) {
        setSelectedDocId(passportDoc.id);
        loadDocumentSource(passportDoc);
      }
    }
  }, [documentsList, initialDocument]);

  // ── 3. Helper para cargar un documento de Supabase (Imagen o PDF) ────────────
  const loadDocumentSource = useCallback(async (doc) => {
    if (!doc) return;
    setLoadingDoc(true);
    setError(null);
    setProcessedBase64(null);
    setCrop(null);
    setCompletedCrop(null);

    try {
      const url = await getSignedUrl(doc.url_archivo);
      if (!url) throw new Error('No se pudo generar la URL segura del documento.');

      const isDocPdf = doc.tipo_contenido === 'application/pdf' || 
                       url.toLowerCase().split('?')[0].endsWith('.pdf') ||
                       (doc.nombre_archivo && doc.nombre_archivo.toLowerCase().endsWith('.pdf'));

      setIsPdf(isDocPdf);

      if (isDocPdf) {
        // Descargar PDF como ArrayBuffer y renderizar página 1
        const res = await fetch(url);
        const buffer = await res.arrayBuffer();
        setPdfArrayBuffer(buffer);
        setPdfPage(1);

        const { base64, totalPages } = await convertPdfPageToImageBase64(buffer, 1, 2.5);
        setPdfTotalPages(totalPages || 1);
        setSrc(base64);
      } else {
        setPdfArrayBuffer(null);
        setSrc(url);
      }
    } catch (err) {
      console.error('[SignatureExtractor] Error cargando documento:', err);
      setError(`No se pudo cargar "${doc.nombre_archivo}": ${err.message}`);
    } finally {
      setLoadingDoc(false);
    }
  }, []);

  // ── 4. Cambiar de página si el pasaporte es un PDF multipágina ─────────────────
  const handleChangePdfPage = async (newPage) => {
    if (!pdfArrayBuffer || newPage < 1 || newPage > pdfTotalPages) return;
    setLoadingDoc(true);
    setPdfPage(newPage);
    setProcessedBase64(null);
    try {
      const { base64 } = await convertPdfPageToImageBase64(pdfArrayBuffer, newPage, 2.5);
      setSrc(base64);
    } catch (err) {
      toast.error('Error al renderizar página del PDF');
    } finally {
      setLoadingDoc(false);
    }
  };

  // ── 5. Carga manual de archivo (File Picker) ──────────────────────────────────
  const handleSelectLocalFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedDocId('upload');
      setDocSourceType('upload');
      setCrop(null);
      setCompletedCrop(null);
      setProcessedBase64(null);
      setError(null);

      const isFilePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      setIsPdf(isFilePdf);

      if (isFilePdf) {
        setLoadingDoc(true);
        file.arrayBuffer().then(async (buffer) => {
          setPdfArrayBuffer(buffer);
          setPdfPage(1);
          const { base64, totalPages } = await convertPdfPageToImageBase64(buffer, 1, 2.5);
          setPdfTotalPages(totalPages || 1);
          setSrc(base64);
          setLoadingDoc(false);
        }).catch(err => {
          setError('Error al procesar el archivo PDF: ' + err.message);
          setLoadingDoc(false);
        });
      } else {
        const reader = new FileReader();
        reader.addEventListener('load', () => setSrc(reader.result));
        reader.readAsDataURL(file);
      }
    }
  };

  // ── 6. Soporte para Pegar desde Portapapeles (Ctrl+V) ─────────────────────────
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            setSelectedDocId('upload');
            setDocSourceType('upload');
            setIsPdf(false);
            setCrop(null);
            setCompletedCrop(null);
            setProcessedBase64(null);
            setError(null);

            const reader = new FileReader();
            reader.onload = () => {
              setSrc(reader.result);
              toast.success('Imagen pegada desde el portapapeles');
            };
            reader.readAsDataURL(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // ── 7. Al cargar la imagen en pantalla: aplicar preset por defecto ─────────────
  const onImageLoad = (e) => {
    imgRef.current = e.currentTarget;
    // Si no tiene recorte aún, pre-ubicar en la posición habitual de pasaporte cubano
    if (!crop) {
      applyPreset('pasaporte_cubano');
    }
  };

  // ── 8. Aplicar Preset Geométrico (Pasaporte, Carnet, RNM) ──────────────────────
  const applyPreset = (presetId) => {
    const preset = PASSPORT_SIGNATURE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    setCrop(preset.crop);
    if (imgRef.current) {
      const img = imgRef.current;
      setCompletedCrop({
        unit: 'px',
        x: (preset.crop.x / 100) * img.width,
        y: (preset.crop.y / 100) * img.height,
        width: (preset.crop.width / 100) * img.width,
        height: (preset.crop.height / 100) * img.height
      });
    }
    toast.success(`Preset aplicado: ${preset.label}`, { duration: 1800 });
  };

  // ── 9. Auto-Detectar Firma con IA (Groq Vision) ──────────────────────────────
  const handleDetectSignatureWithAi = async () => {
    if (!src || !imgRef.current) return;
    setDetectingAi(true);
    setError(null);

    try {
      const result = await detectSignatureBoundingBox(src);

      if (result && result.found && typeof result.x === 'number') {
        const aiCrop = {
          unit: '%',
          x: result.x,
          y: result.y,
          width: result.width,
          height: result.height
        };
        setCrop(aiCrop);

        const img = imgRef.current;
        setCompletedCrop({
          unit: 'px',
          x: (aiCrop.x / 100) * img.width,
          y: (aiCrop.y / 100) * img.height,
          width: (aiCrop.width / 100) * img.width,
          height: (aiCrop.height / 100) * img.height
        });

        if (result.fallback) {
          toast('Firma ubicada según el formato estándar de Pasaporte Cubano', { icon: 'ℹ️' });
        } else {
          toast.success('¡Firma detectada con IA con éxito! ✨', { icon: '✨' });
        }
      } else {
        toast.error('No se pudo localizar automáticamente. Ajusta el recuadro manualmente.');
      }
    } catch (err) {
      console.error('[SignatureExtractor] Error en detección IA:', err);
      toast.error('Error al detectar con IA: ' + err.message);
    } finally {
      setDetectingAi(false);
    }
  };

  // ── 10. Procesar y Extraer la Firma (Caneta Azul + Fondo Transparente) ─────────
  const extractSignature = () => {
    if (!completedCrop || !imgRef.current) return;
    setProcessing(true);
    setError(null);

    setTimeout(() => {
      try {
        const result = processSignatureImage(imgRef.current, completedCrop, {
          threshold,
          invert,
          inkColor,
          enhanceThinLines,
          autoTrim
        });

        if (!result) {
          throw new Error('No se pudo procesar el área seleccionada.');
        }

        if (result.isEmpty) {
          toast('No se detectó suficiente tinta en el recuadro. Prueba aumentando la sensibilidad.', { icon: '⚠️' });
        }

        setProcessedBase64(result.base64);
        setProcessedDimensions({ width: result.width, height: result.height });
      } catch (err) {
        console.error(err);
        setError('Error al procesar la firma: ' + err.message);
      } finally {
        setProcessing(false);
      }
    }, 120);
  };

  // ── 11. Guardar la Firma Extraída en Documentos del Cliente ───────────────────
  const handleSave = async () => {
    if (!processedBase64) return;
    setSaving(true);
    setError(null);

    try {
      // 1. Convertir Base64 a File Blob
      const res = await fetch(processedBase64);
      const blob = await res.blob();
      const safeName = (client?.nombre || 'cliente').replace(/\s+/g, '_').toLowerCase();
      const fileName = `firma_${safeName}_${Date.now().toString().slice(-4)}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // 2. Subir a Supabase Storage como FIRMA_DIGITAL
      const response = await uploadDocument(file, client.id, `Firma Digital - ${client.nombre}`, 'FIRMA_DIGITAL');
      if (response.error) throw new Error(response.error);

      // 3. Sincronizar en campos_personalizados del cliente para acceso rápido
      const currentCampos = client.campos_personalizados && typeof client.campos_personalizados === 'object'
        ? client.campos_personalizados
        : {};

      await supabase
        .from('clientes')
        .update({
          campos_personalizados: {
            ...currentCampos,
            firma_digital_url: response.data.url_archivo,
            tiene_firma_digital: true,
            ultima_extraccion_firma: new Date().toISOString()
          }
        })
        .eq('id', client.id);

      if (onSaved) onSaved(response.data);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Error al guardar la firma: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(5, 10, 20, 0.78)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'var(--color-bg-base, #1e293b)', width: '100%', maxWidth: '1060px', maxHeight: '92vh',
        borderRadius: 'var(--radius-lg, 12px)', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        overflow: 'hidden', animation: 'scaleIn 0.2s ease-out'
      }}>
        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div style={{
          padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.08))',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--color-bg-elevated, #0f172a)', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,85,255,0.2), rgba(124,58,237,0.2))',
              color: '#3b82f6', padding: '9px', borderRadius: '10px', border: '1px solid rgba(59,130,246,0.3)'
            }}>
              <Edit2 size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Extractor de Firma del Pasaporte
                <span style={{
                  fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px',
                  background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)'
                }}>
                  Caneta Azul Digital
                </span>
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted, #94a3b8)' }}>
                Cliente: <strong style={{ color: 'var(--color-text-primary, #f8fafc)' }}>{client?.nombre}</strong>
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.5rem', borderRadius: '8px' }}>
            <X size={20} />
          </button>
        </div>

        {/* ── BARRA DE SELECCIÓN DE DOCUMENTO ───────────────────────────────── */}
        <div style={{
          padding: '0.75rem 1.5rem',
          background: 'rgba(15, 23, 42, 0.65)',
          borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.06))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.85rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '280px' }}>
            <FileText size={16} color="#3b82f6" />
            <span style={{ fontWeight: 500, color: 'var(--color-text-secondary, #cbd5e1)' }}>Origen:</span>
            
            <select
              value={selectedDocId || 'upload'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'upload') {
                  setSelectedDocId('upload');
                  setDocSourceType('upload');
                  setSrc(null);
                  setProcessedBase64(null);
                } else {
                  setSelectedDocId(val);
                  setDocSourceType('existing');
                  const doc = documentsList.find(d => String(d.id) === String(val));
                  if (doc) loadDocumentSource(doc);
                }
              }}
              style={{
                background: 'var(--color-bg-base, #1e293b)',
                color: 'var(--color-text-primary, #f8fafc)',
                border: '1px solid var(--color-border, rgba(255,255,255,0.15))',
                borderRadius: '6px',
                padding: '0.35rem 0.65rem',
                fontSize: '0.85rem',
                flex: 1,
                maxWidth: '420px',
                outline: 'none'
              }}
            >
              {documentsList.length > 0 && (
                <optgroup label="Documentos del Cliente">
                  {documentsList.map(doc => {
                    const isPassport = /pasaporte|passport/i.test(doc.tipo_documento || '') || /pasaporte|passport/i.test(doc.nombre_archivo || '');
                    return (
                      <option key={doc.id} value={doc.id}>
                        {isPassport ? '📘 Pasaporte: ' : '📄 '} {doc.nombre_archivo} ({doc.tipo_documento || 'DOC'})
                      </option>
                    );
                  })}
                </optgroup>
              )}
              <optgroup label="Carga Externa">
                <option value="upload">📤 Subir imagen o PDF / Pegar captura (Ctrl+V)</option>
              </optgroup>
            </select>
          </div>

          {/* Selector de páginas si es PDF */}
          {isPdf && pdfTotalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '6px' }}>
              <button
                className="btn btn-ghost"
                style={{ padding: '3px', height: 'auto' }}
                disabled={pdfPage <= 1 || loadingDoc}
                onClick={() => handleChangePdfPage(pdfPage - 1)}
                title="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Página <strong style={{ color: '#fff' }}>{pdfPage}</strong> de {pdfTotalPages}
              </span>
              <button
                className="btn btn-ghost"
                style={{ padding: '3px', height: 'auto' }}
                disabled={pdfPage >= pdfTotalPages || loadingDoc}
                onClick={() => handleChangePdfPage(pdfPage + 1)}
                title="Página siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => document.getElementById('sig-modal-upload-input').click()}
              className="btn btn-ghost"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', display: 'flex', gap: '4px', alignItems: 'center' }}
            >
              <Upload size={14} /> Subir archivo
            </button>
            <input
              id="sig-modal-upload-input"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleSelectLocalFile}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* ── CONTENIDO PRINCIPAL ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={{
              padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)', color: '#f87171',
              borderRadius: '8px', fontSize: '0.85rem'
            }}>
              {error}
            </div>
          )}

          {loadingDoc ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '380px', gap: '1rem', color: 'var(--color-text-muted, #94a3b8)'
            }}>
              <Loader2 className="animate-spin" size={36} color="#3b82f6" />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Cargando y procesando página del pasaporte...</p>
            </div>
          ) : !src ? (
            /* Vista sin imagen seleccionada */
            <div
              style={{
                border: '2px dashed var(--color-border, rgba(255,255,255,0.15))',
                borderRadius: '12px',
                padding: '4rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s'
              }}
              onClick={() => document.getElementById('sig-modal-upload-input').click()}
            >
              <Upload size={48} style={{ margin: '0 auto 1rem', color: '#64748b' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.4rem', color: '#f8fafc' }}>
                Selecciona el Pasaporte o Sube una Foto de la Firma
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: '480px', margin: '0 auto 1rem' }}>
                Puedes seleccionar un pasaporte ya subido en el selector superior, arrastrar un archivo JPG/PNG/PDF, o presionar <strong>Ctrl+V</strong> para pegar una captura.
              </p>
              <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', padding: '6px 14px', borderRadius: '20px', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontSize: '0.8rem' }}>
                <Clipboard size={14} /> Atajo: Pega cualquier captura con Ctrl+V
              </div>
            </div>
          ) : !processedBase64 ? (
            /* Vista de Recorte y Controles */
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', minHeight: '440px' }}>
              {/* Columna Izquierda: Visor del Pasaporte con Recorte */}
              <div style={{
                flex: '1 1 540px',
                background: '#090d16',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                {/* Barra de herramientas sobre la imagen */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleDetectSignatureWithAi}
                    disabled={detectingAi}
                    className="btn btn-secondary"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))',
                      borderColor: 'rgba(59,130,246,0.4)',
                      color: '#60a5fa',
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Usa IA para localizar automáticamente el recuadro de la firma manuscrita"
                  >
                    {detectingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {detectingAi ? 'Detectando con IA...' : 'Detectar con IA ✨'}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Presets:</span>
                    <button
                      type="button"
                      onClick={() => applyPreset('pasaporte_cubano')}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}
                      title="Preset para Pasaporte Cubano estándar (bajo la foto a la izquierda)"
                    >
                      🇨🇺 Pasaporte
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('carnet_identidad')}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}
                      title="Preset para Carnet de Identidad"
                    >
                      🪪 Carnet
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('rnm_brasil')}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}
                      title="Preset para RNM de Brasil"
                    >
                      🇧🇷 RNM
                    </button>
                  </div>
                </div>

                {/* Contenedor ReactCrop */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'auto',
                  background: '#040711',
                  borderRadius: '6px',
                  minHeight: '360px',
                  maxHeight: '520px',
                  padding: '4px'
                }}>
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    style={{ maxHeight: '100%', maxWidth: '100%' }}
                  >
                    <img
                      ref={imgRef}
                      src={src}
                      alt="Documento pasaporte"
                      onLoad={onImageLoad}
                      crossOrigin="anonymous"
                      style={{ maxHeight: '500px', width: 'auto', objectFit: 'contain', display: 'block' }}
                    />
                  </ReactCrop>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Arrastra y ajusta el recuadro sobre la firma</span>
                  {completedCrop && (
                    <span>Recorte: {Math.round(completedCrop.width)} × {Math.round(completedCrop.height)} px</span>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Controles de Estudio y Color */}
              <div style={{
                flex: '1 1 320px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                padding: '1.25rem'
              }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.35rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Palette size={16} color="#3b82f6" />
                    Color de Tinta Oficial
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                    La Policía Federal y cartórios requieren bolígrafo azul o negro.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
                    {INK_COLOR_OPTIONS.map(opt => {
                      const isSelected = inkColor === opt.hex || (!opt.hex && inkColor === 'original');
                      return (
                        <div
                          key={opt.id}
                          onClick={() => setInkColor(opt.hex || 'original')}
                          style={{
                            padding: '0.5rem 0.65rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            border: isSelected ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                            background: isSelected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.15s'
                          }}
                          title={opt.description}
                        >
                          <div style={{
                            width: '18px', height: '18px', borderRadius: '50%',
                            background: opt.hex || 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            flexShrink: 0
                          }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: isSelected ? 600 : 400, color: '#f8fafc' }}>
                            {opt.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Filtro de Umbral y Limpieza de Papel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sliders size={15} color="#3b82f6" />
                      Sensibilidad de Fondo ({threshold})
                    </label>
                    <button
                      type="button"
                      onClick={() => setThreshold(155)}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.7rem', padding: '1px 6px', color: '#64748b' }}
                      title="Restablecer a 155"
                    >
                      Por defecto
                    </button>
                  </div>

                  <input
                    type="range"
                    min="40"
                    max="230"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                    <span>Más tinta (+ trazo)</span>
                    <span>Menos ruido (- fondo)</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.35rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', cursor: 'pointer', color: '#cbd5e1' }}>
                      <input
                        type="checkbox"
                        checked={enhanceThinLines}
                        onChange={e => setEnhanceThinLines(e.target.checked)}
                      />
                      Reforzar trazos finos (para bolígrafos tenues o gastados)
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', cursor: 'pointer', color: '#cbd5e1' }}>
                      <input
                        type="checkbox"
                        checked={autoTrim}
                        onChange={e => setAutoTrim(e.target.checked)}
                      />
                      Recorte automático de bordes transparentes sobrantes (Autotrim)
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', cursor: 'pointer', color: '#cbd5e1' }}>
                      <input
                        type="checkbox"
                        checked={invert}
                        onChange={e => setInvert(e.target.checked)}
                      />
                      Invertir (para fotos con fondo oscuro o negativo)
                    </label>
                  </div>
                </div>

                {/* Botón de Extraer */}
                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    onClick={extractSignature}
                    disabled={!completedCrop?.width || !completedCrop?.height || processing}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      background: 'linear-gradient(135deg, #0055ff, #2563eb)',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
                    }}
                  >
                    {processing ? <Loader2 className="animate-spin" size={18} /> : <Scissors size={18} />}
                    {processing ? 'Procesando firma...' : 'Extraer y Limpiar Firma'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Vista de Previsualización de la Firma Extraída (Fondo Transparente) */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '1.5rem', padding: '2rem 1rem', textAlign: 'center'
            }}>
              <div>
                <CheckCircle size={44} style={{ color: '#10b981', margin: '0 auto 0.5rem' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.35rem', color: '#f8fafc' }}>
                  ¡Firma Extraída con Éxito!
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                  Fondo de pasaporte eliminado. La firma se guardará como PNG transparente lista para estampar en PDFs.
                </p>
              </div>

              {/* Patrón de tablero de ajedrez para verificar transparencia */}
              <div style={{
                background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 16px 16px',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px',
                padding: '2.5rem',
                minWidth: '320px',
                maxWidth: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 4px 16px rgba(0,0,0,0.4)'
              }}>
                <img
                  src={processedBase64}
                  alt="Firma Extraída"
                  style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Dimensiones: <strong style={{ color: '#94a3b8' }}>{processedDimensions.width} × {processedDimensions.height} px</strong> (PNG transparente con {inkColor === 'original' ? 'Tinta Original' : 'Caneta Azul'})
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={() => setProcessedBase64(null)}
                  disabled={saving}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem' }}
                >
                  <Trash2 size={16} /> Ajustar recorte o reintentar
                </button>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#10b981',
                    borderColor: '#10b981',
                    color: '#fff',
                    padding: '0.65rem 1.5rem',
                    fontWeight: 600,
                    boxShadow: '0 4px 14px rgba(16,185,129,0.3)'
                  }}
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {saving ? 'Guardando en la Ficha...' : 'Guardar Firma en Ficha del Cliente'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
