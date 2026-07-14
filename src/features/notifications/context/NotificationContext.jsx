import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../shared/config/supabaseClient';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notificaciones, setNotificaciones] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  // Fetch initial notifications
  useEffect(() => {
    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('notificaciones_equipo')
        .select('*')
        .eq('leida', false)
        .order('creado_en', { ascending: false })
        .limit(20);
      if (data) setNotificaciones(data);
    };
    fetchNotifs();

    // Subscribe to new notifications in real-time
    const channel = supabase
      .channel('global_notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones_equipo' }, (payload) => {
        setNotificaciones(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markNotifAsRead = useCallback(async (id) => {
    // 1. Remove from UI
    setNotificaciones(prev => prev.filter(n => n.id !== id));
    // 2. Mark in DB
    await supabase.from('notificaciones_equipo').update({ leida: true }).eq('id', id);
    // 3. Close menu
    setShowNotifMenu(false);
  }, []);

  const toggleNotifMenu = useCallback(() => {
    setShowNotifMenu(prev => !prev);
  }, []);

  const closeNotifMenu = useCallback(() => {
    setShowNotifMenu(false);
  }, []);

  const value = {
    notificaciones,
    showNotifMenu,
    markNotifAsRead,
    toggleNotifMenu,
    closeNotifMenu,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
