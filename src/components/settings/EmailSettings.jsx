import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Loader2, Mail, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EmailSettings() {
  const [integracion, setIntegracion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(false);

  useEffect(() => {
    fetchIntegration();
  }, []);

  const fetchIntegration = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('integraciones_email')
        .select('*')
        .eq('proveedor', 'gmail')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching email integration:", error);
      }
      setIntegracion(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    setLoadingAuth(true);
    try {
      const returnUrl = window.location.origin + '/#settings'; // Aproximación según el router hash
      const { data, error } = await supabase.functions.invoke('gmail-auth-url', {
        body: { returnUrl }
      });

      if (error) throw error;
      if (data && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No se recibió la URL de autenticación');
      }
    } catch (err) {
      console.error(err);
      toast.error('No se pudo iniciar la conexión con Gmail. Verifica que las variables de entorno de Edge Functions estén configuradas.');
      setLoadingAuth(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('¿Seguro que deseas desconectar esta cuenta de correo? Las automatizaciones fallarán hasta que conectes otra.')) return;
    
    setLoading(true);
    try {
      await supabase.from('integraciones_email').delete().eq('id', integracion.id);
      setIntegracion(null);
      toast.success('Cuenta desconectada correctamente');
    } catch (err) {
      console.error(err);
      toast.error('Error al desconectar la cuenta');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="animate-spin text-brand-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl border border-border bg-bg-surface p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-text-primary">Conexión con Gmail</h3>
        
        {integracion ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-base p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                <Mail size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">Cuenta Conectada</p>
                <p className="text-sm text-text-secondary">{integracion.email_remitente}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs font-semibold text-green-600">Activo</span>
                <button
                  onClick={handleDisconnect}
                  className="rounded-md p-2 text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                  title="Desconectar"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <p className="text-sm text-text-muted">
              Esta cuenta se usará para enviar correos transaccionales a los clientes y a entidades como la Policía Federal.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 px-4 text-center">
            <Mail className="mb-3 text-text-muted" size={32} />
            <h4 className="mb-2 text-base font-medium text-text-primary">No hay ninguna cuenta conectada</h4>
            <p className="mb-6 max-w-sm text-sm text-text-secondary">
              Conecta una cuenta de Google Workspace para enviar correos directamente desde el Panel usando la API oficial.
            </p>
            <button
              onClick={handleConnectGmail}
              disabled={loadingAuth}
              className="flex items-center gap-2 rounded-lg bg-[#4285F4] px-4 py-2 text-sm font-medium text-white hover:bg-[#3367D6] transition-colors disabled:opacity-70"
            >
              {loadingAuth ? <Loader2 className="animate-spin" size={16} /> : <ExternalLink size={16} />}
              Conectar con Google
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
