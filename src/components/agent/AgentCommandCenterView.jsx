import React, { useState } from 'react';
import {
  Bot,
  Play,
  Pause,
  Zap,
  RotateCw,
  FileText,
  PenTool,
  Users,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
  Sliders,
  Sparkles,
  Search,
  Filter,
  Eye,
  Trash2,
  Layers,
  Inbox
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAutonomousAgent } from '../../context/AutonomousAgentContext';

export default function AgentCommandCenterView({ onNavigateToClient }) {
  const {
    isAgentRunning,
    isProcessingNow,
    stats,
    richHistory = [],
    upcomingQueue = [],
    totalPendingCount = 0,
    currentActivity,
    countdown,
    settings,
    startAgent,
    pauseAgent,
    toggleAgent,
    executeCycle,
    runBatchNow,
    refreshQueue,
    updateSettings,
    clearRichHistory,
    openControlCenter
  } = useAutonomousAgent();

  const [filterType, setFilterType] = useState('all'); // 'all' | 'docs' | 'signatures' | 'families' | 'chats' | 'exceptions'
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Filtrado de resultados ricos
  const filteredHistory = richHistory.filter(item => {
    if (filterType === 'docs' && item.task !== 'document_organized') return false;
    if (filterType === 'signatures' && !item.signatureBase64) return false;
    if (filterType === 'families' && !item.moved) return false;
    if (filterType === 'chats' && item.task !== 'chat_harvested') return false;
    if (filterType === 'exceptions' && item.action !== 'flagged_blurry' && item.action !== 'flagged_error' && !item.error) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (item.clientName || '').toLowerCase().includes(q);
      const matchDoc = (item.newFileName || item.originalFileName || '').toLowerCase().includes(q);
      const matchTipo = (item.tipoDoc || '').toLowerCase().includes(q);
      return matchName || matchDoc || matchTipo;
    }

    return true;
  });

  const totalExceptions = (stats.blurryDocs || 0) + (stats.errorDocs || 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070b14] text-slate-100 overflow-hidden select-none">
      
      {/* ── 1. HEADER & GLOBAL MASTER CONTROLS ───────────────────────────────── */}
      <div className="shrink-0 border-b border-white/10 bg-[#0c1220]/90 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center border shadow-lg transition-all ${
            isProcessingNow
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse'
              : isAgentRunning
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                : 'bg-zinc-800/80 border-white/10 text-zinc-400'
          }`}>
            <Bot size={26} className={isProcessingNow ? 'animate-bounce' : ''} />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Centro de Control del Agente Autónomo
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  IA v2.4
                </span>
              </h1>

              {/* Status Pill */}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isProcessingNow
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse'
                  : isAgentRunning
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}>
                <span className={`h-2 w-2 rounded-full ${
                  isProcessingNow ? 'bg-amber-400 animate-ping' : isAgentRunning ? 'bg-emerald-400' : 'bg-zinc-500'
                }`} />
                {isProcessingNow ? 'PROCESANDO EN VIVO' : isAgentRunning ? 'PILOTO ACTIVO' : 'PAUSADO'}
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-0.5">
              Automatización de extremo a extremo: clasifica documentos, crea fichas de familiares y extrae firmas.
            </p>
          </div>
        </div>

        {/* Master Control Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Countdown indicator */}
          {isAgentRunning && !isProcessingNow && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-xs text-blue-300 font-mono">
              <Clock size={14} className="text-blue-400 animate-spin" />
              <span>Próximo escaneo en <strong>{countdown}s</strong></span>
            </div>
          )}

          {/* Start / Pause Button */}
          {isAgentRunning ? (
            <button
              onClick={pauseAgent}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-all shadow-sm"
              title="Pausar el ciclo automático en segundo plano"
            >
              <Pause size={15} /> Pausar Agente
            </button>
          ) : (
            <button
              onClick={startAgent}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950 transition-all"
              title="Reanudar el ciclo automático en segundo plano"
            >
              <Play size={15} /> Activar Piloto
            </button>
          )}

          {/* Trigger immediate cycle */}
          <button
            onClick={() => executeCycle()}
            disabled={isProcessingNow}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md disabled:opacity-50 transition-all"
            title="Analiza y organiza el siguiente documento en cola inmediatamente"
          >
            <Zap size={15} className={isProcessingNow ? 'animate-spin' : ''} />
            <span>Procesar Siguiente Ahora</span>
          </button>

          {/* Batch Buttons */}
          <button
            onClick={() => runBatchNow(5)}
            disabled={isProcessingNow}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 disabled:opacity-50 transition-all"
            title="Procesa 5 tareas seguidas con IA"
          >
            Lote de 5
          </button>

          <button
            onClick={() => runBatchNow(20)}
            disabled={isProcessingNow}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 disabled:opacity-50 transition-all"
            title="Procesa 20 tareas seguidas con IA"
          >
            ⚡ Lote de 20
          </button>

          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className={`p-2 rounded-lg border transition-all ${
              showSettingsDrawer ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Ajustar alcances y reglas del agente"
          >
            <Sliders size={16} />
          </button>
        </div>
      </div>

      {/* ── 2. STATS & TELEMETRY STRIP ──────────────────────────────────────── */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 px-6 py-3 border-b border-white/5 bg-[#090e1a]/60">
        <TelemetryCard
          icon={<Inbox size={17} className="text-indigo-400" />}
          value={totalPendingCount}
          label="En Cola WhatsApp"
          sub="Pendientes"
        />
        <TelemetryCard
          icon={<FileText size={17} className="text-blue-400" />}
          value={stats.docsOrganized || 0}
          label="Organizados"
          sub="100% Automático"
          highlight="blue"
        />
        <TelemetryCard
          icon={<PenTool size={17} className="text-cyan-400" />}
          value={stats.signaturesExtracted || 0}
          label="Caneta Azul"
          sub="Firmas Recortadas"
          highlight="cyan"
        />
        <TelemetryCard
          icon={<Users size={17} className="text-emerald-400" />}
          value={stats.familiesResolved || 0}
          label="Familias"
          sub="Fichas Creadas"
          highlight="emerald"
        />
        <TelemetryCard
          icon={<MessageSquare size={17} className="text-purple-400" />}
          value={stats.chatsHarvested || 0}
          label="Chats Cosechados"
          sub="CPF Mod 11"
          highlight="purple"
        />
        <TelemetryCard
          icon={<AlertTriangle size={17} className={totalExceptions > 0 ? "text-amber-400" : "text-slate-500"} />}
          value={totalExceptions}
          label="Para Revisión"
          sub="Borrosos / Errores"
          highlight={totalExceptions > 0 ? "amber" : null}
          onClick={() => setFilterType('exceptions')}
        />
      </div>

      {/* ── 3. MAIN WORKSPACE: 3 PILLARS LAYOUT ──────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-white/10">

        {/* ── COL 1: 🔮 QUÉ HARÁ (Cola de Espera & Backlog Inteligente) ─────── */}
        <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col bg-[#080d18] overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                🔮 QUÉ HARÁ (Cola Próxima)
              </h2>
            </div>
            <button
              onClick={refreshQueue}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
              title="Refrescar cola"
            >
              <RotateCw size={13} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
            {upcomingQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 text-xs px-4">
                <CheckCircle2 size={32} className="text-emerald-500/40 mb-2" />
                <span>No hay más documentos pendientes en este momento. ¡Bandeja limpia!</span>
              </div>
            ) : (
              upcomingQueue.map((item, idx) => (
                <div
                  key={item.id}
                  className="group relative p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 transition-all flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 font-bold shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-white truncate">
                        {item.clientName}
                      </span>
                    </div>

                    <button
                      onClick={() => executeCycle()}
                      disabled={isProcessingNow}
                      className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 shrink-0"
                    >
                      Procesar
                    </button>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 truncate bg-black/30 px-2 py-1 rounded border border-white/5">
                    📄 {item.nombre_archivo}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{item.tipo_contenido || 'archivo'}</span>
                    <span>{item.fecha_recepcion ? new Date(item.fecha_recepcion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'reciente'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── COL 2 & 3: ⚡ QUÉ ESTÁ HACIENDO + ✅ QUÉ HIZO (RESULTADOS GRANDES) ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0f1d]">

          {/* ⚡ QUÉ ESTÁ HACIENDO (Monitor en Vivo) */}
          <div className="shrink-0 p-4 border-b border-white/10 bg-[#0d1424]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${isProcessingNow ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                ⚡ QUÉ ESTÁ HACIENDO EN VIVO
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {isProcessingNow ? 'Ejecutando Modelo Visión Groq' : 'Vigilancia en segundo plano'}
              </span>
            </div>

            {isProcessingNow ? (
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-blue-500/10 to-indigo-500/10 border border-amber-500/30 shadow-lg flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 animate-spin">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        {currentActivity?.step || 'Analizando documento con IA de Visión...'}
                      </div>
                      <div className="text-xs text-amber-200/80 font-mono">
                        {currentActivity?.detail || 'Descargando y verificando nitidez...'}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs px-2.5 py-1 rounded-md font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    EN PROCESO
                  </span>
                </div>

                {/* Animated Pipeline Stage Bar */}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/10 text-[11px]">
                  <PipelineStep label="1. Descarga WhatsApp" done={true} active={false} />
                  <PipelineStep label="2. Visión Groq" done={false} active={true} />
                  <PipelineStep label="3. Caneta Azul" done={false} active={false} />
                  <PipelineStep label="4. Actualizar Ficha" done={false} active={false} />
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      Piloto listo y vigilando nuevos mensajes y documentos entrantes.
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Próxima ronda programada automáticamente cada {settings.cycleIntervalSecs} segundos.
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => executeCycle()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <Zap size={13} className="text-amber-400" /> Forzar Ronda Ahora
                </button>
              </div>
            )}
          </div>

          {/* ✅ QUÉ HIZO (RESULTADOS GRANDES Y DETALLADOS) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Filter and Search Bar */}
            <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#0a0e1c]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <FilterButton
                  active={filterType === 'all'}
                  onClick={() => setFilterType('all')}
                  label={`Todos (${richHistory.length})`}
                />
                <FilterButton
                  active={filterType === 'docs'}
                  onClick={() => setFilterType('docs')}
                  label="Documentos Organizados"
                  badge={stats.docsOrganized}
                />
                <FilterButton
                  active={filterType === 'signatures'}
                  onClick={() => setFilterType('signatures')}
                  label="Firmas Caneta Azul"
                  badge={stats.signaturesExtracted}
                />
                <FilterButton
                  active={filterType === 'families'}
                  onClick={() => setFilterType('families')}
                  label="Familias Vinculadas"
                  badge={stats.familiesResolved}
                />
                <FilterButton
                  active={filterType === 'chats'}
                  onClick={() => setFilterType('chats')}
                  label="Chats Cosechados"
                  badge={stats.chatsHarvested}
                />
                <FilterButton
                  active={filterType === 'exceptions'}
                  onClick={() => setFilterType('exceptions')}
                  label="⚠️ Casos Borrosos / Errores"
                  badge={totalExceptions}
                  danger={totalExceptions > 0}
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filtrar por nombre o tipo..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-black/30 border border-white/10 rounded-lg pl-7 pr-3 py-1 text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50 w-48"
                  />
                </div>

                {richHistory.length > 0 && (
                  <button
                    onClick={clearRichHistory}
                    className="p-1.5 text-slate-500 hover:text-slate-300 rounded hover:bg-white/5 transition-colors"
                    title="Limpiar historial visual"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Results Stream (Large Rich Action Cards) */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center text-slate-500">
                  <Bot size={40} className="mb-3 opacity-30 text-blue-400" />
                  <p className="text-sm font-medium text-slate-300">
                    Aún no hay acciones registradas en este filtro.
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Inicia el piloto o haz clic en "Procesar Siguiente Ahora" para ver los resultados grandes y detallados aquí.
                  </p>
                </div>
              ) : (
                filteredHistory.map(item => (
                  <RichResultCard
                    key={item.id}
                    item={item}
                    onOpenClient={onNavigateToClient}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── SETTINGS DRAWER OVERLAY ────────────────────────────────────────── */}
      {showSettingsDrawer && (
        <div className="absolute inset-y-0 right-0 w-80 bg-[#0d1424] border-l border-white/10 shadow-2xl p-5 flex flex-col gap-4 z-50 animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders size={16} className="text-blue-400" /> Reglas de Automatización
            </h3>
            <button
              onClick={() => setShowSettingsDrawer(false)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-white/5"
            >
              Cerrar
            </button>
          </div>

          <div className="flex flex-col gap-3 text-xs">
            <SettingSwitch
              label="Auto-organizar documentos"
              checked={settings.autoOrganizeDocs}
              onChange={v => updateSettings({ autoOrganizeDocs: v })}
            />
            <SettingSwitch
              label="Auto-extraer firma en pasaporte"
              checked={settings.autoExtractSignatures}
              onChange={v => updateSettings({ autoExtractSignatures: v })}
            />
            <SettingSwitch
              label="Auto-crear fichas de familiares"
              checked={settings.autoDetectFamilies}
              onChange={v => updateSettings({ autoDetectFamilies: v })}
            />
            <SettingSwitch
              label="Cosecha de CPFs desde chat"
              checked={settings.autoHarvestChats}
              onChange={v => updateSettings({ autoHarvestChats: v })}
            />

            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              <label className="text-slate-300 font-semibold flex justify-between text-xs">
                <span>Pausa si la cola está vacía:</span>
                <span className="text-blue-400 font-mono">{settings.cycleIntervalSecs}s</span>
              </label>
              <input
                type="range"
                min="3"
                max="60"
                step="1"
                value={settings.cycleIntervalSecs}
                onChange={e => updateSettings({ cycleIntervalSecs: Number(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <span className="text-[10px] text-emerald-400">
                ⚡ Modo Continuo activo: Mientras haya documentos pendientes, el agente procesa seguido (cada 2 seg).
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── COMPONENTE: TARJETA RICA Y GRANDE DE RESULTADO ("QUÉ HIZO") ───────────────
function RichResultCard({ item, onOpenClient }) {
  const isBlurry = item.action === 'flagged_blurry';
  const isError = item.action === 'flagged_error' || item.error;
  const isChat = item.action === 'chat_harvested';
  const isDoc = item.task === 'document_organized' || item.action === 'organized_client_doc' || item.action === 'moved_to_relative';

  return (
    <div className={`p-4 rounded-xl border transition-all shadow-md flex flex-col gap-3 ${
      isBlurry
        ? 'bg-amber-500/[0.04] border-amber-500/30'
        : isError
          ? 'bg-rose-500/[0.04] border-rose-500/30'
          : isChat
            ? 'bg-purple-500/[0.04] border-purple-500/30'
            : 'bg-white/[0.03] border-white/10 hover:border-blue-500/40'
    }`}>
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
            isBlurry
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : isError
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : isChat
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            {isBlurry ? '⚠️ FOTO BORROSA' : isError ? '🚨 ERROR' : isChat ? '💬 CHAT COSECHADO' : '✅ DOCUMENTO CLASIFICADO'}
          </span>

          <span className="text-sm font-bold text-white tracking-tight">
            {item.clientName || `Cliente #${item.clientId}`}
          </span>

          {item.moved && (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <Users size={11} /> {item.isNewClient ? 'Familiar Creado' : 'Vinculado a Familiar'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono">{item.timestamp}</span>
          {item.clientId && onOpenClient && (
            <button
              onClick={() => onOpenClient(item.clientId, item.clientName)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
              title="Abrir expediente del cliente"
            >
              <ExternalLink size={14} />
            </button>
          )}
        </div>
      </div>

      {/* CASO: DOCUMENTO ORGANIZADO (NOMBRE ANTES VS DESPUÉS) */}
      {isDoc && (
        <div className="flex flex-col gap-2 bg-black/30 p-3 rounded-lg border border-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Archivo Original</span>
              <span className="font-mono text-slate-400 truncate max-w-sm">
                {item.originalFileName || 'archivo.jpg'}
              </span>
            </div>

            <ArrowRight size={14} className="text-emerald-400 hidden sm:block shrink-0" />

            <div className="flex flex-col sm:text-right">
              <span className="text-[10px] text-emerald-400 uppercase font-semibold">Nombre Canónico Aplicado</span>
              <span className="font-bold text-emerald-300 tracking-tight">
                {item.newFileName || `${item.tipoDoc} - ${item.clientName}`}
              </span>
            </div>
          </div>

          {/* DATOS EXTRAÍDOS POR LA IA */}
          {item.extractedData && (
            <div className="pt-2 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {item.extractedData.NUMERO_PASAPORTE && (
                <div>
                  <span className="text-[10px] text-slate-500 block">Pasaporte</span>
                  <span className="font-mono font-semibold text-white">{item.extractedData.NUMERO_PASAPORTE}</span>
                </div>
              )}
              {item.extractedData.CPF && (
                <div>
                  <span className="text-[10px] text-slate-500 block">CPF Extraído</span>
                  <span className="font-mono font-semibold text-white">{item.extractedData.CPF}</span>
                </div>
              )}
              {item.extractedData.FECHA_NACIMIENTO && (
                <div>
                  <span className="text-[10px] text-slate-500 block">Nacimiento</span>
                  <span className="font-semibold text-white">{item.extractedData.FECHA_NACIMIENTO}</span>
                </div>
              )}
              {item.extractedData.ESTADO_CIVIL && (
                <div>
                  <span className="text-[10px] text-slate-500 block">Estado Civil</span>
                  <span className="font-semibold text-white">{item.extractedData.ESTADO_CIVIL}</span>
                </div>
              )}
            </div>
          )}

          {/* VISTA PREVIA DE FIRMA EXTRAÍDA EN CANETA AZUL */}
          {item.signatureBase64 && (
            <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <PenTool size={14} className="text-cyan-400" />
                <span className="text-xs font-semibold text-cyan-300">
                  Firma en Caneta Azul Bic Extraída:
                </span>
              </div>
              <div className="h-10 bg-white/[0.04] border border-cyan-500/30 rounded px-3 py-1 flex items-center justify-center">
                <img
                  src={item.signatureBase64}
                  alt="Firma digital Caneta Azul"
                  className="h-full object-contain filter drop-shadow-[0_0_6px_rgba(0,100,255,0.4)]"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* CASO: CHAT COSECHADO */}
      {isChat && item.updates && (
        <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg text-xs flex flex-wrap gap-3">
          {item.updates.cpf && (
            <div>
              <span className="text-[10px] text-purple-300 block">CPF Validado (Módulo 11)</span>
              <span className="font-mono font-bold text-white">{item.updates.cpf}</span>
            </div>
          )}
          {item.updates.email && (
            <div>
              <span className="text-[10px] text-purple-300 block">Email Rescatado</span>
              <span className="font-mono font-bold text-white">{item.updates.email}</span>
            </div>
          )}
          {item.updates.direccion && (
            <div>
              <span className="text-[10px] text-purple-300 block">Dirección Normalizada</span>
              <span className="font-semibold text-white">{item.updates.direccion}</span>
            </div>
          )}
        </div>
      )}

      {/* CASO: FOTO BORROSA O CASO PARA REVISIÓN */}
      {(isBlurry || isError) && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-300">
            <strong className="text-amber-400">Diagnóstico de IA:</strong> {item.motivo || item.error || 'Imagen no nítida'}
          </div>

          {item.suggestedMessage && (
            <div className="p-3 rounded-lg bg-black/40 border border-amber-500/20 flex flex-col gap-2 text-xs">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                Mensaje sugerido para responder por WhatsApp:
              </span>
              <p className="text-blue-300 italic">
                "{item.suggestedMessage}"
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(item.suggestedMessage);
                    toast.success('¡Mensaje copiado para WhatsApp!');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-[11px] font-bold"
                >
                  <Copy size={12} /> Copiar Mensaje
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── COMPONENTES AUXILIARES ────────────────────────────────────────────────────
function TelemetryCard({ icon, value, label, sub, highlight, onClick }) {
  const getBorderColor = () => {
    if (highlight === 'blue') return 'border-blue-500/30 bg-blue-500/[0.04] text-blue-400';
    if (highlight === 'cyan') return 'border-cyan-500/30 bg-cyan-500/[0.04] text-cyan-400';
    if (highlight === 'emerald') return 'border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-400';
    if (highlight === 'purple') return 'border-purple-500/30 bg-purple-500/[0.04] text-purple-400';
    if (highlight === 'amber') return 'border-amber-500/40 bg-amber-500/[0.08] text-amber-400';
    return 'border-white/5 bg-white/[0.02] text-slate-400';
  };

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border flex flex-col gap-1 transition-all ${getBorderColor()} ${
        onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        {icon}
        <span className="text-[10px] text-slate-500 font-mono font-medium">{sub}</span>
      </div>
      <div className="text-xl font-bold text-white tracking-tight mt-0.5">
        {value}
      </div>
      <div className="text-[11px] text-slate-400 font-medium">
        {label}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, label, badge, danger }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
        active
          ? danger
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
            : 'bg-blue-600 text-white shadow-md'
          : danger && badge > 0
            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            : 'bg-white/5 text-slate-400 hover:text-white border border-white/5 hover:border-white/10'
      }`}
    >
      <span>{label}</span>
      {badge !== undefined && (
        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
          active ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-300'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function PipelineStep({ label, done, active }) {
  return (
    <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${
      done
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        : active
          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold animate-pulse'
          : 'bg-white/[0.02] border-white/5 text-slate-500'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${done ? 'bg-emerald-400' : active ? 'bg-amber-400 animate-ping' : 'bg-slate-600'}`} />
      <span className="truncate">{label}</span>
    </div>
  );
}

function SettingSwitch({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04]">
      <span className="text-slate-300">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="accent-blue-500 h-4 w-4 rounded cursor-pointer"
      />
    </label>
  );
}
