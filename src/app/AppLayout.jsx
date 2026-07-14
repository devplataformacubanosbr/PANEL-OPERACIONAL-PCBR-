import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// Navigation
import Sidebar from '../navigation/components/Sidebar';
import Header from '../navigation/components/Header';
import { useNavigation } from '../hooks/useNavigation';
import { useSearch } from '../hooks/useSearch';
import useRecentClients from '../hooks/useRecentClients';
import { supabase } from '../supabaseClient';

// Auth
import { useAuth } from '../features/auth/context/AuthContext';
import LoginForm from '../features/auth/components/LoginForm';
import SetPasswordForm from '../features/auth/components/SetPasswordForm';
import { LoadingSpinner } from '../shared/components/ui/LoadingSpinner';

// AI Chat
import { GlobalAiChatProvider } from '../context/GlobalAiChatContext';
import { GlobalAiChat } from '../components/GlobalAiChat';
import { GlobalBotListener } from '../components/GlobalBotListener';

// Views
const HomeView = lazy(() => import('../components/HomeView'));
const ClientView = lazy(() => import('../components/ClientView'));
const ClientListView = lazy(() => import('../components/ClientListView'));
const NewClientWizard = lazy(() => import('../components/newClientWizard/NewClientWizard'));
const TeamChat = lazy(() => import('../components/TeamChat'));
const TeamManagement = lazy(() => import('../components/TeamManagement'));
const SettingsView = lazy(() => import('../components/SettingsView'));
const AutomationsView = lazy(() => import('../components/AutomationsView'));

import '../App.css';

/**
 * AppLayout — Layout principal de la aplicación autenticada.
 * Orquesta: Sidebar + Header + Main Content + Global Chat Slider.
 * Toda la lógica de estado fue delegada a contexts y hooks.
 */
