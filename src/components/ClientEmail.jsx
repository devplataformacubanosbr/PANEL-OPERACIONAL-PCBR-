import React, { useState, useEffect } from 'react';
import { Mail, Send, Trash2, Loader2, Sparkles, Paperclip, X, Pencil, Star, Archive, Search, ArrowLeft, MoreVertical, Minimize2, UserCircle, Plus, LayoutGrid } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { chat } from '../services/aiService';
import { fetchClientEmails, sendGmailEmail, clearProviderToken, downloadAttachment } from '../services/gmailService';
import Modal from './ui/Modal';
import Button from './ui/Button';
import AutocompleteTextarea from './ui/AutocompleteTextarea';
import { useAuth } from '../features/auth/context/AuthContext';

export default function ClientEmail({ clientId, clientName, clientEmail, tramitesContext }) {
  const { loginWithGoogle, session } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [googleAuthError, setGoogleAuthError] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  
  // Gmail UI State
  const [view, setView] = useState('list'); // 'list' | 'read'
  const [currentTab, setCurrentTab] = useState('todos'); // 'todos' | 'enviados' | 'recibidos' | 'archivados'
  const [activeMessage, setActiveMessage] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [expandedMessages, setExpandedMessages] = useState({});
  const [quickReplyText, setQuickReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [client, setClient] = useState(null);
  
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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const checkAndLoad = async () => {
      const token = localStorage.getItem('google_provider_token') || session?.provider_token;
      if (session && !token) {
        setGoogleAuthError(true);
        setLoadingMessages(false);
        return false; // sin token
      } else if (clientId) {
        setGoogleAuthError(false);
        setSearchQuery('');
        fetchMessages('');
        fetchPlantillas();
        setDestinatario(clientEmail || '');
        
        try {
          const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', clientId)
            .single();
          if (!error && data) {
            setClient(data);
          }
        } catch (err) {
          console.error('Error fetching client details:', err);
        }
        
        return true; // con token
      }
      return false;
    };

    checkAndLoad();

    // Cuando el popup guarda el token, el evento 'storage' llega a esta ventana
    const handleStorage = (e) => {
      if (e.key === 'google_provider_token' && e.newValue) checkAndLoad();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('google_token_ready', checkAndLoad);

    // Polling de respaldo: cada 1.5s revisamos si el token ya apareció
    // Esto cubre el caso donde el evento storage no llega (mismo origen)
    const poll = setInterval(() => {
      const token = localStorage.getItem('google_provider_token');
      if (token) {
        clearInterval(poll);
        checkAndLoad();
      }
    }, 1500);

    return () => {
      clearInterval(poll);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('google_token_ready', checkAndLoad);
    };
  }, [clientId, clientEmail, session]);

  const fetchMessages = async (queryParam) => {
    const emailToSearch = queryParam !== undefined ? queryParam : searchQuery;
    setLoadingMessages(true);
    setGoogleAuthError(false);
    try {
      const emails = await fetchClientEmails(emailToSearch);
      console.log('[ClientEmail] Correos cargados:', emails.length);
      setMessages(emails);
    } catch (err) {
      console.error('[ClientEmail] Error cargando correos:', err.message);
      const isAuthError = err.message.includes('token') || err.message.includes('sesión') || err.message.includes('Google') || err.message.includes('expiró') || err.message.includes('conectar');
      if (isAuthError) {
        clearProviderToken();
        setGoogleAuthError(true);
      } else {
        toast.error(`Error Gmail: ${err.message}`);
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

  const handleDownloadAttachment = async (msgId, attachmentId, nombre, mimeType) => {
    const toastId = toast.loading(`Descargando ${nombre}...`);
    try {
      const base64url = await downloadAttachment(msgId, attachmentId);
      // Convert base64url to standard base64
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Descarga completada', { id: toastId });
    } catch (err) {
      console.error('Error al descargar adjunto:', err);
      toast.error('Error al descargar el archivo', { id: toastId });
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!asunto.trim() || !cuerpo.trim() || !destinatario.trim() || sending) return;

    setSending(true);
    const toastId = toast.loading('Procesando archivos adjuntos...');
    try {
      // Convertir archivos a base64
      const processedAdjuntos = [];
      for (const adj of adjuntos) {
        if (adj.data instanceof File) {
          const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              // result es "data:image/png;base64,iVBORw0..."
              const b64 = reader.result.split(',')[1];
              resolve(b64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(adj.data);
          });
          processedAdjuntos.push({
            nombre: adj.nombre,
            mimeType: adj.data.type || 'application/octet-stream',
            base64Data
          });
        }
      }

      toast.loading('Enviando correo vía Gmail...', { id: toastId });
      await sendGmailEmail({
        to: destinatario.trim(),
        subject: asunto.trim(),
        bodyText: cuerpo.trim(),
        adjuntos: processedAdjuntos
      });

      setAsunto('');
      setCuerpo('');
      setAdjuntos([]);
      setComposeOpen(false);
      toast.success('Correo enviado correctamente', { id: toastId });
      // Pequeña espera para que Gmail indexe el correo enviado
      setTimeout(() => fetchMessages(''), 1500);
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
            tipo: data.tipo || 'application/pdf',
            data: data.file // Assuming a File object is passed or we'll fetch it if needed
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

  // Grouping and filtering logic
  const filteredMessages = messages.filter(msg => {
    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        (msg.asunto || '').toLowerCase().includes(q) ||
        (msg.cuerpo || '').toLowerCase().includes(q) ||
        (msg.remitente || '').toLowerCase().includes(q) ||
        (msg.destinatario || '').toLowerCase().includes(q) ||
        (msg.destinatarios || []).some(d => d.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }

    if (currentTab === 'recibidos') {
      return msg.labelIds?.includes('INBOX');
    }
    if (currentTab === 'enviados') {
      return msg.labelIds?.includes('SENT');
    }
    if (currentTab === 'archivados') {
      return msg.archivado;
    }
    // 'todos'
    return true;
  });

  const threadsMap = {};
  filteredMessages.forEach(msg => {
    const tId = msg.threadId || msg.id;
    if (!threadsMap[tId]) {
      threadsMap[tId] = [];
    }
    threadsMap[tId].push(msg);
  });

  const sortedThreads = Object.keys(threadsMap).map(tId => {
    const threadMsgs = threadsMap[tId].sort((a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime());
    const latestMsg = threadMsgs[threadMsgs.length - 1];
    return {
      threadId: tId,
      messages: threadMsgs,
      latestMessage: latestMsg,
      creado_en: new Date(latestMsg.creado_en)
    };
  }).sort((a, b) => b.creado_en.getTime() - a.creado_en.getTime());

  const selectedThreadMessages = selectedThreadId ? (messages.filter(m => (m.threadId || m.id) === selectedThreadId).sort((a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime())) : [];

  const isMessageExpanded = (msgId, index, total) => {
    if (expandedMessages[msgId] !== undefined) {
      return expandedMessages[msgId];
    }
    return index === total - 1; // latest message is expanded by default
  };

  const toggleMessage = (msgId) => {
    setExpandedMessages(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const getSidebarStyle = (tabName) => {
    const isActive = currentTab === tabName;
    return {
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? '0.5rem' : '1rem',
      padding: isMobile ? '0.4rem 0.8rem' : '0.6rem 1rem',
      backgroundColor: isActive ? '#eaf1fb' : 'transparent', // #eaf1fb or #e8f0fe active background
      borderRadius: isMobile ? '16px' : '0 16px 16px 0',
      color: isActive ? '#0b57d0' : '#444746', // #0b57d0 active text color
      fontWeight: isActive ? 700 : 400,
      cursor: 'pointer',
      border: 'none',
      width: isMobile ? 'auto' : '95%',
      textAlign: 'left',
      fontSize: isMobile ? '0.8rem' : '0.875rem',
      transition: 'background-color 0.2s',
      whiteSpace: 'nowrap'
    };
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0, overflow: 'hidden', backgroundColor: '#FFFFFF', position: 'relative' }}>
      
      {/* Header tipo Gmail */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', gap: isMobile ? '0.5rem' : '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem', width: isMobile ? 'auto' : '220px' }}>
          <div style={{ color: '#D93025', display: 'flex', alignItems: 'center' }}>
            <Mail size={24} />
          </div>
          {!isMobile && <span style={{ fontSize: '1.25rem', color: '#5F6368', fontFamily: 'sans-serif' }}>Gmail</span>}
        </div>
        
        {/* Buscador funcional - Centered styling */}
        <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f1f3f4', borderRadius: '24px', padding: '0.6rem 1.5rem', width: '100%' }}>
            <Search size={18} color="#5F6368" style={{ marginRight: '0.75rem' }} />
            <input 
              type="text"
              placeholder="Buscar correos del cliente (presiona Enter)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchMessages()}
              style={{ color: '#202124', fontSize: '0.9rem', backgroundColor: 'transparent', border: 'none', outline: 'none', width: '100%' }}
            />
          </div>
        </div>

        <div style={{ width: '100px' }}></div>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, overflow: 'hidden' }}>
        {/* Barra Lateral Izquierda */}
        <div style={{ 
          width: isMobile ? '100%' : '240px', 
          display: isMobile && selectedThreadId ? 'none' : 'flex',
          padding: isMobile ? '0.5rem 1rem' : '1.5rem 0.5rem', 
          borderRight: isMobile ? 'none' : '1px solid #E5E7EB',
          borderBottom: isMobile ? '1px solid #E5E7EB' : 'none',
          flexDirection: isMobile ? 'row' : 'column',
          alignItems: isMobile ? 'center' : 'stretch',
          gap: isMobile ? '0.5rem' : 'initial',
          flexShrink: 0, 
          overflowY: 'auto' 
        }}>
          {/* Redactar Button */}
          <div style={{ padding: isMobile ? '0' : '0 0.5rem', flexShrink: 0 }}>
            <button 
              onClick={() => { setComposeOpen(true); setComposeMinimized(false); }}
              style={{ 
                display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem', backgroundColor: '#c2e7ff', color: '#001d35', 
                padding: isMobile ? '0.5rem 1rem' : '0.8rem 1.5rem', borderRadius: '24px', fontWeight: 500, fontSize: isMobile ? '0.85rem' : '0.9rem', border: 'none', cursor: 'pointer',
                marginBottom: isMobile ? '0' : '1.5rem', transition: 'box-shadow 0.2s, background-color 0.2s', boxShadow: '0 1px 3px 0 rgba(60,64,67,0.3)', width: isMobile ? 'auto' : '100%',
                justifyContent: 'center'
              }}
              className="hover:shadow-md hover:bg-opacity-90"
            >
              <Pencil size={isMobile ? 18 : 20} /> Redactar
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '0.25rem', overflowX: isMobile ? 'auto' : 'visible', flex: isMobile ? 1 : 'initial' }}>
            <button 
              onClick={() => { setCurrentTab('todos'); setSelectedThreadId(null); }}
              style={getSidebarStyle('todos')}
              className="hover:bg-gray-100 transition-colors"
            >
              <Mail size={18} /> Todos
            </button>
            <button
              onClick={() => { setCurrentTab('recibidos'); setSelectedThreadId(null); }}
              style={getSidebarStyle('recibidos')}
              className="hover:bg-gray-100 transition-colors"
            >
              <Mail size={18} /> Recibidos
            </button>
            <button
              onClick={() => { setCurrentTab('enviados'); setSelectedThreadId(null); }}
              style={getSidebarStyle('enviados')}
              className="hover:bg-gray-100 transition-colors"
            >
              <Send size={18} /> Enviados
            </button>
            <button 
              onClick={() => { setCurrentTab('archivados'); setSelectedThreadId(null); }}
              style={getSidebarStyle('archivados')}
              className="hover:bg-gray-100 transition-colors"
            >
              <Archive size={18} /> Archivados
            </button>

            {/* Sección de Automatizaciones (Plantillas) */}
            <div style={{ marginTop: isMobile ? '0' : '2rem', display: isMobile ? 'none' : 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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

        {/* Split-pane layout */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, overflow: 'hidden' }}>
          {/* Left pane: Scrollable list of email threads (40% width) */}
          <div style={{ 
            width: isMobile ? '100%' : '40%', 
            display: isMobile && selectedThreadId ? 'none' : 'flex',
            borderRight: '1px solid #E5E7EB', 
            flexDirection: 'column', 
            overflowY: 'auto', 
            backgroundColor: '#FFFFFF' 
          }}>
            
            {/* Tabs directly above the list */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', position: 'sticky', top: 0, zIndex: 10 }}>
              <button 
                onClick={() => { setCurrentTab('todos'); setSelectedThreadId(null); }}
                style={{ 
                  flex: 1,
                  padding: '1rem 0', 
                  border: 'none', 
                  background: 'none', 
                  cursor: 'pointer', 
                  fontWeight: currentTab === 'todos' ? 600 : 500,
                  color: currentTab === 'todos' ? '#0b57d0' : '#5f6368',
                  borderBottom: currentTab === 'todos' ? '3px solid #0b57d0' : '3px solid transparent',
                  fontSize: '0.875rem',
                  textAlign: 'center'
                }}
              >
                Todos
              </button>
              <button 
                onClick={() => { setCurrentTab('recibidos'); setSelectedThreadId(null); }}
                style={{ 
                  flex: 1,
                  padding: '1rem 0', 
                  border: 'none', 
                  background: 'none', 
                  cursor: 'pointer', 
                  fontWeight: currentTab === 'recibidos' ? 600 : 500,
                  color: currentTab === 'recibidos' ? '#0b57d0' : '#5f6368',
                  borderBottom: currentTab === 'recibidos' ? '3px solid #0b57d0' : '3px solid transparent',
                  fontSize: '0.875rem',
                  textAlign: 'center'
                }}
              >
                Recibidos
              </button>
              <button 
                onClick={() => { setCurrentTab('enviados'); setSelectedThreadId(null); }}
                style={{ 
                  flex: 1,
                  padding: '1rem 0', 
                  border: 'none', 
                  background: 'none', 
                  cursor: 'pointer', 
                  fontWeight: currentTab === 'enviados' ? 600 : 500,
                  color: currentTab === 'enviados' ? '#0b57d0' : '#5f6368',
                  borderBottom: currentTab === 'enviados' ? '3px solid #0b57d0' : '3px solid transparent',
                  fontSize: '0.875rem',
                  textAlign: 'center'
                }}
              >
                Enviados
              </button>
            </div>

            {/* Threads List */}
            {loadingMessages ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#5F6368' }}>
                <Loader2 size={24} className="animate-spin inline mr-2"/> Cargando correos...
              </div>
            ) : googleAuthError ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: '#5F6368', gap: '1rem' }}>
                <Mail size={48} color="#dadce0" />
                <p style={{ textAlign: 'center', fontSize: '0.875rem' }}>Conecta tu cuenta de Google para ver los correos.</p>
                <button 
                  onClick={() => loginWithGoogle()}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.5rem', 
                    padding: '0.5rem 1rem', borderRadius: '4px', 
                    border: '1px solid #dadce0', backgroundColor: '#fff', 
                    color: '#3c4043', fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer'
                  }}
                >
                  Conectar con Google
                </button>
              </div>
            ) : sortedThreads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#5F6368', fontSize: '0.875rem', fontStyle: 'italic' }}>
                No se encontraron conversaciones.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {sortedThreads.map(thread => {
                  const isSelected = selectedThreadId === thread.threadId;
                  const latestMsg = thread.latestMessage;
                  const isUnread = thread.messages.some(m => !m.leido);
                  const displaySender = latestMsg.remitente?.split('<')[0]?.trim() || latestMsg.remitente || 'Desconocido';
                  
                  return (
                    <div 
                      key={thread.threadId}
                      onClick={() => { setSelectedThreadId(thread.threadId); }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid #F1F3F4',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#e8f0fe' : '#FFFFFF', // Use E8F0FE or EAF1FB for highlights
                        fontSize: '0.875rem',
                        transition: 'background-color 0.2s',
                        position: 'relative'
                      }}
                      className="hover:bg-gray-50"
                    >
                      {/* Sender & Date */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: isUnread ? 700 : 500, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                          {displaySender}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: isUnread ? '#0b57d0' : '#5f6368', fontWeight: isUnread ? 600 : 400 }}>
                          {new Date(thread.creado_en).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      
                      {/* Subject & snippet */}
                      <div style={{ fontWeight: isUnread ? 600 : 400, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.15rem' }}>
                        {latestMsg.asunto || '(Sin asunto)'}
                      </div>
                      <div style={{ color: '#5f6368', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {latestMsg.cuerpo || ''}
                      </div>
                      
                      {/* Thread count badge if multiple messages */}
                      {thread.messages.length > 1 && (
                        <span style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', backgroundColor: '#F1F3F4', color: '#5f6368', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px' }}>
                          {thread.messages.length}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right pane: Reading pane / conversational thread view (60% width) */}
          <div style={{ 
            width: isMobile ? '100%' : '60%', 
            display: isMobile && !selectedThreadId ? 'none' : 'flex',
            flexDirection: 'column', 
            overflowY: 'auto', 
            backgroundColor: '#FFFFFF', 
            borderLeft: '1px solid #E5E7EB' 
          }}>
            {!selectedThreadId ? (
              /* Empty State */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#5F6368', gap: '1rem', padding: '2rem' }}>
                <Mail size={64} style={{ color: '#DADCE0' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 500, color: '#3C4043' }}>Selecciona una conversación para leerla</h3>
                <p style={{ fontSize: '0.875rem', color: '#70757A', textAlign: 'center' }}>Haz clic en un correo de la lista de la izquierda para ver su historial de mensajes completo.</p>
              </div>
            ) : (
              /* Reading Thread View */
              (() => {
                const threadMsgs = selectedThreadMessages;
                if (threadMsgs.length === 0) return null;
                const subject = threadMsgs[0].asunto || '(Sin asunto)';
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
                    
                    {/* Thread header */}
                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 400, color: '#202124', margin: 0 }}>
                        {subject}
                      </h2>
                      <div style={{ display: 'flex', gap: '0.75rem', color: '#5F6368' }}>
                        <button 
                          onClick={() => { setSelectedThreadId(null); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                          title="Cerrar vista"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Messages Stack */}
                    <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#F8F9FA' }}>
                      {threadMsgs.map((msg, index) => {
                        const expanded = isMessageExpanded(msg.id, index, threadMsgs.length);
                        const senderName = msg.remitente?.split('<')[0]?.replace(/"/g, '')?.trim() || msg.remitente || 'Desconocido';
                        const dateStr = new Date(msg.creado_en).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                        
                        return (
                          <div 
                            key={msg.id}
                            style={{ 
                              border: '1px solid #E0E0E0', 
                              borderRadius: '8px', 
                              backgroundColor: '#FFFFFF',
                              boxShadow: expanded ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Message Card Header */}
                            <div 
                              onClick={() => toggleMessage(msg.id)}
                              style={{ 
                                padding: '0.75rem 1rem', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                cursor: 'pointer',
                                backgroundColor: expanded ? '#FFFFFF' : '#F1F3F4',
                                borderBottom: expanded ? '1px solid #F1F3F4' : 'none',
                                transition: 'background-color 0.2s'
                              }}
                              className="hover:bg-gray-100"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden', width: '75%' }}>
                                <div style={{ 
                                  width: '32px', 
                                  height: '32px', 
                                  borderRadius: '50%', 
                                  backgroundColor: msg.es_enviado ? '#E8F0FE' : '#E6F4EA',
                                  color: msg.es_enviado ? '#1A73E8' : '#137333',
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  fontWeight: 600,
                                  fontSize: '0.85rem',
                                  flexShrink: 0
                                }}>
                                  {senderName.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#202124' }}>
                                    {senderName}
                                  </span>
                                  {!expanded && (
                                    <span style={{ fontSize: '0.8rem', color: '#5F6368', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                      {msg.cuerpo?.substring(0, 80)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#5F6368', fontSize: '0.75rem' }}>
                                <span>{dateStr}</span>
                              </div>
                            </div>
                            
                            {/* Message Card Body */}
                            {expanded && (
                              <div style={{ padding: '1rem 1rem 1.5rem 1rem' }}>
                                {/* Expanded headers */}
                                <div style={{ fontSize: '0.8rem', color: '#5F6368', marginBottom: '1rem', borderBottom: '1px solid #F1F3F4', paddingBottom: '0.5rem' }}>
                                  <div><strong>De:</strong> {msg.remitente}</div>
                                  {msg.destinatario && <div><strong>Para:</strong> {msg.destinatarios?.join(', ') || msg.destinatario}</div>}
                                </div>
                                
                                {/* Text Body */}
                                <div style={{ 
                                  fontSize: '0.875rem', 
                                  color: '#202124', 
                                  lineHeight: '1.6', 
                                  whiteSpace: 'pre-wrap',
                                  fontFamily: 'sans-serif' 
                                }}>
                                  {msg.cuerpo}
                                </div>
                                
                                {/* Attachments */}
                                {msg.adjuntos && msg.adjuntos.length > 0 && (
                                  <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #F1F3F4' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5F6368', marginBottom: '0.5rem' }}>
                                      {msg.adjuntos.length} {msg.adjuntos.length === 1 ? 'adjunto' : 'adjuntos'}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                      {msg.adjuntos.map((adj, i) => (
                                        <div 
                                          key={i} 
                                          onClick={() => handleDownloadAttachment(msg.id, adj.attachmentId, adj.nombre, adj.mimeType)}
                                          style={{ 
                                            border: '1px solid #E0E0E0', 
                                            borderRadius: '4px', 
                                            padding: '0.4rem 0.75rem', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '0.5rem', 
                                            backgroundColor: '#F8F9FA',
                                            cursor: 'pointer'
                                          }}
                                          className="hover:bg-gray-100 transition-colors"
                                          title={`Descargar ${adj.nombre}`}
                                        >
                                          <Paperclip size={14} style={{ color: '#5F6368' }} />
                                          <span style={{ fontSize: '0.75rem', color: '#3C4043', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {adj.nombre}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Embedded Quick-reply Box */}
                    {(() => {
                      const latestMsg = threadMsgs[threadMsgs.length - 1];
                      let replyTo = '';
                      if (latestMsg.es_enviado) {
                        // Si el último correo lo enviamos nosotros, respondemos al destinatario de ese correo
                        replyTo = latestMsg.destinatarios?.[0] || latestMsg.destinatario || clientEmail || '';
                      } else {
                        // Si el último correo lo recibimos, respondemos al remitente
                        replyTo = latestMsg.remitente;
                      }

                      return (
                        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid #DADCE0', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#5F6368' }}>
                              Respuesta rápida para <strong>{replyTo}</strong>
                            </span>
                            <textarea
                              rows={3}
                              placeholder="Escribe una respuesta rápida..."
                              value={quickReplyText}
                              onChange={(e) => setQuickReplyText(e.target.value)}
                              style={{
                                border: 'none',
                                outline: 'none',
                                resize: 'none',
                                width: '100%',
                                fontSize: '0.875rem',
                                color: '#202124',
                                backgroundColor: 'transparent'
                              }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F3F4', paddingTop: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <button
                                  onClick={async () => {
                                    if (!quickReplyText.trim() || sendingReply) return;
                                    setSendingReply(true);
                                    const toastId = toast.loading('Enviando respuesta...');
                                    try {
                                      const repSubject = latestMsg.asunto.toLowerCase().startsWith('re:') ? latestMsg.asunto : `Re: ${latestMsg.asunto}`;
                                      
                                      await sendGmailEmail({
                                        to: replyTo,
                                        subject: repSubject,
                                        bodyText: quickReplyText.trim()
                                      });
                                  
                                  setQuickReplyText('');
                                  toast.success('Respuesta enviada', { id: toastId });
                                  setTimeout(() => fetchMessages(clientEmail), 1500);
                                } catch (err) {
                                  console.error('Error sending reply:', err);
                                  toast.error(err.message || 'Error al enviar respuesta', { id: toastId });
                                } finally {
                                  setSendingReply(false);
                                }
                              }}
                              disabled={!quickReplyText.trim() || sendingReply}
                              style={{
                                backgroundColor: '#0b57d0',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '18px',
                                padding: '0.4rem 1.25rem',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                cursor: (!quickReplyText.trim() || sendingReply) ? 'not-allowed' : 'pointer',
                                opacity: (!quickReplyText.trim() || sendingReply) ? 0.7 : 1
                              }}
                            >
                              {sendingReply ? 'Enviando...' : 'Enviar'}
                            </button>
                            
                            <button
                              onClick={async () => {
                                setSendingReply(true);
                                const toastId = toast.loading('Generando respuesta con IA...');
                                try {
                                  const latestMsg = threadMsgs[threadMsgs.length - 1];
                                  const prompt = `
                                    Eres un asistente formal de la empresa PLATAFORMA CUBANOS BR.
                                    Escribe una respuesta corta, formal y profesional para el correo recibido de ${clientName}.
                                    Asunto del correo recibido: ${latestMsg.asunto}
                                    Cuerpo del correo recibido: ${latestMsg.cuerpo}
                                    
                                    Devuelve únicamente la respuesta formal en texto plano.
                                  `;
                                  const response = await chat([{ role: 'system', content: prompt }]);
                                  setQuickReplyText(response.trim());
                                  toast.success('Respuesta generada', { id: toastId });
                                } catch (error) {
                                  console.error('Error generating AI reply:', error);
                                  toast.error('Error al generar respuesta', { id: toastId });
                                } finally {
                                  setSendingReply(false);
                                }
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#A142F4',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.25rem',
                                borderRadius: '50%'
                              }}
                              className="hover:bg-purple-50"
                              title="Generar respuesta con IA"
                            >
                              <Sparkles size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* Ventana de Redacción Flotante */}
      {composeOpen && (
        <div 
          style={{ 
            position: 'absolute', bottom: 0, right: isMobile ? 0 : '24px', left: isMobile ? 0 : 'auto', width: isMobile ? '100%' : '480px', 
            backgroundColor: '#FFFFFF', borderRadius: isMobile ? '12px 12px 0 0' : '8px 8px 0 0', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', zIndex: 100,
            height: composeMinimized ? '40px' : (isMobile ? '90%' : '480px'),
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
                      if (files.length > 0) {
                        const validFiles = files.filter(f => f.size <= 20971520); // 20 MB
                        if (validFiles.length < files.length) {
                          toast.error('Algunos archivos superan el límite de 20MB y fueron omitidos.');
                        }
                        if (validFiles.length > 0) {
                          setAdjuntos([...adjuntos, ...validFiles.map(f => ({ nombre: f.name, data: f }))]);
                        }
                      }
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
