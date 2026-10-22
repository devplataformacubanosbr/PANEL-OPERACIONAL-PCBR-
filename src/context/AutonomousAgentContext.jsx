import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  runAgentCycle,
  processNextPendingDocument,
  harvestNextClientChat,
  getUpcomingQueue
} from '../services/autonomousAgentService.js';

const AutonomousAgentContext = createContext(null);

const DEFAULT_SETTINGS = {
  autoOrganizeDocs: true,
  autoExtractSignatures: true,
  autoDetectFamilies: true,
  autoHarvestChats: true,
  cycleIntervalSecs: 35
};

export const AutonomousAgentProvider = ({ children }) => {
  // Estado activo / pausado guardado en localStorage
  const [isAgentRunning, setIsAgentRunning] = useState(() => {
    return localStorage.getItem('app_autopilot_enabled') === 'true';
  });

  const [isProcessingNow, setIsProcessingNow] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estadísticas acumuladas
  const [stats, setStats] = useState(() => {
    try {
      const saved = localStorage.getItem('app_autopilot_stats');
      return saved ? JSON.parse(saved) : {
        docsOrganized: 0,
        signaturesExtracted: 0,
        familiesResolved: 0,
        chatsHarvested: 0,
        blurryDocs: 0,
        errorDocs: 0,
        totalTasksRun: 0
      };
    } catch {
      return {
        docsOrganized: 0,
        signaturesExtracted: 0,
        familiesResolved: 0,
        chatsHarvested: 0,
        blurryDocs: 0,
        errorDocs: 0,
        totalTasksRun: 0
      };
    }
  });

  // Registro de actividad en vivo (Live Logs)
  const [recentLogs, setRecentLogs] = useState([]);

  // Historial rico con tarjetas visuales detalladas (QUÉ HIZO)
  const [richHistory, setRichHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('app_autopilot_rich_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Cola de próximas tareas (QUÉ HARÁ)
  const [upcomingQueue, setUpcomingQueue] = useState([]);
  const [totalPendingCount, setTotalPendingCount] = useState(0);

  // Monitor en vivo del paso actual (QUÉ ESTÁ HACIENDO AHORA)
  const [currentActivity, setCurrentActivity] = useState(null);

  // Contador de cuenta regresiva para el próximo ciclo
  const [countdown, setCountdown] = useState(35);

  // Configuración de alcances del agente
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('app_autopilot_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const inCycleRef = useRef(false);

  // Guardar estadísticas cuando cambien
  useEffect(() => {
    localStorage.setItem('app_autopilot_stats', JSON.stringify(stats));
  }, [stats]);

  // Guardar configuración cuando cambie
  useEffect(() => {
    localStorage.setItem('app_autopilot_settings', JSON.stringify(settings));
  }, [settings]);

  // Guardar historial rico
  useEffect(() => {
    try {
      localStorage.setItem('app_autopilot_rich_history', JSON.stringify(richHistory.slice(0, 50)));
    } catch (_) {}
  }, [richHistory]);

  // Actualizar cola de próximas tareas
  const refreshQueue = useCallback(async () => {
    try {
      const res = await getUpcomingQueue(8);
      if (res && res.items) {
        setUpcomingQueue(res.items);
        setTotalPendingCount(res.totalPending);
      }
    } catch (_) {}
  }, []);

  // Helper para añadir logs en tiempo real
  const addLog = useCallback((logEntry) => {
    const entry = {
      id: Date.now() + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toLocaleTimeString(),
      ...logEntry
    };

    setRecentLogs(prev => [entry, ...prev.slice(0, 99)]);

    // Actualizar contadores si aplica
    if (logEntry.type === 'success') {
      setStats(prev => {
        const next = { ...prev, totalTasksRun: (prev.totalTasksRun || 0) + 1 };
        if (logEntry.message?.includes('Firma en Caneta Azul')) next.signaturesExtracted = (next.signaturesExtracted || 0) + 1;
        else if (logEntry.message?.includes('familiar')) next.familiesResolved = (next.familiesResolved || 0) + 1;
        else if (logEntry.message?.includes('clasificado') || logEntry.message?.includes('organizado')) next.docsOrganized = (next.docsOrganized || 0) + 1;
        else if (logEntry.message?.includes('Chat')) next.chatsHarvested = (next.chatsHarvested || 0) + 1;
        return next;
      });
    } else if (logEntry.type === 'warning' && (logEntry.motivo || logEntry.message?.includes('BORROSO'))) {
      setStats(prev => ({
        ...prev,
        blurryDocs: (prev.blurryDocs || 0) + 1,
        totalTasksRun: (prev.totalTasksRun || 0) + 1
      }));
    } else if (logEntry.type === 'error') {
      setStats(prev => ({
        ...prev,
        errorDocs: (prev.errorDocs || 0) + 1,
        totalTasksRun: (prev.totalTasksRun || 0) + 1
      }));
    }
  }, []);

  // ── INICIAR Y PAUSAR AGENTE ─────────────────────────────────────────────────
  const startAgent = () => {
    setIsAgentRunning(true);
    localStorage.setItem('app_autopilot_enabled', 'true');
    addLog({
      type: 'info',
      message: '🚀 Piloto Automático ACTIVADO. El agente comenzará a organizar tareas de forma autónoma en segundo plano.'
    });
    toast.success('🤖 Piloto Automático Activo: trabajando en segundo plano.', { icon: '🟢' });
  };

  const pauseAgent = () => {
    setIsAgentRunning(false);
    localStorage.setItem('app_autopilot_enabled', 'false');
    addLog({
      type: 'warning',
      message: '⏸️ Piloto Automático PAUSADO por el operador.'
    });
    toast('Piloto Automático en pausa.', { icon: '⏸️' });
  };

  const toggleAgent = () => {
    if (isAgentRunning) pauseAgent();
    else startAgent();
  };

  // ── EJECUTAR UN SOLO CICLO DEL AGENTE ───────────────────────────────────────
  const executeCycle = useCallback(async () => {
    if (inCycleRef.current || isProcessingNow) return null;
    inCycleRef.current = true;
    setIsProcessingNow(true);

    setCurrentActivity({
      step: 'Escaneando documentos entrantes...',
      detail: 'Revisando WhatsApp y Kommo en busca de nuevos archivos y chats'
    });

    let cycleResult = null;
    try {
      cycleResult = await runAgentCycle(settings, (log) => {
        addLog(log);
        if (log.message) {
          setCurrentActivity({
            step: log.type === 'error' ? 'Incidencia' : 'Procesando con IA Visión',
            detail: log.message,
            docName: log.docName || '',
            clientName: log.clientName || ''
          });
        }
      });

      if (cycleResult && cycleResult.details) {
        const item = {
          id: 'rich_' + Date.now() + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toLocaleTimeString(),
          date: new Date().toLocaleDateString(),
          task: cycleResult.task,
          ...cycleResult.details
        };

        setRichHistory(prev => [item, ...prev.slice(0, 49)]);
      }

      await refreshQueue();
    } catch (err) {
      addLog({ type: 'error', message: `❌ Error en ciclo: ${err.message}` });
    } finally {
      setIsProcessingNow(false);
      inCycleRef.current = false;
      setCurrentActivity(null);
      setCountdown(settings.cycleIntervalSecs || 35);
    }

    return cycleResult;
  }, [settings, addLog, refreshQueue, isProcessingNow]);

  // ── EJECUTAR UN LOTE BAJO DEMANDA ("PROCESAR AHORA") ───────────────────────
  const runBatchNow = async (count = 5) => {
    if (isProcessingNow) return;
    addLog({
      type: 'info',
      message: `⚡ Iniciando lote manual de ${count} tareas prioritarias con IA...`
    });

    let processed = 0;
    for (let i = 0; i < count; i++) {
      try {
        const res = await executeCycle();
        if (res && res.task !== 'idle') {
          processed++;
          await new Promise(r => setTimeout(r, 1800));
        } else {
          addLog({ type: 'info', message: '✨ No hay más tareas pendientes por procesar en este momento.' });
          break;
        }
      } catch (err) {
        break;
      }
    }

    toast.success(`Lote completado: ${processed} tareas procesadas exitosamente.`);
  };

  // ── INICIALIZACIÓN Y COUNTDOWN ──────────────────────────────────────────────
  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    if (!isAgentRunning) {
      setCountdown(settings.cycleIntervalSecs || 35);
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          executeCycle();
          return settings.cycleIntervalSecs || 35;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAgentRunning, settings.cycleIntervalSecs, executeCycle]);

  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    toast.success('Configuración del agente guardada.');
  };

  const clearLogs = () => {
    setRecentLogs([]);
  };

  const clearRichHistory = () => {
    setRichHistory([]);
    localStorage.removeItem('app_autopilot_rich_history');
    toast.success('Historial visual de resultados reiniciado.');
  };

  return (
    <AutonomousAgentContext.Provider
      value={{
        isAgentRunning,
        isProcessingNow,
        stats,
        recentLogs,
        richHistory,
        upcomingQueue,
        totalPendingCount,
        currentActivity,
        countdown,
        settings,
        isModalOpen,
        setIsModalOpen,
        startAgent,
        pauseAgent,
        toggleAgent,
        executeCycle,
        runBatchNow,
        refreshQueue,
        updateSettings,
        clearLogs,
        clearRichHistory,
        openControlCenter: () => setIsModalOpen(true),
        closeControlCenter: () => setIsModalOpen(false)
      }}
    >
      {children}
    </AutonomousAgentContext.Provider>
  );
};

export const useAutonomousAgent = () => {
  const ctx = useContext(AutonomousAgentContext);
  if (!ctx) {
    throw new Error('useAutonomousAgent debe usarse dentro de AutonomousAgentProvider');
  }
  return ctx;
};
