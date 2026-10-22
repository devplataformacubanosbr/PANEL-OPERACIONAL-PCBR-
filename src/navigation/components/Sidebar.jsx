import React, { useState, useEffect } from 'react';
import {
  Users,
  MessageSquare,
  Shield,
  X,
  LogOut,
  BookOpen,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '../../features/auth/context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useAutonomousAgent } from '../../context/AutonomousAgentContext';

const orgInitials = (name) => {
  const clean = String(name || '').trim();
  if (!clean) return '··';
  const parts = clean.split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : clean.substring(0, 2).toUpperCase();
};

export default function Sidebar({
  currentView,
  isSidebarOpen,
  setIsSidebarOpen,
  navigateToDashboard,
  navigateToClientsList,
  navigateToTeamChat,
  navigateToTeamManagement,
  navigateToDirectory,
  navigateToSettings,
}) {
  const { userProfile, logout, isAdmin } = useAuth();
  const { organizationName, logoUrl } = useOrganization();
  const { isAgentRunning, isProcessingNow, openControlCenter, isModalOpen } = useAutonomousAgent();

  // Estado de expansión persistido en localStorage
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('app_sidebar_expanded');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleExpanded = () => {
    setIsExpanded(prev => {
      const next = !prev;
      localStorage.setItem('app_sidebar_expanded', String(next));
      return next;
    });
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-chrome-bg border-r border-chrome-border transition-all duration-200 select-none z-30 shrink-0 h-full overflow-hidden',
        !isSidebarOpen ? 'w-0 opacity-0 pointer-events-none' : isExpanded ? 'w-[224px] opacity-100' : 'w-[68px] opacity-100'
      )}
    >
      {/* ── LOGO / ORG HEADER ──────────────────────────────────────────────── */}
      <div className="flex h-[68px] items-center justify-between px-3.5 border-b border-chrome-border/60">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-chrome-accent text-sm font-bold text-white shadow-sm"
            title={organizationName}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={organizationName} className="h-full w-full object-contain" />
            ) : (
              orgInitials(organizationName)
            )}
          </div>
          {isExpanded && (
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-xs font-semibold text-white tracking-tight">
                {organizationName || 'PCBR Operacional'}
              </span>
              <span className="text-[10px] text-chrome-text flex items-center gap-1 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Panel Activo
              </span>
            </div>
          )}
        </div>

        {/* Botón de colapsar / expandir en cabecera (visible cuando expandido) */}
        {isExpanded && (
          <button
            onClick={toggleExpanded}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-chrome-text hover:bg-chrome-bg-raised hover:text-white transition-colors"
            title="Contraer menú lateral"
            aria-label="Contraer menú lateral"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* ── NAVIGATION LIST ────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-4">
        {/* Sección: Principal */}
        <div className="flex flex-col gap-1">
          {isExpanded && (
            <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-chrome-text/70">
              Principal
            </span>
          )}
          <SidebarNavItem
            icon={<BarChart3 size={19} />}
            label="Dashboard"
            active={currentView === 'dashboard'}
            isExpanded={isExpanded}
            onClick={navigateToDashboard}
          />
          <SidebarNavItem
            icon={<Users size={19} />}
            label="Clientes"
            active={currentView === 'clients' || currentView === 'client'}
            isExpanded={isExpanded}
            onClick={navigateToClientsList}
          />
        </div>

        {/* Sección: Operaciones */}
        <div className="flex flex-col gap-1">
          {isExpanded && (
            <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-chrome-text/70">
              Operaciones
            </span>
          )}
          <SidebarNavItem
            icon={
              <Bot
                size={19}
                className={cn(
                  'transition-transform',
                  isProcessingNow ? 'text-amber-400 animate-pulse' : isAgentRunning ? 'text-emerald-400' : ''
                )}
              />
            }
            label="Piloto Automático"
            active={isModalOpen}
            isExpanded={isExpanded}
            onClick={openControlCenter}
            badge={
              <span
                className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none',
                  isProcessingNow
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : isAgentRunning
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                )}
              >
                {isProcessingNow ? 'ACTIVO' : isAgentRunning ? 'ON' : 'OFF'}
              </span>
            }
          />
          <SidebarNavItem
            icon={<MessageSquare size={19} />}
            label="Mensajes"
            active={currentView === 'team-chat'}
            isExpanded={isExpanded}
            onClick={navigateToTeamChat}
          />
          <SidebarNavItem
            icon={<BookOpen size={19} />}
            label="Directorio"
            active={currentView === 'directory'}
            isExpanded={isExpanded}
            onClick={navigateToDirectory}
          />
        </div>

        {/* Sección: Administración & Configuración */}
        <div className="flex flex-col gap-1 mt-auto">
          {isExpanded && (
            <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-chrome-text/70">
              Sistema
            </span>
          )}
          {isAdmin && (
            <SidebarNavItem
              icon={<Shield size={19} />}
              label="Equipo"
              active={currentView === 'team-management'}
              isExpanded={isExpanded}
              onClick={navigateToTeamManagement}
            />
          )}
          {navigateToSettings && (
            <SidebarNavItem
              icon={<Settings size={19} />}
              label="Configuración"
              active={currentView === 'settings'}
              isExpanded={isExpanded}
              onClick={navigateToSettings}
            />
          )}
        </div>
      </nav>

      {/* ── FOOTER: USER & TOGGLE ──────────────────────────────────────────── */}
      <div className="border-t border-chrome-border/60 p-2 flex flex-col gap-2 bg-chrome-bg/50">
        <div className={cn('flex items-center gap-2 p-1.5 rounded-lg', isExpanded ? 'justify-between' : 'justify-center')}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chrome-bg-active text-xs font-semibold text-white shadow-sm border border-chrome-border"
              title={userProfile ? userProfile.nombre : 'Usuario'}
            >
              {userProfile ? userProfile.nombre.substring(0, 2).toUpperCase() : 'US'}
            </div>
            {isExpanded && (
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-xs font-medium text-white">
                  {userProfile ? userProfile.nombre : 'Usuario'}
                </span>
                <span className="truncate text-[10px] text-chrome-text capitalize">
                  {userProfile?.rol || (isAdmin ? 'Administrador' : 'Operador')}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-chrome-text hover:bg-red-500/10 hover:text-red-400 transition-colors"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Botón de expandir cuando el menú está colapsado */}
        {!isExpanded && (
          <button
            onClick={toggleExpanded}
            className="flex w-full items-center justify-center rounded-md py-1.5 text-chrome-text hover:bg-chrome-bg-raised hover:text-white transition-colors"
            title="Expandir menú lateral"
            aria-label="Expandir menú lateral"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}
      </div>
    </aside>
  );
}

// ── COMPONENTE INDIVIDUAL DE BOTÓN EN EL SIDEBAR ──────────────────────────────
function SidebarNavItem({ icon, label, active, isExpanded, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      title={!isExpanded ? label : undefined}
      aria-label={label}
      className={cn(
        'group relative flex items-center rounded-lg py-2.5 transition-all duration-150',
        isExpanded ? 'w-full px-3 gap-3 justify-start' : 'w-full justify-center px-0',
        active
          ? 'bg-chrome-accent/15 text-white font-medium shadow-sm'
          : 'text-chrome-text hover:bg-chrome-bg-raised hover:text-white'
      )}
    >
      {/* Indicador visual activo (línea vertical izquierda) */}
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-chrome-accent" />
      )}

      {/* Icono */}
      <span className={cn('shrink-0 transition-colors', active ? 'text-chrome-accent' : 'text-chrome-text group-hover:text-white')}>
        {icon}
      </span>

      {/* Etiqueta textual (solo cuando está expandido) */}
      {isExpanded && (
        <span className="truncate text-sm tracking-tight text-left flex-1">
          {label}
        </span>
      )}

      {/* Badge opcional cuando está expandido */}
      {isExpanded && badge && (
        <span className="shrink-0">{badge}</span>
      )}

      {/* Tooltip flotante instantáneo en modo colapsado */}
      {!isExpanded && (
        <span className="pointer-events-none absolute left-full ml-2.5 hidden rounded-md bg-[#0b0f19] px-2.5 py-1 text-xs font-medium text-white shadow-xl border border-white/10 group-hover:flex items-center whitespace-nowrap z-50">
          {label}
        </span>
      )}
    </button>
  );
}
