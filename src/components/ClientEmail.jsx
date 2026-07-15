import React, { useState, useEffect } from 'react';
import { Mail, Send, Trash2, Loader2, Sparkles, Paperclip, X, Pencil, Star, Archive, Search, ArrowLeft, MoreVertical, Minimize2, UserCircle, Plus, LayoutGrid } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { chat } from '../services/aiService';
import { fetchClientEmails, sendGmailEmail } from '../services/gmailService';
import Modal from './ui/Modal';
import Button from './ui/Button';
import AutocompleteTextarea from './ui/AutocompleteTextarea';
import { useAuth } from '../features/auth/context/AuthContext';

export default function ClientEmail({ clientId, clientName, clientEmail, tramitesContext }) {
  const { loginWithGoogle } = useAuth();
  const [messages, setMessages] = useState([]);
  const [googleAuthError, setGoogleAuthError] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  
  // Gmail UI State
  const [view, setView] = useState('list'); // 'list' | 'read'
  const [currentTab, setCurrentTab] = useState('enviados'); // 'enviados' | 'archivados'
  const [activeMessage, setActiveMessage] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  
  // Compose State
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [destinatario, setDestinatario] = useState(clientEmail || '');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [adjuntos, setAdjuntos] = useState([]);

  // Plantillas/Automatizaciones State
  const [plantillas, setPlantillas] = useState([]);
  const [modalPlantillaOpen, setModalPlantillaOpen] = useState(false);
  const [nuevaPlantilla, setNuevaPlantilla] = useState({ nombre: '', asunto: '', cuerpo: '', destinatario: '' });
  const [savingPlantilla, setSavingPlantilla] = useState(false);

  // Variables autocomplete
  const [varSuggestions, setVarSuggestions] = useState(false);
  const [filterVar, setFilterVar] = useState('');
  
  const AVAILABLE_VARS = [
    '{nombre}', '{cpf}', '{email}', '{telefono}', 
    '{nacionalidad}', '{estado_civil}', '{profesion}', 
    '{fecha_actual}', '{direccion}', '{pasaporte}', '{rnms}'
  ];

  // Search State
  const [searchQuery, setSearchQuery] = useState(clientEmail || '');

  useEffect(() => {
    if (clientId) {
      setSearchQuery(clientEmail || '');
      fetchMessages(clientEmail);
      fetchPlantillas();
      setDestinatario(clientEmail || '');
    }
  }, [clientId, clientEmail]);

  const fetchMessages = async (queryParam) => {
    const emailToSearch = queryParam !== undefined ? queryParam : searchQuery;
    if (!emailToSearch) {
      setLoadingMessages(false);
      return;
    }
    setLoadingMessages(true);
    setGoogleAuthError(false);
    try {
      const emails = await fetchClientEmails(emailToSearch);
      setMessages(emails);
    } catch (err) {
      console.error('Error fetching emails:', err);
      // If it's an auth error, we can catch it here
      if (err.message.includes('token') || err.message.includes('sesión') || err.message.includes('Google')) {
        setGoogleAuthError(true);
      } else {
        toast.error('Error al cargar correos.');
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchPlantillas = async () => {
    try {
      const { data, error } = await supabase
        .from('email_plantillas')
        .select('*')
        .order('creado_en', { ascending: true });
      if (!error && data) {
        setPlantillas(data);
      }
    } catch (err) {
      console.error('Error fetching plantillas:', err);
    }
  };

  const handleCrearPlantilla = async (e) => {
    e.preventDefault();
    if (!nuevaPlantilla.nombre.trim() || !nuevaPlantilla.asunto.trim() || !nuevaPlantilla.cuerpo.trim()) return;
    setSavingPlantilla(true);
    try {
      const { data, error } = await supabase.from('email_plantillas').insert([nuevaPlantilla]).select();
      if (error) throw error;
      setPlantillas([...plantillas, data[0]]);
      setModalPlantillaOpen(false);
      setNuevaPlantilla({ nombre: '', asunto: '', cuerpo: '', destinatario: '' });
      toast.success('Plantilla creada correctamente');
    } catch (err) {
      toast.error('Error al crear automatización');
      console.error(err);
    } finally {
      setSavingPlantilla(false);
    }
  };

  const handleDeletePlantilla = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('¿Seguro que deseas eliminar esta automatización?')) return;
    try {
      const { error } = await supabase.from('email_plantillas').delete().eq('id', id);
      if (error) throw error;
      setPlantillas(plantillas.filter(p => p.id !== id));
      toast.success('Automatización eliminada');
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar');
    }
  };

  const handleUsePlantilla = (plantilla) => {
    let asuntoReemplazado = plantilla.asunto || '';
    let cuerpoReemplazado = plantilla.cuerpo || '';

    if (client) {
      const replacements = {
        '{nombre}': client.nombre || '',
        '{cpf}': client.cpf || '',
        '{email}': client.email || '',
        '{telefono}': client.telefono || '',
        '{nacionalidad}': client.nacionalidad || '',
        '{estado_civil}': client.estado_civil || '',
        '{profesion}': client.profesion || '',
        '{pasaporte}': client.pasaporte || '',
        '{rnms}': client.rnms || '',
        '{direccion}': client.direccion || '',
        '{fecha_actual}': new Date().toLocaleDateString()
      };

      Object.entries(replacements).forEach(([key, value]) => {
        // use regex with global flag to replace all occurrences
        const regex = new RegExp(key, 'gi');
        asuntoReemplazado = asuntoReemplazado.replace(regex, value);
        cuerpoReemplazado = cuerpoReemplazado.replace(regex, value);
      });
    }

    if (plantilla.destinatario) {
      setDestinatario(plantilla.destinatario);
    }
    setAsunto(asuntoReemplazado);
    setCuerpo(cuerpoReemplazado);
    setComposeOpen(true);
    setComposeMinimized(false);
  };

  const handleGenerateAI = async () => {
    if (!destinatario) {
      toast.error('Por favor, ingresa un destinatario para contextualizar la IA.');
      return;
    }
    setGenerating(true);
    const toastId = toast.loading('Generando correo con IA...');
    try {
      const isPolice = destinatario.toLowerCase().includes('policia') || destinatario.toLowerCase().includes('pf.gov.br');
      const target = isPolice ? 'la Policía Federal de Brasil' : 'el cliente';
      
      const prompt = `
        Eres un asistente formal de la empresa PLATAFORMA CUBANOS BR.
        Escribe un correo formal y profesional dirigido a ${target}.
        Nombre del cliente asociado: ${clientName}.
        Destinatario email: ${destinatario}.
        Contexto de los trámites actuales del cliente: ${JSON.stringify(tramitesContext || 'Sin trámites activos')}.
        
        Devuelve el resultado en JSON estricto con este formato:
        { "asunto": "Asunto corto", "cuerpo": "Cuerpo del correo en texto plano (puedes usar saltos de línea \\n)" }
      `;

      const response = await chat([{ role: 'system', content: prompt }]);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setAsunto(parsed.asunto || '');
        setCuerpo(parsed.cuerpo || '');
        toast.success('Correo generado', { id: toastId });
      } else {
        throw new Error("Respuesta de IA inválida");
      }
    } catch (error) {
      console.error('Error generating AI email:', error);
      toast.error('Error al generar con IA. Intenta de nuevo.', { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!asunto.trim() || !cuerpo.trim() || !destinatario.trim() || sending) return;

    setSending(true);
    const toastId = toast.loading('Enviando correo vía Gmail...');
    try {
      await sendGmailEmail({
        to: destinatario.trim(),
        subject: asunto.trim(),
        bodyText: cuerpo.trim()
      });

      setAsunto('');
      setCuerpo('');
      setAdjuntos([]);
      setComposeOpen(false);
      toast.success('Correo enviado correctamente', { id: toastId });
      fetchMessages();
    } catch (err) {
      console.error('Error sending email:', err);
      toast.error(err.message || 'Error al enviar correo', { id: toastId });
    } finally {
      setSending(false);
    }
  };

  const handleArchiveMessage = async (msgId, archivar = true) => {
    toast('El archivado en Gmail no está completamente soportado aquí aún', { icon: 'ℹ️' });
  };

  const handleDeleteMessage = async (msgId) => {
    toast('Eliminar en Gmail no está soportado en esta versión', { icon: 'ℹ️' });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (dataStr) {
        const data = JSON.parse(dataStr);
        if (data.type === 'media_library_item' || data.type === 'document_copy') {
          setAdjuntos(prev => [...prev, {
            url: data.url,
            nombre: data.nombre,
            tipo: data.tipo || 'application/pdf'
          }]);
        }
      }
    } catch (err) {
      console.error('Error parsing drop data:', err);
    }
  };

  const removeAdjunto = (index) => {
    setAdjuntos(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0, overflow: 'hidden', backgroundColor: '#FFFFFF', position: 'relative' }}>
      
      {/* Header tipo Gmail */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '220px' }}>
          <div style={{ color: '#D93025', display: 'flex', alignItems: 'center' }}>
            <Mail size={24} />
          </div>
          <span style={{ fontSize: '1.25rem', color: '#5F6368', fontFamily: 'sans-serif' }}>Gmail</span>
        </div>
        
        {/* Buscador funcional */}
        <div style={{ flex: 1, maxWidth: '600px', marginLeft: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F1F3F4', borderRadius: '8px', padding: '0.5rem 1rem' }}>
            <Search size={18} color="#5F6368" />
            <input 
              type="text"
              placeholder="Buscar correos del cliente (presiona Enter)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchMessages()}
              style={{ marginLeft: '0.75rem', color: '#202124', fontSize: '0.9rem', backgroundColor: 'transparent', border: 'none', outline: 'none', width: '100%' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Barra Lateral Izquierda */}
        <div style={{ width: '240px', padding: '1rem 0.5rem', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
          <div style={{ padding: '0 0.5rem' }}>
            <button 
              onClick={() => { setComposeOpen(true); setComposeMinimized(false); }}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#C2E7FF', color: '#001D35', 
                padding: '1rem', borderRadius: '16px', fontWeight: 500, fontSize: '0.9rem', border: 'none', cursor: 'pointer',
                marginBottom: '1.5rem', transition: 'box-shadow 0.2s', boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3)', width: '100%'
              }}
              onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 1px 3px 1px rgba(60,64,67,0.15)'}
              onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(60,64,67,0.3)'}
            >
              <Pencil size={20} /> Redactar
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div 
              onClick={() => { setView('list'); setCurrentTab('enviados'); setActiveMessage(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 1rem', backgroundColor: currentTab === 'enviados' ? '#D3E3FD' : 'transparent', color: currentTab === 'enviados' ? '#0B57D0' : '#444746', borderRadius: '0 16px 16px 0', fontWeight: currentTab === 'enviados' ? 600 : 500, fontSize: '0.85rem', cursor: 'pointer', marginRight: '0.5rem' }}
            >
              <Send size={18} /> Enviados
            </div>
            <div 
              onClick={() => { setView('list'); setCurrentTab('archivados'); setActiveMessage(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 1rem', backgroundColor: currentTab === 'archivados' ? '#D3E3FD' : 'transparent', color: currentTab === 'archivados' ? '#0B57D0' : '#444746', borderRadius: '0 16px 16px 0', fontWeight: currentTab === 'archivados' ? 600 : 500, fontSize: '0.85rem', cursor: 'pointer', marginRight: '0.5rem' }}
            >
              <Archive size={18} /> Archivados
            </div>

            {/* Sección de Automatizaciones (Plantillas) */}
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', paddingRight: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5F6368', letterSpacing: '0.5px' }}>
                  AUTOMATIZACIONES
                </span>
                <button 
                  onClick={() => setModalPlantillaOpen(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5F6368' }}
                  title="Nueva automatización"
                >
                  <Plus size={16} className="hover:text-gray-900" />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                {plantillas.map(plantilla => (
                  <div 
                    key={plantilla.id}
                    onClick={() => handleUsePlantilla(plantilla)}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.5rem 1rem', color: '#444746', borderRadius: '0 16px 16px 0', 
                      fontWeight: 500, fontSize: '0.8rem', cursor: 'pointer', marginRight: '0.5rem'
                    }}
                    className="hover:bg-gray-100 group"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                      <LayoutGrid size={16} style={{ flexShrink: 0, color: '#8AB4F8' }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plantilla.nombre}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDeletePlantilla(plantilla.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0 }}
                    >
                      <Trash2 size={14} className="hover:text-red-500" />
                    </button>
                  </div>
                ))}
                {plantillas.length === 0 && (
                  <div style={{ padding: '0.5rem 1rem', color: '#9CA3AF', fontSize: '0.75rem', fontStyle: 'italic' }}>
                    Toca el + para crear una plantilla.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contenido Central */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
          {/* Toolbar */}
          <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '1rem', color: '#444746' }}>
            {view === 'read' && (
              <button onClick={() => { setView('list'); setActiveMessage(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#444746', padding: '0.25rem', borderRadius: '50%' }} className="hover:bg-gray-100">
                <ArrowLeft size={18} />
              </button>
            )}
            {activeMessage && (
              <>
                <Archive 
                  size={18} 
                  className="cursor-pointer hover:text-gray-900" 
                  onClick={() => handleArchiveMessage(activeMessage.id, !activeMessage.archivado)} 
                  title={activeMessage.archivado ? "Desarchivar" : "Archivar"}
                />
                <Trash2 
                  size={18} 
                  className="cursor-pointer hover:text-gray-900" 
                  onClick={() => {
                    if (window.confirm("¿Estás seguro de eliminar este correo de forma permanente?")) {
                      handleDeleteMessage(activeMessage.id);
                    }
                  }} 
                  title="Eliminar"
                />
              </>
            )}
            <MoreVertical size={18} className="cursor-pointer hover:text-gray-900" onClick={() => toast('Más opciones próximamente')} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {view === 'list' ? (
              // Vista de Cuadrícula/Lista Mejorada
              loadingMessages ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#5F6368' }}><Loader2 size={24} className="animate-spin inline mr-2"/> Cargando...</div>
              ) : googleAuthError ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5F6368', gap: '1rem' }}>
                  <Mail size={48} color="#dadce0" />
                  <p>Para ver y enviar correos, conecta tu cuenta de Google.</p>
                  <button 
                    onClick={() => loginWithGoogle()}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '0.5rem', 
                      padding: '0.5rem 1rem', borderRadius: '4px', 
                      border: '1px solid #dadce0', backgroundColor: '#fff', 
                      color: '#3c4043', fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer'
                    }}
                  >
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ width: '18px', height: '18px' }}>
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                    Conectar con Google
                  </button>
                </div>
              ) : !searchQuery && messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#5F6368' }}>Ingresa un correo o término en el buscador para ver los mensajes.</div>
              ) : messages.filter(m => currentTab === 'archivados' ? m.archivado : !m.archivado).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#5F6368' }}>No hay correos {currentTab === 'archivados' ? 'archivados' : 'enviados'}.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {messages.filter(m => currentTab === 'archivados' ? m.archivado : !m.archivado).map(msg => (
                    <div 
                      key={msg.id} 
                      onClick={() => { setActiveMessage(msg); setView('read'); }}
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '40px 180px 1fr 100px', 
                        alignItems: 'center', 
                        padding: '0.6rem 1rem', 
                        borderBottom: '1px solid #E5E7EB',
                        cursor: 'pointer', 
                        backgroundColor: '#FFFFFF', 
                        color: '#202124', 
                        fontSize: '0.875rem',
                        gap: '0.5rem'
                      }}
                      className="group hover:bg-gray-50 hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_0_rgba(60,64,67,.15),0_1px_3px_1px_rgba(60,64,67,.05)] transition-all"
                    >
                      <div style={{ color: '#D1D5DB' }}>
                        <Star size={18} />
                      </div>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Para: {msg.destinatarios?.join(', ') || 'Cliente'}
                      </div>
                      <div style={{ display: 'flex', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600 }}>{msg.asunto || '(Sin asunto)'}</span>
                        <span style={{ color: '#6B7280' }}>- {msg.cuerpo?.substring(0, 100).replace(/\n/g, ' ')}</span>
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 500, fontSize: '0.75rem', color: '#6B7280' }}>
                        {new Date(msg.creado_en).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // Vista de Lectura
              activeMessage && (
                <div style={{ padding: '2rem' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 400, color: '#202124', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {activeMessage.asunto}
                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', backgroundColor: '#F1F3F4', borderRadius: '4px', color: '#5F6368' }}>Enviados</span>
                  </h2>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#188038', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                      <UserCircle size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: '#202124', fontSize: '0.85rem' }}>{activeMessage.operario || 'Agencia'}</span>
                          <span style={{ color: '#5F6368', fontSize: '0.75rem', marginLeft: '0.5rem' }}>&lt;{activeMessage.remitente || 'no-reply@agencia.com'}&gt;</span>
                        </div>
                        <div style={{ color: '#5F6368', fontSize: '0.75rem' }}>
                          {new Date(activeMessage.creado_en).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      </div>
                      <div style={{ color: '#5F6368', fontSize: '0.75rem', marginTop: '2px' }}>
                        para {activeMessage.destinatarios?.join(', ')}
                      </div>
                    </div>
                  </div>
                  <div style={{ color: '#202124', fontSize: '0.875rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', paddingLeft: '56px' }}>
                    {activeMessage.cuerpo}
                  </div>
                  {activeMessage.adjuntos && activeMessage.adjuntos.length > 0 && (
                    <div style={{ marginTop: '2rem', paddingLeft: '56px' }}>
                      <div style={{ fontSize: '0.85rem', color: '#5F6368', marginBottom: '0.5rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.5rem' }}>
                        {activeMessage.adjuntos.length} adjuntos
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {activeMessage.adjuntos.map((adj, i) => (
                          <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#FFFFFF' }}>
                            <div style={{ color: '#D93025' }}><Paperclip size={16} /></div>
                            <span style={{ fontSize: '0.8rem', color: '#202124', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adj.nombre}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Ventana de Redacción Flotante */}
      {composeOpen && (
        <div 
          style={{ 
            position: 'absolute', bottom: 0, right: '24px', width: '480px', 
            backgroundColor: '#FFFFFF', borderRadius: '8px 8px 0 0', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', zIndex: 100,
            height: composeMinimized ? '40px' : '480px',
            transition: 'height 0.2s ease-in-out'
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Header Compose */}
          <div style={{ backgroundColor: '#F2F6FC', padding: '0.5rem 1rem', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setComposeMinimized(!composeMinimized)}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#202124' }}>Mensaje nuevo</span>
            <div style={{ display: 'flex', gap: '0.5rem', color: '#5F6368' }}>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><Minimize2 size={16} /></button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }} onClick={(e) => { e.stopPropagation(); setComposeOpen(false); }}><X size={16} /></button>
            </div>
          </div>

          {/* Formulario Compose */}
          {!composeMinimized && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 1rem' }}>
              <div style={{ borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#5F6368', width: '40px', minWidth: '40px' }}>Para</span>
                <input 
                  type="email" 
                  value={destinatario}
                  onChange={e => setDestinatario(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  style={{ flex: 1, border: 'none', outline: 'none', padding: '0.5rem 0', fontSize: '0.85rem', color: '#202124', backgroundColor: 'transparent' }}
                />
              </div>
              <div style={{ borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Asunto"
                  value={asunto}
                  onChange={e => setAsunto(e.target.value)}
                  style={{ flex: 1, border: 'none', outline: 'none', padding: '0.5rem 0', fontSize: '0.85rem', color: '#202124', backgroundColor: 'transparent' }}
                />
              </div>
              <AutocompleteTextarea 
                value={cuerpo}
                onChange={e => setCuerpo(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', padding: '1rem 0', fontSize: '0.85rem', resize: 'none', color: '#202124', backgroundColor: 'transparent' }}
              />

              {/* Adjuntos */}
              {adjuntos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid #E5E7EB', padding: '0.5rem 0' }}>
                  {adjuntos.map((adj, index) => (
                    <div key={index} style={{ backgroundColor: '#F1F3F4', borderRadius: '16px', padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#202124', border: '1px solid #E5E7EB' }}>
                      <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adj.nombre}</span>
                      <X size={14} style={{ cursor: 'pointer', color: '#5F6368' }} onClick={() => removeAdjunto(index)} />
                    </div>
                  ))}
                </div>
              )}

              {/* Footer Compose */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderTop: '1px solid #E5E7EB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    onClick={handleSendEmail}
                    disabled={sending}
                    style={{ backgroundColor: '#0B57D0', color: 'white', border: 'none', borderRadius: '24px', padding: '0.5rem 1.5rem', fontSize: '0.85rem', fontWeight: 500, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}
                  >
                    {sending ? 'Enviando...' : 'Enviar'}
                  </button>
                  <button 
                    type="button" 
                    onClick={handleGenerateAI}
                    disabled={generating}
                    title="Autocompletar con IA"
                    style={{ background: 'none', border: 'none', cursor: generating ? 'not-allowed' : 'pointer', color: '#A142F4', display: 'flex', alignItems: 'center' }}
                  >
                    {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  </button>
                  <label 
                    style={{ color: '#5F6368', cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
                    title="Adjuntar archivo"
                  >
                    <input type="file" multiple style={{ display: 'none' }} onChange={(e) => {
                      const files = Array.from(e.target.files);
                      setAdjuntos([...adjuntos, ...files.map(f => ({ nombre: f.name, data: f }))]);
                      e.target.value = null; // reset
                    }} />
                    <Paperclip size={18} />
                  </label>
                </div>
                <Trash2 size={18} color="#5F6368" style={{ cursor: 'pointer' }} onClick={() => { setComposeOpen(false); setAsunto(''); setCuerpo(''); setAdjuntos([]); }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal para Crear Plantilla */}
      {modalPlantillaOpen && (
        <Modal 
          isOpen={true} 
          onClose={() => setModalPlantillaOpen(false)} 
          title="Crear Automatización de Correo"
        >
          <form onSubmit={handleCrearPlantilla} className="flex flex-col gap-4 py-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del botón / plantilla</label>
              <input 
                type="text" 
                required
                placeholder="Ej. Enviar a Policía Federal"
                value={nuevaPlantilla.nombre}
                onChange={e => setNuevaPlantilla({...nuevaPlantilla, nombre: e.target.value})}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destinatario por defecto (Opcional)</label>
              <input 
                type="email" 
                placeholder="ej. pf.gov.br o dejar en blanco para enviar al cliente"
                value={nuevaPlantilla.destinatario || ''}
                onChange={e => setNuevaPlantilla({...nuevaPlantilla, destinatario: e.target.value})}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asunto por defecto</label>
              <input 
                type="text" 
                required
                placeholder="Solicitud de información - CPF"
                value={nuevaPlantilla.asunto}
                onChange={e => setNuevaPlantilla({...nuevaPlantilla, asunto: e.target.value})}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cuerpo del correo</label>
              <AutocompleteTextarea 
                id="cuerpo-plantilla"
                required
                rows={5}
                placeholder="Estimados,\n\nSolicitamos el siguiente documento..."
                value={nuevaPlantilla.cuerpo}
                onChange={(e) => {
                  setNuevaPlantilla({...nuevaPlantilla, cuerpo: e.target.value});
                }}
              />
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <Button type="button" variant="ghost" onClick={() => setModalPlantillaOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={savingPlantilla}>
                {savingPlantilla ? 'Guardando...' : 'Guardar Plantilla'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
