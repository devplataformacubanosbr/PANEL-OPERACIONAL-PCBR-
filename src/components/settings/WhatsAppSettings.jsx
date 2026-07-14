import React, { useState, useEffect } from 'react';
import { supabase } from '../../shared/config/supabaseClient';
import { MessageCircle, Save, Loader2, Bot, Clock, AlertTriangle, Link2, Key, HelpCircle } from 'lucide-react';
import useEvolutionConnection from '../../hooks/useEvolutionConnection';

export default function WhatsAppSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('conexion');

  // Integracion WhatsApp State
  const [proveedor, setProveedor] = useState('evolution_compartido'); // evolution_compartido, evolution_propio, cloud_api, n8n
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [instancia, setInstancia] = useState('');
  const [_webhookUrl, _setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [hasIntegration, setHasIntegration] = useState(false);

  // QR / estado de conexión (compartido con OnboardingWizard)
  const { qrBase64, qrLoading, waStatus, _setWaStatus, generateQR, checkStatus, disconnect } = useEvolutionConnection();

  // Bot State
  const [botActivo, setBotActivo] = useState(true);
  const [horarioInicio, setHorarioInicio] = useState('09:00');
  const [horarioFin, setHorarioFin] = useState('18:00');
  const [templateRespuesta, setTemplateRespuesta] = useState('Hola {nombre}, en breve nos pondremos en contacto.');
  const [templateFueraHorario, setTemplateFueraHorario] = useState('Nuestro horario de atención es de {inicio} a {fin}. Deja tu mensaje.');
  const [umbralSpam, setUmbralSpam] = useState(3);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load WhatsApp Integration
      const { data: waData } = await supabase
        .from('integraciones_whatsapp')
        .select('*')
        .maybeSingle();
        
      if (waData) {
        setProveedor(waData.proveedor || 'evolution_compartido');
        setApiUrl(waData.api_url || '');
        setApiKey(waData.api_key || '');
        setInstancia(waData.instancia || '');
        setWebhookSecret(waData.webhook_secret || '');
        setHasIntegration(true);
      } else {
        setHasIntegration(false);
      }

      // Load Bot Config
      const { data: botData } = await supabase
        .from('configuracion_bot')
        .select('*')
        .maybeSingle();
        
      if (botData) {
        setBotActivo(botData.bot_activo);
        setHorarioInicio(botData.horario_inicio ? botData.horario_inicio.substring(0, 5) : '09:00');
        setHorarioFin(botData.horario_fin ? botData.horario_fin.substring(0, 5) : '18:00');
        setTemplateRespuesta(botData.template_respuesta || '');
        setTemplateFueraHorario(botData.template_fuera_horario || '');
        setUmbralSpam(botData.umbral_spam || 3);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConexion = async () => {
    try {
      setSaving(true);
      const payload = {
        proveedor,
        api_url: apiUrl,
        api_key: apiKey,
        instancia,
        webhook_secret: webhookSecret || null,
        actualizado_en: new Date().toISOString()
      };

      const { data: existing, error: findError } = await supabase
        .from('integraciones_whatsapp')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;

      const { error } = existing
        ? await supabase.from('integraciones_whatsapp').update(payload).eq('id', existing.id)
        : await supabase.from('integraciones_whatsapp').insert(payload);

      if (error) throw error;
      alert('Conexión guardada exitosamente');
    } catch (err) {
      console.error('Error saving connection:', err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBot = async () => {
    try {
      setSaving(true);
      const payload = {
        bot_activo: botActivo,
        horario_inicio: horarioInicio,
        horario_fin: horarioFin,
        template_respuesta: templateRespuesta,
        template_fuera_horario: templateFueraHorario,
        umbral_spam: umbralSpam,
        actualizado_en: new Date().toISOString()
      };

      const { data: existing, error: findError } = await supabase
        .from('configuracion_bot')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;

      const { error } = existing
        ? await supabase.from('configuracion_bot').update(payload).eq('id', existing.id)
        : await supabase.from('configuracion_bot').insert(payload);

      if (error) throw error;
      alert('Configuración del bot guardada exitosamente');
    } catch (err) {
      console.error('Error saving bot config:', err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('¿Seguro que querés quitar esta conexión de WhatsApp? Vas a tener que volver a configurarla desde cero.')) return;
    try {
      setSaving(true);
      if (proveedor === 'evolution_compartido') {
        // Cierra la sesión en Evolution API y borra el registro del lado del servidor.
        await disconnect();
      } else {
        const { error } = await supabase
          .from('integraciones_whatsapp')
          .delete()
          .not('id', 'is', null);
        if (error) throw error;
      }

      // Reset del formulario
      setProveedor('evolution_compartido');
      setApiUrl('');
      setApiKey('');
      setInstancia('');
      setWebhookSecret('');
      setHasIntegration(false);
      alert('Conexión eliminada');
    } catch (err) {
      console.error('Error al desconectar:', err);
      alert('Error al quitar la conexión: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateQR = async () => {
    try {
      const data = await generateQR();
      if (data?.instanceStatus === 'open') {
        alert("¡Tu WhatsApp ya está conectado!");
      }
    } catch (err) {
      console.error('Error generating QR:', err);
      alert('Error al generar QR: ' + err.message);
    }
  };

  const handleCheckStatus = async () => {
    try {
      await checkStatus();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('conexion')}
          style={{
            background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer',
            fontWeight: activeTab === 'conexion' ? 600 : 400,
            color: activeTab === 'conexion' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'conexion' ? '2px solid var(--color-primary)' : '2px solid transparent'
          }}
        >
          <Link2 size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Conexión WhatsApp
        </button>
        <button
          onClick={() => setActiveTab('bot')}
          style={{
            background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer',
            fontWeight: activeTab === 'bot' ? 600 : 400,
            color: activeTab === 'bot' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'bot' ? '2px solid var(--color-primary)' : '2px solid transparent'
          }}
        >
          <Bot size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Reglas del Bot
        </button>
      </div>

      {activeTab === 'conexion' && (
        <div style={{ background: 'var(--color-bg-base)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              Proveedor de Conexión
            </label>
            <select
              className="form-input"
              value={proveedor}
              onChange={(e) => {
                const val = e.target.value;
                setProveedor(val);
                if (val === 'cloud_api') {
                  if (!webhookSecret) setWebhookSecret(crypto.randomUUID());
                  if (!apiUrl) setApiUrl('https://graph.facebook.com/v21.0');
                }
              }}
              style={{ width: '100%', maxWidth: '400px' }}
            >
              <option value="evolution_compartido">Evolution API (Servidor Compartido del SaaS)</option>
              <option value="evolution_propio">Evolution API (Servidor Propio)</option>
              <option value="cloud_api">WhatsApp Cloud API (Meta oficial)</option>
              <option value="n8n">n8n / Webhook Personalizado (Avanzado)</option>
            </select>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
              {proveedor === 'evolution_compartido' && 'Usaremos la infraestructura del sistema. Solo necesitas escanear el QR.'}
              {proveedor === 'evolution_propio' && 'Conecta tu propia instancia de Evolution API para mayor privacidad y control.'}
              {proveedor === 'cloud_api' && 'Conecta tu número de WhatsApp Business verificado directamente vía la API oficial de Meta.'}
              {proveedor === 'n8n' && 'Envía los mensajes salientes a tu propio flujo de n8n o webhook.'}
            </p>
          </div>

          {(proveedor === 'evolution_propio' || proveedor === 'n8n') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', maxWidth: '600px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  URL de la API / Webhook
                </label>
                <input type="text" className="form-input" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://api.tu-dominio.com" style={{ width: '100%' }} />
              </div>

              {proveedor === 'evolution_propio' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      API Key Global
                    </label>
                    <input type="password" className="form-input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      Nombre de Instancia
                    </label>
                    <input type="text" className="form-input" value={instancia} onChange={(e) => setInstancia(e.target.value)} placeholder="ej. agencia_principal" style={{ width: '100%' }} />
                  </div>
                </>
              )}
            </div>
          )}

          {proveedor === 'cloud_api' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', maxWidth: '600px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  URL Base de Graph API
                </label>
                <input type="text" className="form-input" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://graph.facebook.com/v21.0" style={{ width: '100%' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Normalmente no hace falta cambiar esto.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  Phone Number ID
                </label>
                <input type="text" className="form-input" value={instancia} onChange={(e) => setInstancia(e.target.value)} placeholder="ej. 123456789012345" style={{ width: '100%' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Meta Developer Console → WhatsApp → Primeros pasos.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  Access Token
                </label>
                <input type="password" className="form-input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Token temporal o permanente de sistema" style={{ width: '100%' }} />
              </div>

              <div style={{ padding: '1rem', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
                  Configurá esto en Meta → WhatsApp → Configuration → Webhook:
                </p>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>Callback URL</label>
                <input
                  type="text"
                  className="form-input"
                  readOnly
                  value={webhookSecret ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-whatsapp-in?secret=${webhookSecret}` : ''}
                  onFocus={(e) => e.target.select()}
                  style={{ width: '100%', fontSize: '0.75rem', marginBottom: '0.75rem' }}
                />
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>Verify Token</label>
                <input
                  type="text"
                  className="form-input"
                  readOnly
                  value={webhookSecret}
                  onFocus={(e) => e.target.select()}
                  style={{ width: '100%', fontSize: '0.75rem' }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>
                  Guardá la conexión primero para que este secreto quede activo en el servidor.
                </p>
              </div>
            </div>
          )}

          {proveedor === 'evolution_compartido' && (
            <div style={{ padding: '2rem', border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-md)', textAlign: 'center', margin: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              
              {waStatus === 'connected' ? (
                <>
                   <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(37, 211, 102, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                     <MessageCircle size={32} color="#25D366" />
                   </div>
                   <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>WhatsApp Conectado</h3>
                   <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Tu línea está activa y el servidor está recibiendo mensajes.</p>
                </>
              ) : qrBase64 ? (
                 <>
                   <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '1rem' }}>Escanea este código QR con tu WhatsApp</h3>
                   <img src={qrBase64.includes('base64,') ? qrBase64 : `data:image/png;base64,${qrBase64}`} alt="WhatsApp QR" style={{ width: '250px', height: '250px', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '0.5rem', background: 'white' }} />
                   <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '1rem' }}>Abre WhatsApp en tu teléfono {'>'} Dispositivos vinculados {'>'} Vincular un dispositivo.</p>
                   <button className="btn" onClick={handleCheckStatus} disabled={qrLoading} style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                      {qrLoading ? <Loader2 size={16} className="animate-spin" /> : 'Verificar Conexión'}
                   </button>
                 </>
              ) : (
                <>
                  <Bot size={32} style={{ color: 'var(--color-primary)', margin: '0 auto 1rem' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Generar Conexión Segura</h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto 1.5rem' }}>
                    Se creará una instancia privada en nuestro servidor. Tu número estará 100% aislado.
                  </p>
                  <button className="btn btn-primary" onClick={handleGenerateQR} disabled={qrLoading}>
                    {qrLoading ? <><Loader2 size={16} className="animate-spin" style={{ display: 'inline', marginRight: '0.5rem' }} /> Generando...</> : 'Generar Código QR'}
                  </button>
                </>
              )}
            </div>
          )}

          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {hasIntegration ? (
              <button
                onClick={handleDisconnect}
                disabled={saving || qrLoading}
                style={{ background: 'none', border: '1px solid var(--color-danger, #e53e3e)', color: 'var(--color-danger, #e53e3e)', borderRadius: 'var(--radius-md)', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Quitar conexión
              </button>
            ) : <span />}
            <button className="btn btn-primary" onClick={handleSaveConexion} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar Conexión
            </button>
          </div>
        </div>
      )}

      {activeTab === 'bot' && (
        <div style={{ background: 'var(--color-bg-base)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', padding: '1rem', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>Auto-respuestas Bot</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Habilitar respuestas automáticas para nuevos clientes</p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={botActivo} onChange={(e) => setBotActivo(e.target.checked)} style={{ width: '40px', height: '20px', appearance: 'none', background: botActivo ? 'var(--color-primary)' : 'var(--color-bg-canvas)', borderRadius: '10px', position: 'relative', cursor: 'pointer', outline: 'none', border: '1px solid var(--color-border)', transition: '0.2s' }} />
              <div style={{ position: 'absolute', width: '16px', height: '16px', background: 'white', borderRadius: '50%', transform: botActivo ? 'translateX(20px)' : 'translateX(2px)', transition: '0.2s', pointerEvents: 'none' }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} /> Horario de Atención
              </h4>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>Apertura</label>
                  <input type="time" className="form-input" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>Cierre</label>
                  <input type="time" className="form-input" value={horarioFin} onChange={(e) => setHorarioFin(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>
                Fuera de este horario, el bot enviará el mensaje de "Fuera de Horario".
              </p>

              <div style={{ marginTop: '2rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                  Umbral de Alerta Spam (mensajes)
                </label>
                <input type="number" min="1" max="10" className="form-input" value={umbralSpam} onChange={(e) => setUmbralSpam(parseInt(e.target.value) || 3)} style={{ width: '100px' }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                  Avisar al equipo si un cliente envía más de esta cantidad de mensajes seguidos.
                </p>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
                Plantillas de Mensajes
              </h4>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>Respuesta Estándar (En Horario)</label>
                <textarea className="form-input" value={templateRespuesta} onChange={(e) => setTemplateRespuesta(e.target.value)} style={{ width: '100%', height: '80px', resize: 'vertical' }} />
                <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', marginTop: '0.25rem' }}>Variables: {"{nombre}"}, {"{org}"}</div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>Respuesta Fuera de Horario</label>
                <textarea className="form-input" value={templateFueraHorario} onChange={(e) => setTemplateFueraHorario(e.target.value)} style={{ width: '100%', height: '80px', resize: 'vertical' }} />
                <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', marginTop: '0.25rem' }}>Variables: {"{nombre}"}, {"{org}"}, {"{inicio}"}, {"{fin}"}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSaveBot} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar Reglas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
