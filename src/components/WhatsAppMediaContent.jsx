import React from 'react';
import { File, Download, Play } from 'lucide-react';
import { useSignedWhatsappMediaUrl } from '../hooks/useSignedWhatsappMediaUrl';

// Extraído de ClientWhatsApp.jsx (auditoría 2026-07-11): whatsapp_media pasó
// a bucket privado, así que el render de cada adjunto necesita resolver una
// URL firmada antes de poder usarla en src/href — por eso vive en su propio
// componente (un hook no puede llamarse dentro de un .map() inline).
export default function WhatsAppMediaContent({ msg, safeMediaType, setPreviewMedia }) {
  const url = useSignedWhatsappMediaUrl(msg.media_url);

  if (!msg.media_url) return null;

  if (!url) {
    return (
      <div style={{ padding: '8px 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
        Cargando adjunto...
      </div>
    );
  }

  const dragData = (name) => (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'whatsapp_media', url, name, mimeType: safeMediaType }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (safeMediaType.startsWith('image/')) {
    return (
      <div draggable onDragStart={dragData(msg.media_name || 'imagen.jpg')} style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', marginBottom: '4px', cursor: 'grab' }}>
        <img
          src={url}
          alt={msg.media_name || 'Imagen'}
          style={{ maxWidth: '100%', borderRadius: '8px', display: 'block', cursor: 'pointer', maxHeight: '250px', objectFit: 'contain' }}
          onClick={() => setPreviewMedia({ url, type: safeMediaType, name: msg.media_name })}
        />
        <a href={url} download={msg.media_name || 'imagen.jpg'} target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', textDecoration: 'none' }} title="Descargar">
          <Download size={16} />
        </a>
      </div>
    );
  }

  if (safeMediaType.startsWith('video/')) {
    return (
      <div draggable onDragStart={dragData(msg.media_name || 'video.mp4')} style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', marginBottom: '4px', cursor: 'grab' }}>
        <video src={url} controls style={{ maxWidth: '100%', borderRadius: '8px', display: 'block', maxHeight: '250px' }} />
        <button onClick={() => setPreviewMedia({ url, type: safeMediaType, name: msg.media_name })} style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }} title="Ver pantalla completa">
          <Play size={16} />
        </button>
        <a href={url} download={msg.media_name || 'video.mp4'} target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', textDecoration: 'none', zIndex: 10 }} title="Descargar">
          <Download size={16} />
        </a>
      </div>
    );
  }

  if (safeMediaType.startsWith('audio/')) {
    return (
      <div draggable onDragStart={dragData(msg.media_name || 'audio.mp3')} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', background: 'rgba(0,0,0,0.05)', padding: '4px 8px', borderRadius: '8px', cursor: 'grab' }}>
        <audio src={url} controls style={{ maxWidth: '220px', height: '40px' }} />
        <a href={url} download={msg.media_name || 'audio.mp3'} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', display: 'flex', padding: '6px', borderRadius: '50%', background: 'var(--color-bg-canvas)', border: '1px solid var(--color-border)', textDecoration: 'none' }} title="Descargar">
          <Download size={16} />
        </a>
      </div>
    );
  }

  return (
    <div draggable onDragStart={dragData(msg.media_name || 'documento')} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '4px' }}>
      {safeMediaType === 'application/pdf' && (
        <div
          onClick={() => setPreviewMedia({ url, type: safeMediaType, name: msg.media_name })}
          style={{ width: '100%', height: '120px', background: 'var(--color-bg-canvas)', borderRadius: '8px', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', overflow: 'hidden', position: 'relative' }}
          title="Click para previsualizar"
        >
          <File size={32} style={{ color: '#ef4444', marginBottom: '8px' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Vista Previa PDF</span>
        </div>
      )}
      <a href={url} download={msg.media_name || 'documento'} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <File size={20} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{msg.media_name || 'Documento adjunto'}</span>
        </div>
        <div style={{ padding: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', flexShrink: 0, color: 'inherit' }}>
          <Download size={16} />
        </div>
      </a>
    </div>
  );
}
