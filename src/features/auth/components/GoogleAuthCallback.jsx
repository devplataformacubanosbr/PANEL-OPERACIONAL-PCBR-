import { useEffect, useState } from 'react';
import { supabase } from '../../../shared/config/supabaseClient';

/**
 * GoogleAuthCallback — Se renderiza SOLO en el popup de autenticación de Google.
 * Detectado por el parámetro ?google_callback=true en la URL.
 *
 * Con el flujo PKCE de Supabase, el provider_token llega via onAuthStateChange
 * cuando Supabase intercambia el código de autorización por tokens.
 */
export default function GoogleAuthCallback() {
  const [status, setStatus] = useState('Procesando autenticación...');
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let subscription = null;
    let timeoutId = null;

    async function init() {
      // Suscribirse a cambios de auth — este es el momento exacto en que
      // Supabase termina de intercambiar el código PKCE y tiene el provider_token
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (cancelled) return;

        console.log('[Callback] Auth event:', event, 'provider_token:', !!session?.provider_token);

        if (session?.provider_token) {
          localStorage.setItem('google_provider_token', session.provider_token);
          setIsSuccess(true);
          setStatus('¡Listo! Cerrando ventana...');
          setTimeout(() => {
            if (!cancelled) window.close();
          }, 1200);
        } else if (event === 'SIGNED_IN' && session && !session.provider_token) {
          // Sesión creada pero sin provider_token — esto pasa con linkIdentity
          // El token de Gmail no está disponible, necesitamos hacer signIn normal
          setStatus('Vinculado. Obteniendo permisos de Gmail...');
          const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              scopes: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
              redirectTo: window.location.href,
              queryParams: { access_type: 'offline', prompt: 'consent' },
            }
          });
          if (!error && oauthData?.url) {
            window.location.href = oauthData.url;
          }
        }
      });

      subscription = data.subscription;

      // También intentar con la sesión actual por si ya está disponible
      const { data: sessionData } = await supabase.auth.getSession();
      if (!cancelled && sessionData?.session?.provider_token) {
        localStorage.setItem('google_provider_token', sessionData.session.provider_token);
        setIsSuccess(true);
        setStatus('¡Listo! Cerrando ventana...');
        setTimeout(() => {
          if (!cancelled) window.close();
        }, 1200);
        return;
      }

      // Timeout de seguridad — si en 20s no hay token, mostrar error
      timeoutId = setTimeout(() => {
        if (!cancelled && !isSuccess) {
          setStatus('Error: No se recibió el token de Google. Cierra esta ventana e intenta de nuevo.');
          setIsError(true);
        }
      }, 20000);
    }

    init();

    return () => {
      cancelled = true;
      if (subscription) subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const bgColor = isError ? '#450a0a' : isSuccess ? '#052e16' : '#0f172a';
  const iconBg = isError ? '#ef4444' : isSuccess ? '#10b981' : '#3b82f6';
  const icon = isError ? '✗' : isSuccess ? '✓' : null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      background: bgColor, color: '#fff', gap: 16, padding: 24,
      textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: icon ? 36 : 0,
      }}>
        {icon ? icon : (
          <div style={{
            width: 36, height: 36, border: '4px solid rgba(255,255,255,0.3)',
            borderTop: '4px solid white', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        )}
      </div>
      <h2 style={{ margin: 0, fontSize: 22 }}>
        {isError ? 'Error de conexión' : isSuccess ? '¡Conectado con Google!' : 'Conectando con Google...'}
      </h2>
      <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>{status}</p>
      {isError && (
        <button onClick={() => window.close()} style={{
          marginTop: 8, padding: '10px 24px', borderRadius: 8,
          background: '#ef4444', color: '#fff', border: 'none',
          cursor: 'pointer', fontSize: 14, fontWeight: 600,
        }}>
          Cerrar ventana
        </button>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
