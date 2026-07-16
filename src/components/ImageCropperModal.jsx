import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, RefreshCw, Crop, PenTool } from 'lucide-react';
import { getDocuments, getSignedUrl } from '../services/storageService';

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const DEFAULT_SIG_WIDTH = 0.3;
const DEFAULT_SIG_HEIGHT = 0.12;
const MIN_DRAG = 0.015;

export default function ImageCropperModal({ isOpen, imageUrl, initialDocName, clientId, onClose, onCropComplete }) {
  const [activeTab, setActiveTab] = useState('crop'); // 'crop' | 'firma'

  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customName, setCustomName] = React.useState('');

  // ── Firma ──────────────────────────────────────────────────────────────────
  const [signatures, setSignatures] = useState([]);
  const [loadingSignatures, setLoadingSignatures] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState(null);
  const [placedFirmas, setPlacedFirmas] = useState([]);
  const [dragRect, setDragRect] = useState(null);
  const isDraggingRef = useRef(false);
  const firmaImgRef = useRef(null);

  React.useEffect(() => {
    if (isOpen) {
      setCustomName(initialDocName || 'Documento de Kommo');
      setActiveTab('crop');
      setPlacedFirmas([]);
      setSelectedSignature(null);
      setDragRect(null);
    }
  }, [isOpen, initialDocName]);

  useEffect(() => {
    if (!isOpen || !clientId) return;
    setLoadingSignatures(true);
    getDocuments(clientId).then(async docs => {
      const firmas = docs.filter(d => d.tipo_documento === 'FIRMA_DIGITAL');
      const resolved = await Promise.all(firmas.map(async f => {
        try {
          const signedUrl = await getSignedUrl(f.url_archivo);
          return { ...f, url_archivo: signedUrl };
        } catch (err) {
          console.error('Error resolviendo URL de firma:', f.nombre_archivo, err);
          return null;
        }
      }));
      setSignatures(resolved.filter(Boolean));
    }).catch(console.error).finally(() => setLoadingSignatures(false));
  }, [isOpen, clientId]);

  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }, []);

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) {
      onClose();
      return;
    }

    setIsProcessing(true);
    try {
      const image = imgRef.current;
      const canvas = document.createElement('canvas');
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const ctx = canvas.getContext('2d');
      const pixelRatio = window.devicePixelRatio;

      canvas.width = Math.floor(completedCrop.width * scaleX * pixelRatio);
      canvas.height = Math.floor(completedCrop.height * scaleY * pixelRatio);

      ctx.scale(pixelRatio, pixelRatio);
      ctx.imageSmoothingQuality = 'high';

      const cropX = completedCrop.x * scaleX;
      const cropY = completedCrop.y * scaleY;
      const cropWidth = completedCrop.width * scaleX;
      const cropHeight = completedCrop.height * scaleY;

      ctx.drawImage(
        image,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );

      // Extract to blob
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Canvas is empty');
          setIsProcessing(false);
          return;
        }

        const file = new File([blob], 'cropped_image.jpg', { type: 'image/jpeg' });
        onCropComplete(file, customName);
        setIsProcessing(false);
      }, 'image/jpeg', 0.95);

    } catch (err) {
      console.error('Error cropping image:', err);
      setIsProcessing(false);
    }
  };

  // ── Colocar firma: arrastre igual que en la vista previa de plantillas ──────
  const relativePoint = (e, container) => {
    const rect = container.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const handleFirmaMouseDown = (e) => {
    if (!selectedSignature) return;
    const { x, y } = relativePoint(e, e.currentTarget);
    isDraggingRef.current = true;
    setDragRect({ startX: x, startY: y, x, y, width: 0, height: 0 });
  };

  const handleFirmaMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const { x, y } = relativePoint(e, e.currentTarget);
    setDragRect(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        x: Math.min(prev.startX, x),
        y: Math.min(prev.startY, y),
        width: Math.abs(x - prev.startX),
        height: Math.abs(y - prev.startY),
      };
    });
  };

  const finishPlacingFirma = () => {
    if (!isDraggingRef.current || !dragRect || !selectedSignature) {
      isDraggingRef.current = false;
      setDragRect(null);
      return;
    }
    isDraggingRef.current = false;

    let { x, y, width, height, startX, startY } = dragRect;
    if (width < MIN_DRAG && height < MIN_DRAG) {
      width = DEFAULT_SIG_WIDTH;
      height = DEFAULT_SIG_HEIGHT;
      x = startX - width / 2;
      y = startY - height / 2;
    }

    setPlacedFirmas(prev => [...prev, { id: Date.now(), url: selectedSignature.url_archivo, x, y, width, height }]);
    setSelectedSignature(null);
    setDragRect(null);
  };

  const handleSaveFirma = async () => {
    if (!firmaImgRef.current) {
      onClose();
      return;
    }
    if (placedFirmas.length === 0) {
      onClose();
      return;
    }

    setIsProcessing(true);
    try {
      const image = firmaImgRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (const firma of placedFirmas) {
        const sigImg = await loadImageElement(firma.url);
        ctx.drawImage(
          sigImg,
          firma.x * canvas.width,
          firma.y * canvas.height,
          firma.width * canvas.width,
          firma.height * canvas.height
        );
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Canvas is empty');
          setIsProcessing(false);
          return;
        }
        const file = new File([blob], 'firmado_image.jpg', { type: 'image/jpeg' });
        onCropComplete(file, customName);
        setIsProcessing(false);
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('Error firmando imagen:', err);
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const tabButtonStyle = (tab) => ({
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.4rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600,
    border: '1px solid var(--color-border, #444)', cursor: 'pointer',
    background: activeTab === tab ? 'var(--color-primary, #2563eb)' : 'transparent',
    color: activeTab === tab ? '#fff' : 'var(--color-text-secondary, #ccc)',
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'var(--color-bg-canvas, #1e1e1e)',
        borderRadius: 'var(--radius-lg, 8px)',
        padding: '1.5rem',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        border: '1px solid var(--color-border, #333)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--color-text-primary, #fff)', fontSize: '1.25rem' }}>Editar Imagen</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted, #999)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setActiveTab('crop')} style={tabButtonStyle('crop')}>
            <Crop size={14} /> Recortar
          </button>
          <button onClick={() => setActiveTab('firma')} style={tabButtonStyle('firma')}>
            <PenTool size={14} /> Firmar
          </button>
        </div>

        {activeTab === 'crop' ? (
          <div style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#000',
            borderRadius: '4px',
            minHeight: '300px'
          }}>
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                onLoad={onImageLoad}
                style={{ maxHeight: '60vh', maxWidth: '100%', objectFit: 'contain' }}
                crossOrigin="anonymous"
                alt="Crop"
              />
            </ReactCrop>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '300px' }}>
            {loadingSignatures ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--color-text-muted, #999)' }}>
                <RefreshCw size={20} className="animate-spin" />
              </div>
            ) : signatures.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--color-text-muted, #999)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
                No tenés firmas guardadas para este cliente. Extraela primero desde "Extraer Firma" en la ficha del cliente.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                  {signatures.map(sig => (
                    <div
                      key={sig.id}
                      onClick={() => setSelectedSignature(sig)}
                      style={{
                        flexShrink: 0, cursor: 'pointer', padding: '0.4rem', borderRadius: '6px',
                        border: `2px solid ${selectedSignature?.id === sig.id ? 'var(--color-primary, #2563eb)' : 'transparent'}`,
                        background: 'repeating-conic-gradient(#e5e5e5 0% 25%, #fff 0% 50%) 50% / 16px 16px',
                      }}
                    >
                      <img src={sig.url_archivo} alt="Firma" style={{ height: '48px', maxWidth: '120px', objectFit: 'contain' }} />
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #999)', margin: 0 }}>
                  {selectedSignature ? 'Arrastrá sobre la imagen para definir el tamaño (o hacé clic para tamaño estándar).' : 'Elegí una firma arriba y luego colocala sobre la imagen.'}
                </p>

                <div
                  style={{ position: 'relative', display: 'flex', justifyContent: 'center', backgroundColor: '#000', borderRadius: '4px', cursor: selectedSignature ? 'crosshair' : 'default', userSelect: 'none' }}
                  onMouseDown={handleFirmaMouseDown}
                  onMouseMove={handleFirmaMouseMove}
                  onMouseUp={finishPlacingFirma}
                  onMouseLeave={() => { if (isDraggingRef.current) finishPlacingFirma(); }}
                >
                  <img
                    ref={firmaImgRef}
                    src={imageUrl}
                    alt="Documento"
                    crossOrigin="anonymous"
                    draggable={false}
                    style={{ maxHeight: '50vh', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
                  />

                  {placedFirmas.map(firma => (
                    <img
                      key={firma.id}
                      src={firma.url}
                      alt="Firma colocada"
                      style={{
                        position: 'absolute',
                        left: `${firma.x * 100}%`,
                        top: `${firma.y * 100}%`,
                        width: `${firma.width * 100}%`,
                        height: `${firma.height * 100}%`,
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))'
                      }}
                    />
                  ))}

                  {dragRect && (
                    <div style={{
                      position: 'absolute',
                      left: `${dragRect.x * 100}%`,
                      top: `${dragRect.y * 100}%`,
                      width: `${dragRect.width * 100}%`,
                      height: `${dragRect.height * 100}%`,
                      border: '2px dashed var(--color-primary, #2563eb)',
                      background: 'rgba(37,99,235,0.12)',
                      pointerEvents: 'none',
                    }} />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          <label style={{ color: 'var(--color-text-secondary, #ccc)', fontSize: '0.875rem' }}>Nombre del Documento</label>
          <input
            type="text"
            className="form-input"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Ej: Pasaporte, Frente RNM..."
            style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid var(--color-border, #444)' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button
            onClick={onClose}
            className="btn"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border, #444)',
              color: 'var(--color-text-primary, #fff)',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={activeTab === 'crop' ? handleSave : handleSaveFirma}
            disabled={isProcessing || (activeTab === 'firma' && placedFirmas.length === 0)}
            className="btn btn-primary"
            style={{
              background: 'var(--color-primary, #2563eb)',
              border: 'none',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: isProcessing ? 'wait' : 'pointer',
              opacity: (activeTab === 'firma' && placedFirmas.length === 0) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {isProcessing ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
            {isProcessing ? 'Procesando...' : 'Guardar y Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}
