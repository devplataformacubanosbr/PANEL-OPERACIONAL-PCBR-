import { useEffect, useState } from 'react';
import { supabase } from '../../../shared/config/supabaseClient';

/**
 * GoogleAuthCallback — Se renderiza SOLO en el popup de autenticación de Google.
 * Detectado por el parámetro ?google_callback=true en la URL.
 *
 * El provider_token viene en el hash de la URL (#access_token=...&provider_token=...)
 * Supabase lo procesa automáticamente. Nosotros solo lo rescatamos y guardamos.
 */
export default function GoogleAuthCallback() {
  const [status, setStatus] = useState('Procesando autenticación con Google...');
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function extractAndSaveToken() {
      try {
        // 1) Intentar extraer provider_token directo del hash de la URL
        //    (Supabase lo pone ahí: #access_token=X&provider_token=Y)
        const hash = window.location.hash;
        let providerToken = null;

        if (hash) {
          const params = new URLSearchParams(hash.replace('#', '?'));
          providerToken = params.get('provider_token');
        }

        // 2) Si no está en el hash, esperar a que Supabase procese la sesión
        if (!providerToken) {
          setStatus('Obteniendo sesión de Google...');
          let attempts = 0;
          while (!providerToken && attempts < 15) {
            await new Promise(r => setTimeout(r, 500));
            const { data } = await supabase.auth.getSession();
            providerToken = data?.session?.provider_token || null;
            attempts++;
          }
        }

        if (cancelled) return;

        if (providerToken) {
          localStorage.setItem('google_provider_token', providerToken);
          setIsSuccess(true);
          setStatus('¡Conectado! Cerrando ventana...');

          // Dar 1.5s para que el usuario vea el éxito, luego cerrar
          await new Promise(r => setTimeout(r, 1500));
          if (!cancelled) window.close();
        } else {
          setStatus('Error: No se recibió el token de Google.');
          setIsError(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[GoogleAuthCallback]', err);
          setStatus(`Error: ${err.message}`);
          setIsError(true);
        }
      }
    }

    extractAndSaveToken();

    // Si window.close() fue bloqueado por el navegador
    const fallback = setTimeout(() => {
      if (!cancelled && !isError) {
        setStatus('✓ Listo. Puedes cerrar esta ventana manualmente.');
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  const bgColor = isError ? '#7f1d1d' : isSuccess ? '#064e3b' : '#1e293b';
  const icon = isError ? '✗' : isSuccess ? '✓' : '⟳';
  const iconBg = isError ? '#ef4444' : isSuccess ? '#10b981' : '#3b82f6';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      background: bgColor, color: '#fff', gap: 16, padding: 24,
      textAlign: 'center', transition: 'background 0.5s',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: iconBg, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 36, transition: 'background 0.5s',
        animation: !isSuccess && !isError ? 'spin 1.5s linear infinite' : 'none',
      }}>
        {icon}
      </div>
      <h2 style={{ margin: 0, fontSize: 22 }}>
        {isError ? 'Error de conexión' : isSuccess ? '¡Conectado con Google!' : 'Conectando...'}
      </h2>
      <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14 }}>{status}</p>
      {isError && (
        <button onClick={() => window.close()} style={{
          marginTop: 8, padding: '8px 20px', borderRadius: 8,
          background: '#ef4444', color: '#fff', border: 'none',
          cursor: 'pointer', fontSize: 14,
        }}>
          Cerrar ventana
        </button>
      )}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
