import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// El bucket whatsapp_media pasó a privado (auditoría 2026-07-11); las URLs
// públicas guardadas en mensajes.media_url (.../object/public/whatsapp_media/...)
// ya no sirven para leer el archivo, así que se resuelven a una URL firmada
// bajo demanda. mediaUrl que no matchee ese patrón (legacy/externo) se
// devuelve tal cual.
const PUBLIC_PATH_MARKER = '/object/public/whatsapp_media/';
const SIGNED_URL_TTL_SECONDS = 3600;

export function useSignedWhatsappMediaUrl(mediaUrl) {
  const [resolvedUrl, setResolvedUrl] = useState(null);

  useEffect(() => {
    if (!mediaUrl) {
      setResolvedUrl(null);
      return;
    }

    const markerIndex = mediaUrl.indexOf(PUBLIC_PATH_MARKER);
    if (markerIndex === -1) {
      setResolvedUrl(mediaUrl);
      return;
    }

    const objectPath = decodeURIComponent(mediaUrl.slice(markerIndex + PUBLIC_PATH_MARKER.length));
    let cancelled = false;
    setResolvedUrl(null);

    supabase.storage
      .from('whatsapp_media')
      .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          console.error('No se pudo firmar la URL de whatsapp_media:', objectPath, error);
          setResolvedUrl(null);
          return;
        }
        setResolvedUrl(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaUrl]);

  return resolvedUrl;
}
