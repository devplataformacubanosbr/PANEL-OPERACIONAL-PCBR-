import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MessageCircle, Send, CheckCircle2, ArrowLeft, Search, User, X, File, Loader2, Paperclip, Smile, Mic, Trash2, Pause, Play, Download, Bot } from 'lucide-react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import { extractFunctionErrorMessage } from '../utils/errorHandler';
import WhatsAppMediaContent from './WhatsAppMediaContent';
import AutocompleteTextarea from './ui/AutocompleteTextarea';

export default function ClientWhatsApp({ clientId, telefono, idKommo }) {
  const [view, setView] = useState('chat'); // 'chat' | 'list'
  const [activeChatId, setActiveChatId] = useState(clientId);
  const [activeChatPhone, setActiveChatPhone] = useState(telefono);
  const [activeChatName, setActiveChatName] = useState('Cliente Actual');
  
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Bot Auto-Reply states
  const [botActivo, setBotActivo] = useState(false);
  const [loadingBot, setLoadingBot] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);

  // Audio Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const shouldSendRef = useRef(false);

  // Drag & Drop Media states
  const [isDragOverChat, setIsDragOverChat] = useState(false);
  const [mediaToSend, setMediaToSend] = useState([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  // List view states
  const [recentChats, setRecentChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Preview Media state
  const [previewMedia, setPreviewMedia] = useState(null);

  // Helper to safely determine media type
  const getMediaType = (msg) => {
    if (msg.media_type && msg.media_type !== 'application/octet-stream') return msg.media_type;
    const url = (msg.media_url || '').toLowerCase();
    const name = (msg.media_name || '').toLowerCase();
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/) || name.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'image/jpeg';
    if (url.match(/\.(mp4|mov|webm)$/) || name.match(/\.(mp4|mov|webm)$/)) return 'video/mp4';
    if (url.match(/\.(mp3|wav|ogg|m4a)$/) || name.match(/\.(mp3|wav|ogg|m4a)$/)) return 'audio/mpeg';
    if (url.match(/\.(pdf)$/) || name.match(/\.(pdf)$/)) return 'application/pdf';
    return msg.media_type || 'application/octet-stream';
  };

  // Reset to default client when main dashboard navigates
  useEffect(() => {
    setActiveChatId(clientId);
    setActiveChatPhone(telefono);
    setActiveChatName('Cliente Actual');
    setView('chat');
  }, [clientId, telefono]);

  const cleanPhone = useMemo(() => {
    if (!activeChatPhone) return '';
    return activeChatPhone.replace(/\D/g, '');
  }, [activeChatPhone]);

  // Fetch messages for active chat
  const fetchMessages = async () => {
    if (!activeChatId) return;
    try {
      const query = supabase.from('mensajes').select('*');
      
      if (cleanPhone) {
        query.or(`cliente_id.eq.${activeChatId},telefono.eq.${cleanPhone}`);
      } else {
        query.eq('cliente_id', activeChatId);
      }
      
      const { data, error } = await query.order('fecha_recepcion', { ascending: true });

      if (error) throw error;
      
      const filtered = (data || []).filter(n => {
        if (n.media_url) return true;
        return !n.texto?.includes('mensagem de mídia') && !n.texto?.includes('mensagem de media');
      });
      
      const uniqueMessages = [];
      const recentOutgoing = [];
      
      filtered.forEach(msg => {
        if (msg.remitente === 'outgoing') {
          const msgTime = new Date(msg.fecha_recepcion || Date.now()).getTime();
          const text = msg.texto?.trim();
          
          const isDuplicate = recentOutgoing.some(r => 
            r.text === text && Math.abs(msgTime - r.time) < 120000
          );
          
          if (!isDuplicate) {
            recentOutgoing.push({ text, time: msgTime });
            uniqueMessages.push(msg);
          }
        } else {
          uniqueMessages.push(msg);
        }
      });
      
      setMessages(uniqueMessages);
    } catch (err) {
      console.error('Error fetching whatsapp messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (view === 'chat' && activeChatId) {
      setLoadingMessages(true);
      fetchMessages();
    }
  }, [activeChatId, view, cleanPhone]);

  // Fetch bot_activo state
  useEffect(() => {
    if (!activeChatId) return;
    const fetchBotState = async () => {
      try {
        const { data, error } = await supabase.from('clientes').select('bot_activo').eq('id', activeChatId).single();
        if (!error && data) {
          setBotActivo(data.bot_activo || false);
        }
      } catch (err) {
        console.error('Error fetching bot state:', err);
      }
    };
    fetchBotState();
  }, [activeChatId]);

  const handleToggleBot = async () => {
    setLoadingBot(true);
    try {
      const newVal = !botActivo;
      const { error } = await supabase.from('clientes').update({ bot_activo: newVal }).eq('id', activeChatId);
      if (error) throw error;
      setBotActivo(newVal);
      toast.success(`Modo Bot ${newVal ? 'Activado' : 'Desactivado'}`);
    } catch (err) {
      console.error('Error toggling bot:', err);
      toast.error('Error al cambiar modo bot');
    } finally {
      setLoadingBot(false);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('global_whatsapp_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes' }, (payload) => {
        const newRow = payload.new;
        if (!newRow) return;

        if (view === 'list' && !searchQuery) {
          fetchRecentChats();
        } else if (view === 'chat') {
          const isCurrentChat = 
            String(newRow.cliente_id) === String(activeChatId) || 
            (cleanPhone && String(newRow.telefono) === String(cleanPhone));
            
          if (isCurrentChat) {
            if (payload.eventType === 'INSERT') {
              setMessages(prev => {
                // Evitar duplicados por id
                if (prev.some(m => m.id === newRow.id)) return prev;
                
                // Reemplazar mensaje temporal optimista si existe
                const tempMsgIndex = prev.findIndex(m => 
                  m.texto === newRow.texto && 
                  String(m.id).startsWith('temp-')
                );

                if (tempMsgIndex >= 0) {
                  const newMessages = [...prev];
                  newMessages[tempMsgIndex] = newRow;
                  return newMessages;
                }

                // Evitar duplicados si n8n hace eco del mismo mensaje saliente (mismo texto y ventana de 2 minutos)
                if (newRow.remitente === 'outgoing') {
                  const newTime = new Date(newRow.fecha_recepcion || Date.now()).getTime();
                  const isDuplicate = prev.some(m => {
                    if (m.id === newRow.id || m.remitente !== 'outgoing' || m.texto?.trim() !== newRow.texto?.trim()) return false;
                    const mTime = new Date(m.fecha_recepcion || Date.now()).getTime();
                    return Math.abs(newTime - mTime) < 120000;
                  });
                  if (isDuplicate) return prev;
                }

                // Si no, simplemente lo agregamos al final
                return [...prev, newRow];
              });
            } else {
              // Para updates o deletes re-pedimos todo para mantener la sencillez
              fetchMessages();
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [view, searchQuery, activeChatId, cleanPhone]);

  useEffect(() => {
    if (messagesEndRef.current && view === 'chat') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, view]);

  // Fetch recent chats list
  const fetchRecentChats = async () => {
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('mensajes')
        .select(`
          cliente_id,
          texto,
          fecha_recepcion,
          remitente,
          clientes ( nombre, telefono )
        `)
        .order('fecha_recepcion', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Group by cliente_id to get only the latest message
      const grouped = [];
      const seen = new Set();
      
      for (const msg of data) {
        if (!seen.has(msg.cliente_id) && msg.clientes) {
          seen.add(msg.cliente_id);
          grouped.push(msg);
        }
      }

      setRecentChats(grouped);
    } catch (err) {
      console.error('Error fetching recent chats:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (view === 'list' && !searchQuery) {
      fetchRecentChats();
    }
  }, [view, searchQuery]);

  // Search contacts
  useEffect(() => {
    if (searchQuery.trim().length > 2) {
      const searchContacts = async () => {
        setLoadingList(true);
        try {
          const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .ilike('nombre', `%${searchQuery}%`)
            .limit(20);

          if (error) throw error;
          
          // Extraemos el teléfono de datos_extra si existe
          const parsedData = (data || []).map(c => ({
            id: c.id,
            nombre: c.nombre,
            telefono: c.telefono || (c.datos_extra ? c.datos_extra.telefono : null)
          }));
          
          setSearchResults(parsedData);
        } catch (err) {
          console.error('Search error:', err);
        } finally {
          setLoadingList(false);
        }
      };
      
      // Debounce search
      const timer = setTimeout(() => {
        searchContacts();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const onEmojiClick = (emojiObject) => {
    setNewMessage(prev => prev + emojiObject.emoji);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newMediaList = [];
    let processed = 0;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newMediaList.push({
          url: event.target.result,
          nombre: file.name,
          tipo: file.type || 'document'
        });
        processed++;
        if (processed === files.length) {
          setMediaToSend(prev => [...prev, ...newMediaList]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    setShowEmojiPicker(false);
    const texto = newMessage.trim();
    try {
      const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
        body: { cliente_id: activeChatId, texto }
      });
      if (error) throw new Error(await extractFunctionErrorMessage(error));
      if (data?.error) throw new Error(data.error);

      const outgoingMsg = {
        id: 'temp-' + Date.now(),
        cliente_id: activeChatId,
        texto,
        remitente: 'outgoing',
        fecha_recepcion: new Date().toISOString()
      };

      // Actualización optimista de la UI; la edge function ya insertó el
      // registro real en `mensajes` — el canal de realtime lo trae y
      // reemplaza este mensaje temporal.
      setMessages(prev => [...prev, outgoingMsg]);
      setNewMessage('');
      toast.success('Mensaje enviado');
    } catch (err) {
      console.error('Error enviando mensaje:', err);
      toast.error('Error al enviar mensaje: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const sendMediaToApi = async (mediaObj) => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          cliente_id: activeChatId,
          media_url: mediaObj.url,
          media_type: mediaObj.tipo,
          media_name: mediaObj.nombre
        }
      });
      if (error) throw new Error(await extractFunctionErrorMessage(error));
      if (data?.error) throw new Error(data.error);

      const isAudio = mediaObj.tipo?.startsWith('audio/');
      const outgoingMsg = {
        id: 'temp-media-' + Date.now(),
        cliente_id: activeChatId,
        texto: `[${isAudio ? 'Audio' : 'Archivo'} enviado] ${mediaObj.nombre}`,
        remitente: 'outgoing',
        fecha_recepcion: new Date().toISOString(),
        media_url: mediaObj.url,
        media_name: mediaObj.nombre,
        media_type: mediaObj.tipo
      };

      // Actualización optimista de la UI; la edge function ya insertó el
      // registro real en `mensajes` — el canal de realtime lo trae y
      // reemplaza este mensaje temporal.
      setMessages(prev => [...prev, outgoingMsg]);
      toast.success(`${isAudio ? 'Audio' : 'Archivo'} enviado con éxito`);
    } catch (err) {
      console.error('Error enviando archivo:', err);
      toast.error('Error al enviar archivo: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSendMedia = async () => {
    if (mediaToSend.length === 0 || sending) return;
    const mediaToProcess = [...mediaToSend];
    setMediaToSend([]);
    setActivePreviewIndex(0);
    
    for (const media of mediaToProcess) {
      await sendMediaToApi(media);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverChat(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverChat(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverChat(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const newMediaList = [];
      let processed = 0;

      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          newMediaList.push({
            url: event.target.result,
            nombre: file.name,
            tipo: file.type || 'document'
          });
          processed++;
          if (processed === files.length) {
            setMediaToSend(prev => [...prev, ...newMediaList]);
          }
        };
        reader.readAsDataURL(file);
      });
      return;
    }

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (dataStr) {
        const data = JSON.parse(dataStr);
        if (data.type === 'media_library_item' || data.type === 'document_copy') {
          setMediaToSend(prev => [...prev, {
            url: data.url,
            nombre: data.nombre,
            tipo: data.tipo || 'document'
          }]);
        }
      }
    } catch (err) {
      console.error('Error parsing drop data:', err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      shouldSendRef.current = false;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (shouldSendRef.current && audioChunksRef.current.length > 0) {
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const reader = new FileReader();
          reader.onload = async (event) => {
            const audioObj = {
              url: event.target.result,
              nombre: `Audio_${new Date().getTime()}.ogg`,
              tipo: mimeType
            };
            // Enviar inmediatamente el audio
            await sendMediaToApi(audioObj);
          };
          reader.readAsDataURL(audioBlob);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast.error('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(recordingTimerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = (cancel = false) => {
    if (mediaRecorderRef.current && isRecording) {
      shouldSendRef.current = !cancel;
      if (cancel) {
        audioChunksRef.current = [];
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const openChat = (id, phone, name) => {
    setActiveChatId(id);
    setActiveChatPhone(phone);
    setActiveChatName(name || 'Cliente');
    setView('chat');
  };

  const handleDeleteMessage = async (messageId) => {
    const previousMessages = messages;
    setMessages(prev => prev.filter(m => m.id !== messageId));

    const { error } = await supabase.from('mensajes').delete().eq('id', messageId);
    if (error) {
      console.error('Error eliminando mensaje:', error);
      toast.error('No se pudo eliminar el mensaje: ' + error.message);
      setMessages(previousMessages);
    }
  };

  const renderMessages = useMemo(() => {
    if (loadingMessages) {
      return (
        <div style={{ textAlign: 'center', background: 'var(--color-bg-canvas)', border: '1px solid var(--color-border)', padding: '0.5rem', borderRadius: '12px', alignSelf: 'center', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
          Cargando historial...
        </div>
      );
    }
    if (messages.length === 0) {
      return (
        <div style={{ textAlign: 'center', background: 'var(--color-bg-canvas)', border: '1px solid var(--color-border)', padding: '0.5rem 1rem', borderRadius: '12px', alignSelf: 'center', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          Inicia la conversación. Los mensajes aparecerán aquí.
        </div>
      );
    }
    return messages.map(msg => {
      const isIncoming = !msg.remitente || msg.remitente === 'incoming';
      const safeMediaType = getMediaType(msg);

      return (
        <div key={msg.id} style={{
          alignSelf: isIncoming ? 'flex-start' : 'flex-end',
          background: isIncoming ? 'var(--color-bg-elevated)' : 'var(--color-primary)',
          color: isIncoming ? 'var(--color-text-primary)' : '#ffffff',
          padding: '0.5rem 0.75rem',
          borderRadius: '8px',
          borderTopLeftRadius: isIncoming ? '0' : '8px',
          borderTopRightRadius: !isIncoming ? '0' : '8px',
          maxWidth: '85%',
          boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <WhatsAppMediaContent msg={msg} safeMediaType={safeMediaType} setPreviewMedia={setPreviewMedia} />
          <span style={{ fontSize: '0.9rem', lineHeight: '1.3', whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text' }}>
            {msg.texto}
          </span>
          <span style={{ fontSize: '0.65rem', color: isIncoming ? 'var(--color-text-muted)' : 'rgba(255,255,255,0.7)', marginTop: '4px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
            <Trash2 size={13} color={isIncoming ? 'var(--color-error)' : 'rgba(255,255,255,0.7)'} style={{ cursor: 'pointer', opacity: 0.6 }} onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6} onClick={() => handleDeleteMessage(msg.id)} title="Eliminar mensaje" />
            <span>{new Date(msg.fecha_recepcion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </span>
        </div>
      );
    });
  }, [messages, loadingMessages]);

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
      
      {/* -------------------- VIEW: CHAT LIST -------------------- */}
      {view === 'list' && (
        <>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-canvas)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageCircle size={18} /> Bandeja de Entrada
            </h3>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Buscar por nombre o teléfono..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.2rem', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', fontSize: '0.85rem' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg-canvas)' }}>
            {loadingList ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>Cargando contactos...</div>
            ) : searchQuery.length > 2 ? (
              // Search Results
              searchResults.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>No se encontraron clientes.</div>
              ) : (
                searchResults.map(c => (
                  <div key={c.id} onClick={() => openChat(c.id, c.telefono, c.nombre)} style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', gap: '1rem', alignItems: 'center', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--color-bg-elevated)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.nombre}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{c.telefono || 'Sin teléfono'}</p>
                    </div>
                  </div>
                ))
              )
            ) : (
              // Recent Chats List
              recentChats.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>No hay conversaciones recientes.</div>
              ) : (
                recentChats.map(c => (
                  <div key={c.cliente_id} onClick={() => openChat(c.cliente_id, c.clientes?.telefono, c.clientes?.nombre)} style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', gap: '1rem', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--color-bg-elevated)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <User size={24} />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.clientes?.nombre || 'Desconocido'}
                        </h4>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                          {new Date(c.fecha_recepcion).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.remitente === 'outgoing' ? 'Tú: ' : ''}{c.texto}
                      </p>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </>
      )}

      {/* -------------------- VIEW: ACTIVE CHAT -------------------- */}
      {view === 'chat' && (
        <>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--color-bg-canvas)' }}>
            <button onClick={() => setView('list')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ background: '#25D366', color: 'white', padding: '0.4rem', borderRadius: '50%' }}>
              <MessageCircle size={18} />
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeChatId === clientId ? 'Cliente Actual' : activeChatName}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {cleanPhone ? `+${cleanPhone}` : 'Sin teléfono'}
                {cleanPhone && <CheckCircle2 size={12} color="#25D366" />}
              </span>
            </div>
            
            {/* BOT TOGGLE */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem', borderRadius: '16px', background: botActivo ? 'rgba(37, 211, 102, 0.1)' : 'transparent' }}>
              <Bot size={16} color={botActivo ? '#25D366' : 'var(--color-text-muted)'} />
              <span style={{ fontSize: '0.8rem', color: botActivo ? '#25D366' : 'var(--color-text-muted)', fontWeight: 600 }}>Copiloto</span>
              <button 
                onClick={handleToggleBot}
                disabled={loadingBot}
                style={{
                  width: '36px', height: '20px', borderRadius: '10px',
                  background: botActivo ? '#25D366' : 'var(--color-border)',
                  border: 'none', position: 'relative', cursor: 'pointer', transition: 'background 0.3s',
                  opacity: loadingBot ? 0.5 : 1
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px', left: botActivo ? '18px' : '2px',
                  width: '16px', height: '16px', borderRadius: '50%', background: 'white',
                  transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>
          </div>

          <div 
            style={{ 
              flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', 
              background: 'var(--color-bg-primary)', backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png")', backgroundSize: '400px', backgroundRepeat: 'repeat', opacity: 0.9,
              position: 'relative'
            }}
            onClick={() => setShowEmojiPicker(false)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {renderMessages}
            <div ref={messagesEndRef} />
          </div>

          {showEmojiPicker && (
            <div style={{ position: 'absolute', bottom: '70px', left: '10px', zIndex: 50 }}>
              <EmojiPicker onEmojiClick={onEmojiClick} width={300} height={400} />
            </div>
          )}
          <form onSubmit={handleSendMessage} style={{ padding: '0.75rem', background: 'var(--surface-base)', display: 'flex', gap: '0.5rem', alignItems: 'center', borderTop: '1px solid var(--color-border)' }}>
            {isRecording ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--color-bg-canvas)', padding: '0.75rem 1rem', borderRadius: '24px', border: '1px solid var(--color-border)' }}>
                <div className={isPaused ? "" : "animate-pulse"} style={{ color: isPaused ? 'var(--color-text-muted)' : 'var(--color-danger)', display: 'flex', alignItems: 'center' }}>
                  <Mic size={20} />
                </div>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontSize: '0.95rem' }}>
                  {isPaused ? 'Pausado...' : 'Grabando...'} {formatTime(recordingTime)}
                </span>
                <div style={{ flex: 1 }} />
                
                <button
                  type="button"
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-info)', cursor: 'pointer', display: 'flex', padding: '0.4rem', transition: 'color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                  onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-info)'}
                  title={isPaused ? "Reanudar" : "Pausar"}
                >
                  {isPaused ? <Play size={20} /> : <Pause size={20} />}
                </button>

                <button
                  type="button"
                  onClick={() => stopRecording(true)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', padding: '0.4rem', transition: 'color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                  onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
                  title="Cancelar"
                >
                  <Trash2 size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => stopRecording(false)}
                  style={{ background: '#25D366', color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  title="Detener y enviar"
                >
                  <CheckCircle2 size={20} />
                </button>
              </div>
            ) : (
              <>
                <button 
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  disabled={!cleanPhone || sending}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', padding: '0.4rem' }}
                >
                  <Smile size={24} />
                </button>

                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!cleanPhone || sending}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', padding: '0.4rem' }}
                >
                  <Paperclip size={24} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handleFileSelect} 
                  accept="*/*"
                  multiple
                />

                <AutocompleteTextarea 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={cleanPhone ? "Escribe un mensaje..." : "Añade un teléfono para chatear"} 
                  disabled={!cleanPhone || sending}
                  rows={Math.min(6, Math.max(1, newMessage.split('\n').length + Math.floor(newMessage.length / 60)))}
                  style={{ 
                    flex: 1, 
                    padding: '0.75rem 1rem', 
                    borderRadius: '20px', 
                    border: '1px solid var(--color-border)', 
                    background: 'var(--color-bg-canvas)', 
                    color: 'var(--color-text-primary)', 
                    outline: 'none', 
                    fontSize: '0.95rem',
                    resize: 'none',
                    fontFamily: 'inherit',
                    lineHeight: '1.4',
                    overflowY: 'auto'
                  }}
                />
                
                {newMessage.trim() ? (
                  <button 
                    type="submit"
                    disabled={!cleanPhone || sending} 
                    style={{ background: '#25D366', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={20} style={{ marginLeft: '2px' }} />}
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={startRecording}
                    disabled={!cleanPhone || sending} 
                    style={{ background: 'transparent', color: 'var(--color-text-muted)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: cleanPhone && !sending ? 'pointer' : 'default', transition: 'color 0.2s' }}
                    onMouseOver={(e) => { if(cleanPhone && !sending) e.currentTarget.style.color = '#25D366'; }}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
                  >
                    <Mic size={24} />
                  </button>
                )}
              </>
            )}
          </form>
        </>
      )}

      {/* Overlay de Drag & Drop */}
      {isDragOverChat && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(37, 211, 102, 0.9)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'white', pointerEvents: 'none' }}>
          <File size={48} />
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Suelta el archivo para enviarlo</h3>
        </div>
      )}

      {/* Modal de confirmación de envío multimedia estilo WhatsApp */}
      {mediaToSend.length > 0 && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#0b141a', zIndex: 60, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', background: '#202c33' }}>
            <button onClick={() => { setMediaToSend([]); setActivePreviewIndex(0); }} style={{ background: 'transparent', border: 'none', color: '#aebac1', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={24} />
            </button>
            <span style={{ fontSize: '1rem', color: '#e9edef' }}>Enviar {mediaToSend.length} {mediaToSend.length === 1 ? 'archivo' : 'archivos'} a +{cleanPhone}</span>
            <div style={{ width: 24 }}></div>
          </div>

          {/* Main Preview Area */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '1.5rem', position: 'relative' }}>
            {(() => {
              const activeMedia = mediaToSend[activePreviewIndex] || mediaToSend[0];
              if (!activeMedia) return null;
              const isImage = activeMedia.tipo?.startsWith('image/');
              const isVideo = activeMedia.tipo?.startsWith('video/');
              const isAudio = activeMedia.tipo?.startsWith('audio/');

              if (isImage) return <img src={activeMedia.url} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />;
              if (isVideo) return <video src={activeMedia.url} controls style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />;
              if (isAudio) return (
                <div style={{ background: '#202c33', padding: '2rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                   <Mic size={64} color="#00a884" />
                   <audio src={activeMedia.url} controls style={{ width: '300px' }} />
                   <p style={{ color: '#e9edef', margin: 0, textAlign: 'center', wordBreak: 'break-all' }}>{activeMedia.nombre}</p>
                </div>
              );
              return (
                <div style={{ background: '#202c33', padding: '3rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                   <File size={64} color="#8696a0" />
                   <p style={{ color: '#e9edef', margin: 0, fontSize: '1.2rem', wordBreak: 'break-all', textAlign: 'center', maxWidth: '400px' }}>{activeMedia.nombre}</p>
                   <p style={{ color: '#8696a0', margin: 0 }}>{activeMedia.tipo || 'Documento'}</p>
                </div>
              );
            })()}
          </div>

          {/* Thumbnail Strip and Send Button */}
          <div style={{ padding: '1rem', background: '#202c33', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: '100%', maxWidth: '800px', alignItems: 'center', justifyContent: 'space-between' }}>
              
              <div style={{ flex: 1, display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', alignItems: 'center', paddingRight: '1rem' }}>
                 {mediaToSend.map((media, idx) => {
                   const isImage = media.tipo?.startsWith('image/');
                   const isVideo = media.tipo?.startsWith('video/');
                   const isAudio = media.tipo?.startsWith('audio/');
                   const isActive = idx === activePreviewIndex;

                   return (
                     <div 
                       key={idx} 
                       onClick={() => setActivePreviewIndex(idx)}
                       style={{ 
                         width: '56px', height: '56px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', position: 'relative',
                         border: isActive ? '2px solid #00a884' : '2px solid transparent',
                         background: '#111b21', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.2s'
                       }}
                     >
                       {isImage ? (
                         <img src={media.url} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       ) : isVideo ? (
                         <video src={media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       ) : isAudio ? (
                         <Mic size={24} color="#8696a0" />
                       ) : (
                         <File size={24} color="#8696a0" />
                       )}
                       
                       {/* Remove Button */}
                       <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newMedia = mediaToSend.filter((_, i) => i !== idx);
                            setMediaToSend(newMedia);
                            if (newMedia.length === 0) {
                               setActivePreviewIndex(0);
                            } else {
                               if (idx === activePreviewIndex) setActivePreviewIndex(Math.max(0, idx - 1));
                               else if (idx < activePreviewIndex) setActivePreviewIndex(activePreviewIndex - 1);
                            }
                          }}
                          style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(11,20,26,0.7)', border: 'none', color: '#aebac1', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }}
                          title="Eliminar"
                       >
                          <X size={12} />
                       </button>
                     </div>
                   );
                 })}
                 
                 {/* Add More Button */}
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   style={{ width: '56px', height: '56px', flexShrink: 0, borderRadius: '8px', border: '1px solid #8696a0', background: 'transparent', color: '#aebac1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '0.5rem', transition: 'background 0.2s' }}
                   onMouseOver={(e) => e.currentTarget.style.background = '#2a3942'}
                   onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                   title="Añadir más"
                 >
                   <Paperclip size={24} />
                 </button>
              </div>

              {/* Send Button */}
              <button 
                onClick={handleSendMedia} 
                disabled={sending} 
                style={{ 
                  background: '#00a884', color: 'white', border: 'none', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s', flexShrink: 0
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {sending ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} style={{ marginLeft: '4px' }} />}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Media Preview Modal */}
      {previewMedia && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}>
            <span style={{ color: 'white', fontWeight: 500, fontSize: '1rem', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
              {previewMedia.name || 'Vista Previa'}
            </span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <a href={previewMedia.url} download={previewMedia.name} target="_blank" rel="noopener noreferrer" style={{ color: 'white', background: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '50%', display: 'flex', cursor: 'pointer', textDecoration: 'none' }} title="Descargar">
                <Download size={20} />
              </a>
              <button onClick={() => setPreviewMedia(null)} style={{ color: 'white', background: 'rgba(255,255,255,0.2)', border: 'none', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex' }} title="Cerrar">
                <X size={20} />
              </button>
            </div>
          </div>
          
          <div style={{ width: '90%', height: '85%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '3rem' }}>
            {previewMedia.type.startsWith('image/') && (
              <img src={previewMedia.url} alt={previewMedia.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }} />
            )}
            {previewMedia.type === 'application/pdf' && (
              <iframe src={previewMedia.url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', background: 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }} title="PDF Preview" />
            )}
            {previewMedia.type.startsWith('video/') && (
              <video src={previewMedia.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
