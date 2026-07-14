import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, RefreshCw } from 'lucide-react';

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

export default function ImageCropperModal({ isOpen, imageUrl, initialDocName, onClose, onCropComplete }) {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customName, setCustomName] = React.useState('');

  React.useEffect(() => {
    if (isOpen) {
      setCustomName(initialDocName || 'Documento de Kommo');
    }
  }, [isOpen, initialDocName]);

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

  if (!isOpen) return null;

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
          <h3 style={{ margin: 0, color: 'var(--color-text-primary, #fff)', fontSize: '1.25rem' }}>Editar y Cortar Imagen</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted, #999)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

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
            onClick={handleSave}
            disabled={isProcessing}
            className="btn btn-primary"
            style={{ 
              background: 'var(--color-primary, #2563eb)', 
              border: 'none', 
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: isProcessing ? 'wait' : 'pointer',
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
