import { fillSismigraForm } from './autofill.js';
import { injectOrUpdateBtn, hideFloatingBtn, setupContextEvents } from './ui.js';

// 1. Escuchar mensajes desde el Dashboard Web (localhost o dominio de producción)
//
// El content script corre en <all_urls> (el Dashboard puede vivir en cualquier
// dominio/subdominio), así que CUALQUIER página podría hacerse un
// postMessage(..., '*') a sí misma con type: 'DASHBOARD_SYNC' y envenenar el
// cliente activo que luego se autocompleta en SERPRO/PF/MJ con CPF/pasaporte
// reales. localhost/127.0.0.1 (desarrollo) siempre son confiables; en
// producción, el usuario debe configurar "Dashboard URL" en el popup de la
// extensión para que solo ese origen sea aceptado.
const TRUSTED_LOCAL_ORIGIN_PREFIXES = ['http://localhost', 'http://127.0.0.1'];

window.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== 'DASHBOARD_SYNC') return;
  if (event.source !== window) return; // ignorar mensajes reenviados desde otros frames/ventanas

  chrome.storage.local.get(['dashboardUrl'], (res) => {
    const isTrustedLocal = TRUSTED_LOCAL_ORIGIN_PREFIXES.some(p => event.origin.startsWith(p));
    const trustedConfigured = (res.dashboardUrl || '').replace(/\/$/, '');
    const isTrustedConfigured = trustedConfigured && event.origin === trustedConfigured;

    if (!isTrustedLocal && !isTrustedConfigured) {
      if (trustedConfigured) {
        console.warn(`Dashboard Auto-Fill: mensaje DASHBOARD_SYNC ignorado (origen no confiable: ${event.origin})`);
        return;
      }
      console.warn(`Dashboard Auto-Fill: aceptando DASHBOARD_SYNC de un origen sin verificar (${event.origin}). Configura "Dashboard URL" en el popup de la extensión para restringirlo.`);
    }

    const clientData = event.data.clientData;
    const activeClientRelatives = event.data.activeClientRelatives || [];
    console.log("Dashboard Auto-Fill: Datos recibidos del Dashboard", clientData);

    // Guardar en el storage de la extensión
    chrome.storage.local.set({
      activeClient: clientData,
      activeClientRelatives: activeClientRelatives
    }, () => {
      console.log("Cliente activo guardado en la extensión:", clientData.nombre);
    });
  });
});

// 2. Listener antiguo (por si clican desde el popup)
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "fillForm") {
    const fieldsFilled = fillSismigraForm(request.data);
    sendResponse({ status: "success", count: fieldsFilled });
    return true;
  }
});

// 3. Inyectar UI flotante solo si hay campos de formulario
const allowedDomains = [
  'serpro.gov.br',
  'pf.gov.br',
  'mj.gov.br',
  'tally.so'
];
const isAllowedDomain = allowedDomains.some(domain => window.location.hostname.includes(domain));

if (isAllowedDomain) {
  let currentClient = null;

  const checkUI = () => {
    if (currentClient && currentClient.nombre) {
      injectOrUpdateBtn(currentClient);
    }
  };

  // 1. Initial check
  chrome.storage.local.get(['activeClient'], (res) => {
    if (res.activeClient && res.activeClient.nombre) {
      currentClient = res.activeClient;
      checkUI();
      
      // Observar cambios en el DOM para aplicaciones SPA (Single Page Applications)
      let observerTimeout;
      const observer = new MutationObserver(() => {
        if (observerTimeout) clearTimeout(observerTimeout);
        observerTimeout = setTimeout(() => {
          checkUI();
        }, 800);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });

  // 2. Listen for changes so it updates instantly
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.activeClient && changes.activeClient.newValue) {
      currentClient = changes.activeClient.newValue;
      if (!currentClient || !currentClient.nombre) {
        hideFloatingBtn();
      } else {
        checkUI();
      }
    }
  });

  // Configurar eventos de menú contextual
  setupContextEvents();
}
