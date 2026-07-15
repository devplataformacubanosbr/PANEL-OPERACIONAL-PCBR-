import { useEffect, useState } from 'react';
import { supabase } from '../../../shared/config/supabaseClient';

/**
 * GoogleAuthCallback — Se renderiza SOLO en el popup de autenticación de Google.
 * Detectado por el parámetro ?google_callback=true en la URL.
 *
 * Flujo:
 *  1. Supabase procesa automáticamente el hash de la URL (#access_token=...)
 *  2. Obtenemos la sesión con el provider_token (token de Gmail)
 *  3. Guardamos el token en localStorage para que lo use la ventana principal
 *  4. Cerramos esta ventana
 */
export default function GoogleAuthCallback() {
  const [status, setStatus] = useState('Procesando autenticación...');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let closed = false;

    async function handleCallback() {
      try {
        // Supabase procesa el hash automáticamente al inicializar.
        // Esperamos hasta 5 segundos para que la sesión esté disponible.
        let session = null;
        let attempts = 0;

        while (!session && attempts < 10) {
          await new Promise(r => setTimeout(r, 500));
          const { data } = await supabase.auth.getSession();
          session = data?.session;
          attempts++;
        }

        if (session?.provider_token) {
          localStorage.setItem('google_provider_token', session.provider_token);
          setStatus('¡Conectado con Google! Cerrando ventana...');
        } else if (session) {
          // Tenemos sesión pero sin provider_token (caso linkIdentity).
          // El token llegará en el siguiente signIn con OAuth.
          setStatus('Cuenta vinculada. Cerrando ventana...');
        } else {
          setStatus('Error: No se pudo obtener la sesión.');
          setIsError(true);
          return;
        }

        // Pequeña pausa para que el usuario vea el mensaje de éxito
        await new Promise(r => setTimeout(r, 1200));

        if (!closed) {
          closed = true;
          window.close();
        }
      } catch (err) {
        console.error('[GoogleAuthCallback] Error:', err);
        setStatus(`Error: ${err.message}`);
        setIsError(true);
      }
    }

    handleCallback();

    // Si window.close() no funciona (navegador lo bloquea), mostrar instrucción manual
    const fallbackTimer = setTimeout(() => {
      if (!closed) {
        setStatus('✓ Autenticación exitosa. Puedes cerrar esta ventana.');
      }
    }, 4000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      background: '#0f172a',
      color: '#fff',
      gap: '16px',
      padding: '24px',
      textAlign: 'center',
    }}>
      {!isError ? (
        <>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32
          }}>✓</div>
          <h2 style={{ margin: 0, fontSize: 22 }}>¡Conectado con Google!</h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>{status}</p>
        </>
      ) : (
        <>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32
          }}>✗</div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Error de conexión</h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>{status}</p>
          <button
            onClick={() => window.close()}
            style={{
              marginTop: 8, padding: '8px 20px', borderRadius: 8,
              background: '#ef4444', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: 14
            }}
          >
            Cerrar ventana
          </button>
        </>
      )}
    </div>
  );
}
