import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  Sun,
  Moon,
  ArrowLeft,
  Settings,
  Menu,
  Plus,
  X,
  Clock,
  Home,
  Users,
  MessageSquare,
  BookOpen,
  Shield,
  ChevronRight,
  Command,
  Bot
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../features/notifications/context/NotificationContext';
import { useAutonomousAgent } from '../../context/AutonomousAgentContext';
import Button from '../../components/ui/Button';

export default function Header({
  currentView,
  isSidebarOpen,
  setIsSidebarOpen,
  navigateToHome,
  navigateToDashboard,
  navigateToClientsList,
  navigateToSettings,
  navigateToAgent,
  globalSearch,
  handleSearchChange,
  onClearSearch,
  onNavigateToClient,
  recentClients = [],
  onNewClient,
  selectedClientId,
  clientName
}) {
  const { theme, toggleTheme } = useTheme();
  const { notificaciones, showNotifMenu, toggleNotifMenu, markNotifAsRead } = useNotifications();
  const { isAgentRunning, isProcessingNow, openControlCenter } = useAutonomousAgent();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef(null);

  const showRecents = isSearchFocused && !globalSearch && recentClients.length > 0;

  // ── Atajo de Teclado Global: Ctrl + K o ⌘K para enfocar búsqueda ─────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K o Cmd+K para enfocar búsqueda
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchFocused(true);
      }
      // Esc para salir de la búsqueda
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
        setIsSearchFocused(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Handler inteligente para el botón "Atrás" ──────────────────────────────
  const handleSmartBack = () => {
    if (currentView === 'client') {
      if (navigateToClientsList) navigateToClientsList();
      else if (navigateToHome) navigateToHome();
    } else {
      if (navigateToDashboard) navigateToDashboard();
      else if (navigateToHome) navigateToHome();
    }
  };

  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between gap-4 bg-chrome-bg border-b border-chrome-border/60 px-5 z-20 select-none">
      
      {/* ── IZQUIERDA: BREADCRUMBS & NAVEGACIÓN JERÁRQUICA ───────────────────── */}
      <div className="flex flex-1 items-center gap-2.5 min-w-0">
        {/* Botón de Menú hamburguesa si la barra lateral está cerrada */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-chrome-text hover:bg-chrome-bg-raised hover:text-white transition-colors"
            aria-label="Abrir menú lateral"
            title="Abrir menú lateral"
          >
            <Menu size={18} />
          </button>
        )}

        {/* Botón Volver Atrás (visible cuando no estamos en Dashboard) */}
        {currentView !== 'dashboard' && (
          <button
            onClick={handleSmartBack}
            title={currentView === 'client' ? "Volver a la lista de clientes" : "Volver al Dashboard"}
            aria-label="Volver atrás"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-chrome-text hover:bg-chrome-bg-raised hover:text-white transition-colors"
          >
            <ArrowLeft size={17} />
          </button>
        )}

        {/* Migas de Pan (Breadcrumbs) interactivas */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-chrome-text min-w-0 truncate">
          {/* Nodo Raíz: Dashboard / Inicio */}
          <button
            onClick={navigateToDashboard || navigateToHome}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:text-white hover:bg-chrome-bg-raised ${currentView === 'dashboard' ? 'text-white font-semibold' : ''}`}
            title="Ir al Dashboard principal"
          >
            <Home size={14} className={currentView === 'dashboard' ? 'text-chrome-accent' : 'text-chrome-text'} />
            <span className="hidden sm:inline font-medium">Dashboard</span>
          </button>

          {/* Ramas según la vista activa */}
          {currentView === 'clients' && (
            <>
              <ChevronRight size={13} className="text-chrome-border shrink-0" />
              <span className="inline-flex items-center gap-1.5 px-2 py-1 font-semibold text-white bg-chrome-bg-active/50 rounded">
                <Users size={14} className="text-chrome-accent" />
                <span>Clientes</span>
              </span>
            </>
          )}

          {currentView === 'client' && (
            <>
              <ChevronRight size={13} className="text-chrome-border shrink-0" />
              <button
                onClick={navigateToClientsList}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:text-white hover:bg-chrome-bg-raised"
                title="Volver al listado de clientes"
              >
                <Users size={14} />
                <span className="hidden sm:inline font-medium">Clientes</span>
              </button>
              <ChevronRight size={13} className="text-chrome-border shrink-0" />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 font-semibold text-white bg-chrome-accent/15 border border-chrome-accent/30 rounded-md truncate max-w-[240px]">
                <span className="h-1.5 w-1.5 rounded-full bg-chrome-accent shrink-0" />
                <span className="truncate">{clientName || `Ficha #${selectedClientId || ''}`}</span>
              </span>
            </>
          )}

          {currentView === 'team-chat' && (
            <>
              <ChevronRight size={13} className="text-chrome-border shrink-0" />
              <span className="inline-flex items-center gap-1.5 px-2 py-1 font-semibold text-white bg-chrome-bg-active/50 rounded">
                <MessageSquare size={14} className="text-chrome-accent" />
                <span>Mensajes de Equipo</span>
              </span>
            </>
          )}

          {currentView === 'directory' && (
            <>
              <ChevronRight size={13} className="text-chrome-border shrink-0" />
              <span className="inline-flex items-center gap-1.5 px-2 py-1 font-semibold text-white bg-chrome-bg-active/50 rounded">
                <BookOpen size={14} className="text-chrome-accent" />
                <span>Directorio de Operación</span>
              </span>
            </>
          )}

          {currentView === 'team-management' && (
            <>
              <ChevronRight size={13} className="text-chrome-border shrink-0" />
              <span className="inline-flex items-center gap-1.5 px-2 py-1 font-semibold text-white bg-chrome-bg-active/50 rounded">
                <Shield size={14} className="text-chrome-accent" />
                <span>Gestión de Equipo</span>
              </span>
            </>
          )}

          {currentView === 'settings' && (
            <>
              <ChevronRight size={13} className="text-chrome-border shrink-0" />
              <span className="inline-flex items-center gap-1.5 px-2 py-1 font-semibold text-white bg-chrome-bg-active/50 rounded">
                <Settings size={14} className="text-chrome-accent" />
                <span>Configuración</span>
              </span>
            </>
          )}

          {currentView === 'agent' && (
            <>
              <ChevronRight size={13} className="text-chrome-border shrink-0" />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 font-semibold text-indigo-300 bg-indigo-500/20 border border-indigo-500/40 rounded-md shadow-sm">
                <Bot size={14} className="text-indigo-400" />
                <span>Centro de Control IA (Piloto)</span>
              </span>
            </>
          )}
        </nav>
      </div>

      {/* ── CENTRO: BUSCADOR GLOBAL CON ATAJO CTRL+K ───────────────────────── */}
      <div className="relative flex flex-1 justify-center max-w-[460px]">
        <div className="flex w-full items-center gap-2 rounded-lg border border-chrome-border bg-chrome-bg-raised/70 px-3 py-1.5 transition-all focus-within:border-chrome-accent/70 focus-within:bg-chrome-bg-raised focus-within:shadow-[0_0_12px_rgba(59,130,246,0.15)]">
          <Search size={16} className="shrink-0 text-chrome-text" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar cliente por nombre, CPF, email..."
            value={globalSearch}
            onChange={handleSearchChange}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-chrome-text"
          />

          {/* Insignia visual del atajo Ctrl+K cuando no hay texto */}
          {!globalSearch && !isSearchFocused && (
            <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-chrome-border bg-chrome-bg px-1.5 py-0.5 text-[10px] font-medium text-chrome-text shadow-sm">
              <span className="text-[11px]">Ctrl</span> K
            </kbd>
          )}

          {globalSearch && (
            <button
              onClick={onClearSearch}
              className="shrink-0 text-chrome-text hover:text-white p-0.5 rounded"
              aria-label="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown de Clientes Recientes al enfocar búsqueda vacía */}
        {showRecents && (
          <div className="absolute top-full z-[100] mt-1.5 w-full overflow-hidden rounded-lg border border-chrome-border bg-chrome-bg-raised shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between border-b border-chrome-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-chrome-text">
              <span className="flex items-center gap-1.5">
                <Clock size={12} /> Clientes recientes
              </span>
              <span className="text-[10px] lowercase text-chrome-text/70">Historial de navegación</span>
            </div>
            <div className="max-h-[260px] overflow-y-auto p-1 flex flex-col gap-0.5">
              {recentClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onNavigateToClient(c.id, c.nombre);
                    setIsSearchFocused(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left rounded-md text-xs text-white hover:bg-chrome-accent/15 transition-colors group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-chrome-bg text-[10px] font-bold text-chrome-accent group-hover:bg-chrome-accent group-hover:text-white transition-colors">
                      {c.nombre ? c.nombre.substring(0, 1).toUpperCase() : '#'}
                    </span>
                    <span className="truncate font-medium">{c.nombre}</span>
                  </div>
                  <span className="text-[10px] text-chrome-text group-hover:text-chrome-accent transition-colors">
                    Abrir ficha →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── DERECHA: ACCIONES RÁPIDAS (PILOTO IA, TEMA, NOTIFICACIONES, NUEVO CLIENTE) ─── */}
      <div className="flex flex-1 items-center justify-end gap-2">
        {/* Piloto Automático IA */}
        <button
          onClick={() => {
            if (navigateToAgent) {
              navigateToAgent();
            } else {
              openControlCenter();
            }
          }}
          className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 ${
            currentView === 'agent'
              ? 'bg-indigo-600/30 border-indigo-500/70 text-indigo-200 ring-2 ring-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.35)]'
              : isProcessingNow
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse'
                : isAgentRunning
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)] hover:bg-emerald-500/25'
                  : 'bg-chrome-bg-raised/70 border-chrome-border text-chrome-text hover:text-white hover:border-chrome-accent/50'
          }`}
          title="Abrir Centro de Control del Piloto Automático IA"
        >
          <span className="relative flex h-2 w-2">
            {isAgentRunning && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isProcessingNow ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isProcessingNow ? 'bg-amber-400' : isAgentRunning ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
          </span>
          <Bot size={15} className={isProcessingNow ? 'animate-bounce text-amber-300' : currentView === 'agent' ? 'text-indigo-300' : isAgentRunning ? 'text-emerald-300' : 'text-chrome-text'} />
          <span className="hidden md:inline font-mono text-[11px] font-bold tracking-tight">
            {isProcessingNow ? 'IA Trabajando...' : isAgentRunning ? 'PILOTO ON' : 'PILOTO OFF'}
          </span>
        </button>

        {/* Selector de Tema */}
        <button
          onClick={toggleTheme}
          className="inline-flex items-center justify-center rounded-lg p-2 text-chrome-text hover:bg-chrome-bg-raised hover:text-white transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notificaciones */}
        <div className="relative">
          <button
            className="relative inline-flex items-center justify-center rounded-lg p-2 text-chrome-text hover:bg-chrome-bg-raised hover:text-white transition-colors"
            aria-label="Notificaciones"
            onClick={toggleNotifMenu}
            title="Notificaciones"
          >
            <Bell size={18} />
            {notificaciones.length > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                {notificaciones.length > 9 ? '9+' : notificaciones.length}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 top-full z-[100] mt-1.5 flex max-h-[400px] w-80 flex-col overflow-y-auto rounded-xl border border-chrome-border bg-chrome-bg-raised shadow-2xl">
              <div className="flex items-center justify-between border-b border-chrome-border px-4 py-3 font-semibold text-xs text-white">
                <span>Notificaciones</span>
                <span className="text-[10px] text-chrome-text font-normal">{notificaciones.length} pendientes</span>
              </div>
              {notificaciones.length === 0 ? (
                <div className="p-8 text-center text-xs text-chrome-text">
                  No tienes notificaciones pendientes
                </div>
              ) : (
                notificaciones.map(n => {
                  const isUrgent = n.mensaje.includes('🚨');
                  return (
                    <div
                      key={n.id}
                      className="flex cursor-pointer flex-col gap-1.5 border-b border-chrome-border/60 p-3.5 hover:bg-chrome-bg-active/50 transition-colors"
                      style={{
                        background: isUrgent ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                        borderLeft: isUrgent ? '3px solid #ef4444' : 'none',
                      }}
                      onClick={() => {
                        markNotifAsRead(n.id);
                        if (n.cliente_id && onNavigateToClient) {
                          onNavigateToClient(n.cliente_id);
                        }
                      }}
                    >
                      <span className={isUrgent ? 'text-xs font-semibold text-rose-400' : 'text-xs text-white font-medium'}>
                        {n.mensaje}
                      </span>
                      <span className="text-[10px] text-chrome-text">
                        {new Date(n.creado_en).toLocaleString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Acceso Rápido a Configuración */}
        {navigateToSettings && (
          <button
            onClick={navigateToSettings}
            className={`inline-flex items-center justify-center rounded-lg p-2 transition-colors ${
              currentView === 'settings'
                ? 'bg-chrome-accent/15 text-chrome-accent'
                : 'text-chrome-text hover:bg-chrome-bg-raised hover:text-white'
            }`}
            title="Configuración del Sistema"
            aria-label="Configuración"
          >
            <Settings size={18} />
          </button>
        )}

        {/* Botón "+ Nuevo Cliente" */}
        {onNewClient && (
          <Button
            variant="primary"
            size="sm"
            onClick={onNewClient}
            className="ml-1 text-xs font-medium shadow-md flex items-center gap-1.5 px-3 py-1.5"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Nuevo Cliente</span>
          </Button>
        )}
      </div>
    </header>
  );
}
