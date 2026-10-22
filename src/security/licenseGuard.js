/**
 * licenseGuard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Sistema de Protección Anti-Replicación y Licenciamiento Seguro (PCBR).
 * 
 * Principio:
 * 1. Anclaje a dominios oficiales autorizados (producción y desarrollo).
 * 2. Cero bucles destructivos (nunca congela el navegador ni corrompe React).
 * 3. En caso de copia o clonación no autorizada, muestra un bloqueo limpio
 *    en lugar de colgarse indefinidamente en 'cargando'.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const AUTHORIZED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'cubanosbr.com',
  '*.cubanosbr.com',
  'panel.cubanosbr.com',
  'operacional.cubanosbr.com',
  'app.cubanosbr.com',
  'herramientas-devpcbr-dashboard-operacional-pcbr.ess6g1.easypanel.host',
  '*.easypanel.host',
  'dashboard-operacional.pages.dev',
  '*.pages.dev',
  'dashboard-operacional.vercel.app',
  '*.vercel.app'
];

/**
 * Comprueba si el host actual tiene autorización para ejecutar el sistema.
 */
export function checkLicenseIntegrity() {
  // En modo desarrollo local siempre permitir
  if (import.meta.env.DEV) return true;

  const currentHost = (typeof window !== 'undefined' ? window.location.hostname : '').toLowerCase();

  // Si está vacío (ej. SSR o tests)
  if (!currentHost) return true;

  // Permitir localhost e IPs locales de red (192.168.x, 10.x, etc.)
  if (
    currentHost === 'localhost' ||
    currentHost === '127.0.0.1' ||
    currentHost.startsWith('192.168.') ||
    currentHost.startsWith('10.') ||
    currentHost.endsWith('.local')
  ) {
    return true;
  }

  // 1. Anti-Iframe / Anti-Clickjacking: previene que un sitio tercero clone o incruste el dashboard
  try {
    if (typeof window !== 'undefined' && window.top !== window.self) {
      window.top.location = window.self.location.href;
    }
  } catch (_err) {
    // Si salta SecurityError por cross-origin, significa que está incrustado en un dominio ajeno
    renderLicenseBlockedScreen('Incrustación no autorizada detectada (Anti-Iframe / Clickjacking)');
    return false;
  }

  // 2. Comprobar dominios autorizados y variables de entorno adicionales
  const extraHosts = import.meta.env.VITE_AUTHORIZED_HOSTS
    ? import.meta.env.VITE_AUTHORIZED_HOSTS.split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
    : [];

  const allAllowed = [...AUTHORIZED_DOMAINS, ...extraHosts];

  const isAllowed = allAllowed.some(domain => {
    if (domain.startsWith('*.')) {
      const root = domain.slice(2);
      return currentHost === root || currentHost.endsWith('.' + root);
    }
    return currentHost === domain || currentHost.endsWith('.' + domain);
  });

  if (!isAllowed) {
    renderLicenseBlockedScreen(currentHost);
    return false;
  }

  // 3. Verificación de backend legítimo (el dashboard solo debe operar con el backend de PCBR)
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').toLowerCase();
  const isOfficialBackend = !supabaseUrl || supabaseUrl.includes('kxtshulqjkkgcrxhegiv') || supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1');
  if (!isOfficialBackend) {
    renderLicenseBlockedScreen('Backend Supabase no autorizado para esta versión');
    return false;
  }

  return true;
}

/**
 * Renderiza una pantalla de bloqueo explícita en caso de copia no autorizada.
 */
function renderLicenseBlockedScreen(host) {
  if (typeof document === 'undefined' || !document.body) return;

  // Detener la carga de React sustituyendo el contenedor principal
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = '';
  }

  const container = document.createElement('div');
  container.id = 'pcbr-license-airlock';
  container.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999999;
    background: #080c16;
    color: #f1f5f9;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 24px;
    text-align: center;
  `;

  container.innerHTML = `
    <div style="max-width: 480px; background: rgba(255,255,255,0.03); border: 1px solid rgba(239,68,68,0.3); border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
      <div style="width: 56px; height: 56px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; color: #f87171; font-size: 28px;">
        🛡️
      </div>
      <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 10px 0; color: #ffffff;">
        Software Protegido — Licencia No Autorizada
      </h2>
      <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0 0 20px 0;">
        Este sistema contiene algoritmos propietarios de Cubanos en Brasil (PCBR). La ejecución en el host <strong style="color: #f87171; font-family: monospace;">${host}</strong> no cuenta con autorización activa.
      </p>
      <div style="font-size: 11px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;">
        Para solicitar autorización de despliegue o activar un dominio, contacte al administrador oficial del sistema.
      </div>
    </div>
  `;

  document.body.appendChild(container);
}
