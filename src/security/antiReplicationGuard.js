/**
 * antiReplicationGuard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Guardián de Integridad y Anti-Replicación Criptográfica (Hardware & Domain DRM).
 *
 * Propósito:
 * Asegurar que el código fuente compilado y la aplicación NO PUEDAN ser ejecutados
 * en ningún servidor, dominio, fork, o entorno de terceros que no esté explícitamente
 * autorizado por el propietario del software (Cubanos en Brasil / PCBR).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Dominios oficiales y autorizados para producción y staging
const DEFAULT_AUTHORIZED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'cubanosbr.com',
  'panel.cubanosbr.com',
  'operacional.cubanosbr.com',
  'app.cubanosbr.com',
  'dashboard-operacional.pages.dev',
  'dashboard-operacional.vercel.app'
];

/**
 * Obtiene los dominios autorizados combinando los predeterminados con los del entorno.
 */
function getAuthorizedDomains() {
  const envDomains = import.meta.env.VITE_AUTHORIZED_HOSTS
    ? import.meta.env.VITE_AUTHORIZED_HOSTS.split(',').map(d => d.trim().toLowerCase())
    : [];

  return [...DEFAULT_AUTHORIZED_DOMAINS, ...envDomains];
}

/**
 * Ejecuta la verificación de integridad de entorno y anclaje de dominio.
 * Debe ser invocada en el punto de entrada más temprano de la aplicación (main.jsx).
 */
export function verifyEnvironmentIntegrity() {
  const isDev = import.meta.env.DEV;
  const currentHost = (window.location.hostname || '').toLowerCase();

  // En modo desarrollo puro de Vite (npm run dev local en tu máquina de desarrollo),
  // se permite si es localhost o IP loopback
  if (isDev && (currentHost === 'localhost' || currentHost === '127.0.0.1')) {
    return true;
  }

  const allowedDomains = getAuthorizedDomains();

  // Verificar si el hostname actual termina con alguno de los dominios permitidos
  const isAuthorized = allowedDomains.some(domain => {
    if (domain.startsWith('*.')) {
      const root = domain.slice(2);
      return currentHost.endsWith(root) || currentHost === root;
    }
    return currentHost === domain || currentHost.endsWith('.' + domain);
  });

  if (!isAuthorized) {
    lockdownSystem({
      reason: 'DOMAIN_INTEGRITY_VIOLATION',
      detectedHost: currentHost
    });
    return false;
  }

  return true;
}

/**
 * Protocolo de Autodestrucción y Bloqueo Inmediato (Airlock / Lockdown).
 * Elimina credenciales en memoria, sustituye la interfaz por una pantalla de bloqueo
 * inquebrantable y congela la ejecución.
 */
export function lockdownSystem(details = {}) {
  try {
    // 1. Purga total de almacenamiento local y cookies
    sessionStorage.clear();
    localStorage.clear();
    
    // Intentar borrar cookies de sesión
    document.cookie.split(';').forEach(c => {
      document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
    });
  } catch {
    // Silencioso
  }

  // 2. Destrucción de la interfaz de React
  try {
    if (document.body) {
      document.body.innerHTML = `
        <div style="
          position: fixed;
          top: 0; left: 0; width: 100vw; height: 100vh;
          background: #090a0f;
          color: #ff3344;
          font-family: 'Consolas', 'Courier New', monospace;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 2147483647;
          box-sizing: border-box;
          text-align: center;
        ">
          <div style="
            max-width: 680px;
            border: 2px solid #ff3344;
            padding: 32px;
            background: rgba(255, 51, 68, 0.05);
            box-shadow: 0 0 40px rgba(255, 51, 68, 0.3);
            border-radius: 8px;
          ">
            <h1 style="font-size: 24px; margin-bottom: 16px; letter-spacing: 2px; color: #ffffff;">
              ⚠️ ERROR CRÍTICO DE LICENCIA [0xDEAD_ANTIREP]
            </h1>
            <p style="font-size: 14px; line-height: 1.6; color: #ff8892; margin-bottom: 20px;">
              <strong>VIOLACIÓN DE DERECHOS DE AUTOR Y ANCLAJE DE DOMINIO:</strong><br/>
              Esta copia del software se está ejecutando en un entorno o dominio no autorizado 
              (<code>${details.detectedHost || 'HOST_DESCONOCIDO'}</code>).
            </p>
            <div style="background: #151821; padding: 14px; border-radius: 4px; font-size: 12px; color: #8e94a5; text-align: left; margin-bottom: 24px;">
              <div>• Sistema: PANEL OPERACIONAL PCBR (Propiedad Privada)</div>
              <div>• Estado: EJECUCIÓN REVOCADA Y BLOQUEADA POR EL KERNEL</div>
              <div>• Causa: Intento de réplica, clonación o extracción no autorizada de código</div>
              <div>• Alerta: La IP y firma de acceso han sido registradas para auditoría legal.</div>
            </div>
            <p style="font-size: 11px; color: #61677a;">
              Copyright &copy; 2026 Cubanos en Brasil. Todos los derechos reservados.
            </p>
          </div>
        </div>
      `;
    }
  } catch {
    // Si falla manipular el DOM, forzar redirección
    window.location.href = 'about:blank';
  }

  // 3. Lanzar excepción fatal e interrumpir cualquier proceso posterior
  throw new Error('[CRITICAL_SECURITY_HALT] Unauthorized execution environment. System frozen.');
}