export default function AppLayout() {
  const { loading, userProfile, isAuthenticated, authError } = useAuth();

  // --- Navigation ---
  const {
    currentView,
    selectedClientId,
    navigateToClient,
    navigateToHome,
    navigateToClientsList,
    navigateToTeamChat,
    navigateToTeamManagement,
    navigateToSettings,
    navigateToAutomations,
  } = useNavigation(isAuthenticated);

  // --- Recent clients (accesos rápidos al enfocar la búsqueda vacía) ---
  const { recentClients, addRecentClient } = useRecentClients();
  const navigateToClientTracked = useCallback((clientId, clientName) => {
    navigateToClient(clientId);
    if (clientName) {
      addRecentClient({ id: clientId, nombre: clientName });
    } else {
      supabase.from('clientes').select('id, nombre').eq('id', clientId).maybeSingle()
        .then(({ data }) => { if (data?.nombre) addRecentClient(data); });
    }
  }, [navigateToClient, addRecentClient]);

  // --- Sidebar ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isGlobalTeamChatOpen, setIsGlobalTeamChatOpen] = useState(false);

  // Automatically close sidebar on client view
  useEffect(() => {
    if (currentView === 'client') {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
    }
  }, [currentView]);

  // --- Search ---
  // Only 'dashboard' (Pipeline) and 'clients' filter in place; every other view
  // needs to jump to the client list so the search actually shows results.
  const onSearchStart = useCallback(() => {
    if (currentView !== 'dashboard' && currentView !== 'clients') {
      navigateToClientsList();
    }
  }, [currentView, navigateToClientsList]);

  const { globalSearch, setGlobalSearch, handleSearchChange } = useSearch(onSearchStart);

  // --- New Client Modal ---
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);

  // --- Invitación / recuperación de contraseña ---
  // El link de invite-team-member (o un futuro "olvidé mi contraseña") deja
  // a Supabase Auth con una sesión válida pero sin contraseña puesta —
  // detectamos el ?type=invite/recovery del hash antes de que se limpie.
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(() => {
    const hash = window.location.hash;
    return hash.includes('type=invite') || hash.includes('type=recovery');
  });

  // --- Loading State ---
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--color-text-primary)' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }


  // --- Not Authenticated ---
  // Herramienta interna de una sola empresa: no hay landing pública ni
  // alta de cuenta autoservicio, solo login (las cuentas las crea un
  // admin desde Equipo).
  if (!isAuthenticated) {
    return <LoginForm initialError={authError} />;
  }

  if (needsPasswordSetup) {
    return <SetPasswordForm onDone={() => setNeedsPasswordSetup(false)} />;
  }

  // --- Main Layout ---
  return (
    <GlobalAiChatProvider selectedClientId={currentView === 'client' ? selectedClientId : null}>
      <div className="app-layout" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          navigateToHome={navigateToHome}
          navigateToClientsList={navigateToClientsList}
          navigateToTeamChat={navigateToTeamChat}
          navigateToTeamManagement={navigateToTeamManagement}
          navigateToAutomations={navigateToAutomations}
        />

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'transparent', overflow: 'hidden' }}>

          {/* Header */}
          <Header
            currentView={currentView}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            navigateToHome={navigateToHome}
            navigateToSettings={navigateToSettings}
            globalSearch={globalSearch}
            handleSearchChange={handleSearchChange}
            onClearSearch={() => setGlobalSearch('')}
            onNavigateToClient={navigateToClientTracked}
            recentClients={recentClients}
            onNewClient={() => setIsNewClientModalOpen(true)}
          />

          {/* Main Content */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: currentView === 'client' ? 'hidden' : 'auto' }}>
            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><LoadingSpinner size="lg" /></div>}>
              {currentView === 'dashboard' && <HomeView onNavigateToClient={navigateToClientTracked} onNavigateToClientsList={navigateToClientsList} searchQuery={globalSearch} onClearSearch={() => setGlobalSearch('')} />}
              {currentView === 'client' && <ClientView clientId={selectedClientId} onBack={navigateToHome} onNavigateToClient={navigateToClientTracked} />}
              {currentView === 'clients' && <ClientListView onNavigateToClient={navigateToClientTracked} searchQuery={globalSearch} />}
              {currentView === 'team-chat' && <TeamChat isFullView={true} />}
              {currentView === 'team-management' && <TeamManagement userProfile={userProfile} />}
              {currentView === 'settings' && <SettingsView userProfile={userProfile} />}
              {currentView === 'automations' && <AutomationsView />}
            </Suspense>
          </main>
        </div>

        {/* Global Team Chat Slider (only if not in full-screen team chat view) */}
        {currentView !== 'team-chat' && (
          <>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              width: isGlobalTeamChatOpen ? '380px' : '0px',
              minWidth: isGlobalTeamChatOpen ? '380px' : '0px',
              overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0,
              position: 'relative',
              background: 'var(--color-bg-canvas)',
              borderLeft: isGlobalTeamChatOpen ? '1px solid var(--color-border)' : 'none',
              zIndex: 100
            }}>
              <div style={{ height: '100%', width: '380px' }}>
                <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><LoadingSpinner /></div>}>
                  <TeamChat isFullView={false} />
                </Suspense>
              </div>
            </div>

            {/* Toggle del Chat de Equipo */}
            <button
              onClick={() => setIsGlobalTeamChatOpen(!isGlobalTeamChatOpen)}
              style={{
                position: 'absolute',
                right: isGlobalTeamChatOpen ? '380px' : '0px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 101,
                width: '28px',
                height: '72px',
                borderRadius: '8px 0 0 8px',
                background: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
                transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              title={isGlobalTeamChatOpen ? 'Ocultar chat de equipo' : 'Mostrar chat de equipo'}
            >
              <MessageSquare size={14} />
              {isGlobalTeamChatOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
          </>
        )}

        {/* New Client Wizard */}
        <Suspense fallback={null}>
          {isNewClientModalOpen && (
            <NewClientWizard
              onClose={() => setIsNewClientModalOpen(false)}
              onClientCreated={(client) => {
                setIsNewClientModalOpen(false);
                navigateToClientTracked(client.id, client.nombre);
              }}
            />
          )}
        </Suspense>

        <GlobalBotListener />
        <GlobalAiChat isVisible={currentView !== 'client'} currentView={currentView} onNavigateToClient={navigateToClientTracked} />
      </div>
    </GlobalAiChatProvider>
  );
}
