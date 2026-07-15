import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/config/supabaseClient';

const AuthContext = createContext(null);

const PROFILE_MISSING_MESSAGE = 'Tu perfil o tu organización ya no existen. Contacta a tu administrador.';

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

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
      // Guardar provider_token si existe desde el inicio
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
      }

      if (!session) {
        setUserProfile(null);
        localStorage.removeItem('google_provider_token');
      }
    });

    // Escuchar cambios en localStorage de otras ventanas (el popup)
    const handleStorage = (e) => {
      if (e.key === 'google_provider_token' && e.newValue) {
        // El popup guardó el token — notificar a los componentes que lo necesiten
        window.dispatchEvent(new CustomEvent('google_token_ready'));
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorage);
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

    // La URL de callback: vuelve a la app con ?google_callback=true
    // main.jsx detecta este param y renderiza GoogleAuthCallback (no la app completa)
    const callbackUrl = `${window.location.origin}${window.location.pathname}?google_callback=true`;

    const options = {
      scopes: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
      redirectTo: callbackUrl,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    };

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      let authUrl = null;

      if (currentSession) {
        const hasGoogle = currentSession.user?.identities?.some(id => id.provider === 'google');

        if (hasGoogle) {
          // Ya está vinculado — renovamos el token
          const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options });
          if (error) throw error;
          authUrl = data?.url;
        } else {
          // Primera vez — intentamos vincular la identidad Google al usuario actual
          const { data, error } = await supabase.auth.linkIdentity({ provider: 'google', options });
          if (error) {
            const msg = error.message.toLowerCase();
            const alreadyLinked = msg.includes('already linked') || msg.includes('already registered') || msg.includes('manual linking is disabled');
            if (alreadyLinked) {
              // Fallback: signIn directo con Google
              const { data: d2, error: e2 } = await supabase.auth.signInWithOAuth({ provider: 'google', options });
              if (e2) throw e2;
              authUrl = d2?.url;
            } else {
              throw error;
            }
          } else {
            authUrl = data?.url;
          }
        }
      } else {
        // Sin sesión activa
        const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options });
        if (error) throw error;
        authUrl = data?.url;
      }

      if (!authUrl) throw new Error('No se obtuvo URL de autenticación de Google.');

      // Abrir popup SOLO cuando ya tenemos la URL real de Google
      const width = 520;
      const height = 660;
      const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
      const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
      window.open(authUrl, 'googleAuthPopup', `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`);

    } catch (err) {
      console.error('[Auth] loginWithGoogle error:', err);
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
      {children}
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
