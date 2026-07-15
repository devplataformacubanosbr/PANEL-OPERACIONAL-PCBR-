import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/config/supabaseClient';

const AuthContext = createContext(null);

const PROFILE_MISSING_MESSAGE = 'Tu perfil o tu organización ya no existen. Contacta a tu administrador.';

// Detectar si esta ventana es el callback del popup de Google
// Google nos redirige de vuelta con un hash (#access_token=...) o con
// el query param que nosotros pusimos (?auth_popup=true)
const IS_AUTH_POPUP_CALLBACK = window.location.search.includes('auth_popup=true');

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Si somos el popup de callback, guardamos el token y cerramos
  useEffect(() => {
    if (!IS_AUTH_POPUP_CALLBACK) return;

    const handlePopupCallback = async () => {
      // Esperamos a que Supabase procese el hash de la URL con el token
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
      }

      // Cerramos esta ventana hija
      window.close();
    };

    // Pequeño delay para que Supabase tenga tiempo de procesar
    setTimeout(handlePopupCallback, 1500);
  }, []);

  // Busca el perfil del usuario. Si no existe (ej. su organización fue
  // eliminada — perfiles cae en cascada pero auth.users no se toca a
  // propósito, ver migración 032), la sesión de Supabase Auth por sí sola
  // seguiría dejándolo "entrar": se cierra la sesión acá para que una
  // cuenta sin organización no pueda quedarse ni volver a loguearse.
  // authError queda seteado para que la UI muestre por qué, en vez de
  // devolver silenciosamente a la pantalla de login sin explicación.
  const fetchProfile = useCallback(async (userId) => {
    setProfileLoading(true);
    const { data, error } = await supabase.from('perfiles').select('*').eq('id', userId).single();
    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error);
      }
      await supabase.auth.signOut();
      setUserProfile(null);
      setAuthError(PROFILE_MISSING_MESSAGE);
      setProfileLoading(false);
      return null;
    }
    setUserProfile(data);
    setProfileLoading(false);
    return data;
  }, []);

  // Get initial session & subscribe to auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
        // Notifica a otras ventanas/tabs abiertas del mismo origen
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'google_provider_token',
          newValue: session.provider_token,
        }));
      }

      if (!session) {
        setUserProfile(null);
        localStorage.removeItem('google_provider_token');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch user profile when session is available
  useEffect(() => {
    if (session) {
      fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  const login = useCallback(async (email, password) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const profile = await fetchProfile(data.user.id);
    if (!profile) {
      throw new Error(PROFILE_MISSING_MESSAGE);
    }
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);

    // La URL de retorno incluye ?auth_popup=true para que la ventana sepa
    // que es un callback de auth y debe cerrarse automáticamente.
    const redirectTo = `${window.location.origin}${window.location.pathname}?auth_popup=true`;

    const options = {
      scopes: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    };

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      let authUrl = null;
      let authError = null;

      if (currentSession) {
        const hasGoogle = currentSession.user?.identities?.some(id => id.provider === 'google');
        if (hasGoogle) {
          // Ya enlazado: renovamos token con signInWithOAuth
          const res = await supabase.auth.signInWithOAuth({ provider: 'google', options });
          authUrl = res.data?.url;
          authError = res.error;
        } else {
          // Primera vez: enlazamos la identidad
          const res = await supabase.auth.linkIdentity({ provider: 'google', options });
          if (res.error) {
            // Si ya estaba enlazado por otro camino, hacemos signIn directo
            const isAlreadyLinked = res.error.message.toLowerCase().includes('already linked')
              || res.error.message.toLowerCase().includes('already registered');
            if (isAlreadyLinked) {
              const res2 = await supabase.auth.signInWithOAuth({ provider: 'google', options });
              authUrl = res2.data?.url;
              authError = res2.error;
            } else {
              authError = res.error;
            }
          } else {
            authUrl = res.data?.url;
          }
        }
      } else {
        // Sin sesión activa: login normal con Google
        const res = await supabase.auth.signInWithOAuth({ provider: 'google', options });
        authUrl = res.data?.url;
        authError = res.error;
      }

      if (authError) throw authError;
      if (!authUrl) throw new Error('No se obtuvo URL de autenticación de Google.');

      // Abrimos el popup SOLO cuando ya tenemos la URL real de Google
      const width = 500;
      const height = 640;
      const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
      const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
      window.open(authUrl, 'googleAuthPopup', `width=${width},height=${height},left=${left},top=${top}`);

    } catch (err) {
      console.error('[Auth] Error en loginWithGoogle:', err);
      setAuthError(err.message);
      throw err;
    }
  }, []);

  const value = {
    session,
    loading: loading || (!!session && profileLoading),
    userProfile,
    login,
    loginWithGoogle,
    logout,
    authError,
    isAuthenticated: !!session && !!userProfile,
    isAdmin: userProfile?.rol === 'admin' || userProfile?.rol === 'admin_plus',
    userId: session?.user?.id || null,
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Si somos el popup de callback, mostramos una pantalla de espera */}
      {IS_AUTH_POPUP_CALLBACK ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif',
          background: '#0f172a', color: '#fff'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h2 style={{ margin: 0 }}>¡Conectado con Google!</h2>
          <p style={{ color: '#94a3b8' }}>Esta ventana se cerrará automáticamente...</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
