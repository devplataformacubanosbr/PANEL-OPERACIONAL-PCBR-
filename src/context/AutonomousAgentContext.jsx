import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { runAgentCycle, processNextPendingDocument, harvestNextClientChat } from '../services/autonomousAgentService';

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
        totalTasksRun: 0
      };
    } catch {
      return { docsOrganized: 0, signaturesExtracted: 0, familiesResolved: 0, chatsHarvested: 0, totalTasksRun: 0 };
    }
  });

  // Registro de actividad en vivo (Live Logs)
  const [recentLogs, setRecentLogs] = useState([]);

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
        const next = { ...prev, totalTasksRun: prev.totalTasksRun + 1 };
        if (logEntry.message?.includes('Firma en Caneta Azul')) next.signaturesExtracted += 1;
        else if (logEntry.message?.includes('familiar')) next.familiesResolved += 1;
        else if (logEntry.message?.includes('clasificado') || logEntry.message?.includes('organizado')) next.docsOrganized += 1;
        else if (logEntry.message?.includes('Chat')) next.chatsHarvested += 1;
        return next;
      });
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

  // ── EJECUTAR UN LOTE BAJO DEMANDA ("PROCESAR AHORA") ───────────────────────
  const runBatchNow = async (count = 5) => {
    if (isProcessingNow) return;
    setIsProcessingNow(true);

    addLog({
      type: 'info',
      message: `⚡ Iniciando lote manual de ${count} tareas prioritarias con IA...`
    });

    let processed = 0;
    for (let i = 0; i < count; i++) {
      try {
        const res = await runAgentCycle(settings, addLog);
        if (res.task !== 'idle') {
          processed++;
          // Pausa breve de cortesía de 1.8 segundos entre llamadas para respetar límites de Groq
          await new Promise(r => setTimeout(r, 1800));
        } else {
          addLog({ type: 'info', message: '✨ No hay más tareas pendientes por procesar en este momento.' });
          break;
        }
      } catch (err) {
        addLog({ type: 'error', message: `❌ Error en ciclo: ${err.message}` });
        break;
      }
    }

    setIsProcessingNow(false);
    toast.success(`Lote completado: ${processed} tareas procesadas exitosamente.`);
  };

  // ── BUCLE AUTÓNOMO EN SEGUNDO PLANO ─────────────────────────────────────────
  useEffect(() => {
    if (!isAgentRunning) return;

    const intervalMs = Math.max(15, settings.cycleIntervalSecs || 35) * 1000;

    const runCycle = async () => {
      if (inCycleRef.current || isProcessingNow) return;
      inCycleRef.current = true;
      setIsProcessingNow(true);

      try {
        await runAgentCycle(settings, addLog);
      } catch (e) {
        console.warn('[AutonomousAgent] Error en ciclo autónomo:', e);
      } finally {
        setIsProcessingNow(false);
        inCycleRef.current = false;
      }
    };

    // Ejecutar primer ciclo tras 3 segundos de gracia al montar
    const timeoutId = setTimeout(runCycle, 3000);
    const intervalId = setInterval(runCycle, intervalMs);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [isAgentRunning, settings, addLog, isProcessingNow]);

  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    toast.success('Configuración del agente guardada.');
  };

  const clearLogs = () => {
    setRecentLogs([]);
  };

  return (
    <AutonomousAgentContext.Provider
      value={{
        isAgentRunning,
        isProcessingNow,
        stats,
        recentLogs,
        settings,
        isModalOpen,
        setIsModalOpen,
        startAgent,
        pauseAgent,
        toggleAgent,
        runBatchNow,
        updateSettings,
        clearLogs,
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
