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
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      if (session?.provider_token) {
        localStorage.setItem('google_provider_token', session.provider_token);
        window.dispatchEvent(new Event('google_token_updated'));
      }
      
      if (window.opener) {
        if (session?.provider_token) {
          localStorage.removeItem('google_auth_pending');
          window.close();
        } else if (session) {
          const hasGoogle = session?.user?.identities?.some(id => id.provider === 'google');
          const isGoogleAuthPending = localStorage.getItem('google_auth_pending') === 'true';
          
          if (hasGoogle && isGoogleAuthPending) {
            // Se enlazó pero necesitamos el token. Disparamos signInWithOAuth automáticamente
            localStorage.removeItem('google_auth_pending'); // Para evitar bucles
            supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                scopes: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
                redirectTo: window.location.origin
              }
            });
          }
        }
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
    localStorage.setItem('google_auth_pending', 'true');
    
    // Abrir como un popup real, no un tab completo
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const newTab = window.open('', 'googleAuthPopup', `width=${width},height=${height},left=${left},top=${top}`);
    
    if (newTab) {
      newTab.document.write('<html><body style="font-family:sans-serif;text-align:center;padding:50px;">Redirigiendo a Google...</body></html>');
    }

    const options = {
      scopes: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
      redirectTo: window.location.origin, // Mejor ir al origin para evitar problemas de query strings que rompan el routeo
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      let authData = null;
      let authError = null;

      if (session) {
        const hasGoogle = session?.user?.identities?.some(id => id.provider === 'google');
        if (hasGoogle) {
          const res = await supabase.auth.signInWithOAuth({ provider: 'google', options });
          authData = res.data;
          authError = res.error;
        } else {
          const res = await supabase.auth.linkIdentity({ provider: 'google', options });
          if (res.error && (res.error.message.toLowerCase().includes('already linked') || res.error.message.toLowerCase().includes('already registered'))) {
            const signRes = await supabase.auth.signInWithOAuth({ provider: 'google', options });
            authData = signRes.data;
            authError = signRes.error;
          } else {
            authData = res.data;
            authError = res.error;
          }
        }
      } else {
        const res = await supabase.auth.signInWithOAuth({ provider: 'google', options });
        authData = res.data;
        authError = res.error;
      }

      if (authError) throw authError;

      if (authData?.url && newTab) {
        newTab.location.href = authData.url;
      } else if (newTab) {
        newTab.document.write('<html><body style="font-family:sans-serif;text-align:center;padding:50px;color:red;">Error: No se obtuvo URL de autenticación. Por favor cierra esta ventana.</body></html>');
      }
    } catch (err) {
      console.error("Error en loginWithGoogle:", err);
      if (newTab) {
        newTab.document.write(`<html><body style="font-family:sans-serif;text-align:center;padding:50px;color:red;">Error de conexión: ${err.message}. Por favor cierra esta ventana e intenta nuevamente.</body></html>`);
      }
      localStorage.removeItem('google_auth_pending');
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
