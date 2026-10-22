/**
 * antiTamperEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de Blindaje Activo y Anti-Manipulación (Anti-Tamper & Anti-DevTools).
 * Protege la aplicación contra ingeniería inversa, inspección de memoria en
 * DevTools, extracción de código en tiempo de ejecución y copias no autorizadas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const IS_PROD = import.meta.env.PROD;

/**
 * Inicializa los escudos activos de anti-inspección y anti-depuración.
 */
export function initAntiTamperEngine() {
  if (!IS_PROD) {
    // En desarrollo local autorizado no bloqueamos la consola de desarrollo
    return;
  }

  // 1. SILENCIADO TOTAL DE CONSOLA (Cero fugas de datos y variables de estado)
  blindConsole();

  // 2. BLOQUEO DE ATAJOS DE TECLADO Y MENÚ CONTEXTUAL (F12, Ctrl+Shift+I, etc.)
  blockInspectionShortcuts();

  // 3. TRAMPA ACTIVA ANTI-DEBUGGER
  // Si alguien abre las herramientas de desarrollo, se activa un bucle recursivo
  // que congela la pestaña e impide colocar puntos de interrupción (breakpoints).
  launchAntiDebugTrap();
}

/**
 * Sobrescribe todos los métodos de consola para evitar filtración de datos sensibles.
 */
function blindConsole() {
  try {
    const noop = () => {};
    const methods = ['log', 'debug', 'info', 'warn', 'error', 'dir', 'table', 'trace', 'group', 'groupCollapsed', 'groupEnd'];
    for (const m of methods) {
      if (window.console && window.console[m]) {
        window.console[m] = noop;
      }
    }
  } catch {
    // Silencioso por diseño
  }
}

/**
 * Bloquea clic derecho (inspeccionar elemento) y atajos de teclado estándar de DevTools.
 */
function blockInspectionShortcuts() {
  // Desactivar clic derecho
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, true);

  // Desactivar F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
  window.addEventListener('keydown', (e) => {
    // F12
    if (e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+I (Inspeccionar) o Ctrl+Shift+J (Consola) o Ctrl+Shift+C (Selector)
    if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+U (Ver código fuente)
    if (e.ctrlKey && (e.keyCode === 85 || e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Cmd+Alt+I (Mac)
    if (e.metaKey && e.altKey && (e.keyCode === 73 || e.keyCode === 74)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);
}

/**
 * Lanza una trampa asíncrona de debugger recursivo.
 * Si las DevTools están abiertas, el navegador detiene la ejecución en 'debugger',
 * pero al estar en un bucle temporal sin fin, congela la inspección del atacante.
 */
function launchAntiDebugTrap() {
  let isTrapActive = false;

  const triggerTrap = () => {
    if (isTrapActive) return;
    isTrapActive = true;

    const trap = function() {
      (function() {
        const check = function() {
          const t0 = performance.now();
          // eslint-disable-next-line no-debugger
          debugger;
          const t1 = performance.now();
          // Si el tiempo de paso es > 100ms, significa que DevTools interceptó el debugger
          if (t1 - t0 > 100) {
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = 'about:blank';
          }
        };
        check();
      })();
    };

    setInterval(trap, 1500);
  };

  // Activar tras un breve retardo para permitir que el bootstrap inicial termine
  setTimeout(triggerTrap, 2000);
}
