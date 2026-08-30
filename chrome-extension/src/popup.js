document.addEventListener('DOMContentLoaded', () => {
  const supaUrlInput = document.getElementById('supaUrl');
  const supaKeyInput = document.getElementById('supaKey');
  const groqKeyInput = document.getElementById('groqKey');
  const dashboardUrlInput = document.getElementById('dashboardUrl');
  const searchInput = document.getElementById('searchInput');
  const resultsList = document.getElementById('resultsList');
  const configSection = document.getElementById('configSection');
  const toggleConfigBtn = document.getElementById('toggleConfig');
  const saveConfigBtn = document.getElementById('saveConfig');
  const loadingDiv = document.getElementById('loading');
  const activeClientSection = document.getElementById('activeClientSection');
  const activeClientName = document.getElementById('activeClientName');
  const btnAutoFillActive = document.getElementById('btnAutoFillActive');
  const tabClientes = document.getElementById('tabClientes');
  const tabPolicia = document.getElementById('tabPolicia');
  const searchSection = document.getElementById('searchSection');
  const loginSection = document.getElementById('loginSection');
  const loginEmailInput = document.getElementById('loginEmail');
  const loginPasswordInput = document.getElementById('loginPassword');
  const loginErrorDiv = document.getElementById('loginError');
  const btnLogin = document.getElementById('btnLogin');
  const sessionBar = document.getElementById('sessionBar');
  const sessionEmailSpan = document.getElementById('sessionEmail');
  const btnLogout = document.getElementById('btnLogout');

  let searchMode = 'clientes'; // 'clientes' | 'policia'
  let supaUrl = '';
  let supaKey = '';
  let groqKey = '';
  let dashboardUrl = '';
  // Sesión real de Supabase Auth (access_token/refresh_token) — la tabla
  // `clientes` (y el resto de las tablas del sistema) tienen RLS
  // "FOR ALL TO authenticated": la sola anon key (supaKey) NUNCA alcanza para
  // leerlas, sin importar qué se busque, siempre devuelve 0 resultados. Hace
  // falta el access_token de un usuario logueado de verdad — igual que en el
  // Dashboard web — para que las búsquedas encuentren algo.
  let authSession = null; // { access_token, refresh_token, expires_at, email }

  const isSessionValid = (s) => !!(s && s.access_token && s.expires_at > Date.now());

  function saveSession(session) {
    authSession = session;
    chrome.storage.local.set({ authSession: session });
  }

  function clearSession() {
    authSession = null;
    chrome.storage.local.remove('authSession');
  }

  function getAuthHeaders() {
    return {
      apikey: supaKey,
      Authorization: `Bearer ${authSession?.access_token || supaKey}`,
    };
  }

  async function refreshSession(session) {
    if (!session?.refresh_token) return null;
    try {
      const res = await fetch(`${supaUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: supaKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.access_token) return null;
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || session.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        email: data.user?.email || session.email,
      };
    } catch (err) {
      console.warn('Dashboard Auto-Fill: error refrescando sesión', err);
      return null;
    }
  }

  // Wrapper de fetch que agrega el Authorization del usuario logueado, y si
  // el token venció (401), intenta refrescarlo una vez antes de rendirse.
  async function authFetch(url, options = {}) {
    const doFetch = () => fetch(url, {
      ...options,
      headers: { ...getAuthHeaders(), ...(options.headers || {}) },
    });

    let res = await doFetch();
    if (res.status === 401 && authSession) {
      const refreshed = await refreshSession(authSession);
      if (refreshed) {
        saveSession(refreshed);
        res = await doFetch();
      } else {
        clearSession();
        showLoginUI();
      }
    }
    return res;
  }

  function showConfigOnly() {
    configSection.style.display = 'block';
    loginSection.style.display = 'none';
    sessionBar.style.display = 'none';
    searchSection.style.display = 'none';
  }

  function showLoginUI() {
    configSection.style.display = 'none';
    loginSection.style.display = 'block';
    sessionBar.style.display = 'none';
    searchSection.style.display = 'none';
  }

  function showAppUI() {
    configSection.style.display = 'none';
    loginSection.style.display = 'none';
    sessionBar.style.display = 'flex';
    sessionEmailSpan.textContent = authSession?.email || '';
    searchSection.style.display = 'block';
  }

  async function tryEnterApp() {
    if (!supaUrl || !supaKey) {
      showConfigOnly();
      return;
    }
    if (isSessionValid(authSession)) {
      showAppUI();
      return;
    }
    // Access token vencido pero tenemos refresh_token: intentar en silencio
    // antes de pedirle la contraseña de nuevo.
    if (authSession?.refresh_token) {
      const refreshed = await refreshSession(authSession);
      if (refreshed) {
        saveSession(refreshed);
        showAppUI();
        return;
      }
    }
    clearSession();
    showLoginUI();
  }

  btnLogin.addEventListener('click', async () => {
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;
    loginErrorDiv.style.display = 'none';

    if (!supaUrl || !supaKey) {
      loginErrorDiv.textContent = 'Configurá primero la URL y la Anon Key de Supabase.';
      loginErrorDiv.style.display = 'block';
      return;
    }
    if (!email || !password) {
      loginErrorDiv.textContent = 'Completá email y contraseña.';
      loginErrorDiv.style.display = 'block';
      return;
    }

    const originalText = btnLogin.textContent;
    btnLogin.textContent = 'Ingresando...';
    btnLogin.disabled = true;
    try {
      const res = await fetch(`${supaUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: supaKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.access_token) {
        throw new Error(data.error_description || data.msg || 'Email o contraseña incorrectos.');
      }
      saveSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        email: data.user?.email || email,
      });
      loginPasswordInput.value = '';
      showAppUI();
    } catch (err) {
      loginErrorDiv.textContent = err.message;
      loginErrorDiv.style.display = 'block';
    } finally {
      btnLogin.textContent = originalText;
      btnLogin.disabled = false;
    }
  });

  loginPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnLogin.click();
  });

  btnLogout.addEventListener('click', () => {
    clearSession();
    resultsList.innerHTML = '';
    searchInput.value = '';
    showLoginUI();
  });

  // Load config and active client
  chrome.storage.local.get(['supaUrl', 'supaKey', 'groqKey', 'dashboardUrl', 'authSession', 'activeClient', 'activeClientRelatives'], (res) => {
    if (res.supaUrl && res.supaKey) {
      supaUrl = res.supaUrl;
      supaKey = res.supaKey;
      supaUrlInput.value = supaUrl;
      supaKeyInput.value = supaKey;
    }

    if (res.groqKey) {
      groqKey = res.groqKey;
      groqKeyInput.value = groqKey;
    }

    if (res.dashboardUrl) {
      dashboardUrl = res.dashboardUrl;
      dashboardUrlInput.value = dashboardUrl;
    }

    if (res.authSession) {
      authSession = res.authSession;
    }

    tryEnterApp();

    if (res.activeClient && res.activeClient.nombre) {
      activeClientSection.style.display = 'block';
      activeClientName.innerText = res.activeClient.nombre;

      const relativesContainer = document.getElementById('activeClientRelatives');
      const relativesList = document.getElementById('relativesList');
      if (res.activeClientRelatives && res.activeClientRelatives.length > 0) {
        relativesContainer.style.display = 'block';
        relativesList.innerHTML = '';
        res.activeClientRelatives.forEach(rel => {
          const btn = document.createElement('button');
          btn.style.background = 'rgba(255,255,255,0.05)';
          btn.style.color = 'var(--text)';
          btn.style.border = '1px solid rgba(255,255,255,0.1)';
          btn.style.padding = '8px 10px';
          btn.style.fontSize = '12px';
          btn.style.textAlign = 'left';
          btn.innerHTML = `<span style="color:var(--text-muted); margin-right:4px;">${rel.tipo_relacion || 'Familiar'}:</span> ${rel.nombre}`;
          btn.onclick = () => {
             // Treat the relative as a new client selection
             handleClientSelect({ id: rel.id, nombre: rel.nombre });
          };
          relativesList.appendChild(btn);
        });
      } else {
        relativesContainer.style.display = 'none';
      }

      btnAutoFillActive.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (!tabs[0]) return;
          chrome.tabs.sendMessage(tabs[0].id, { action: "fillForm", data: res.activeClient }, function(response) {
            if (chrome.runtime.lastError) {
              alert("⚠️ No se pudo autocompletar la página. Asegúrate de estar en una web compatible y recarga la pestaña.");
            } else {
              window.close();
            }
          });
        });
      });
    }
  });

  toggleConfigBtn.addEventListener('click', () => {
    const isHidden = configSection.style.display === 'none';
    if (isHidden) {
      configSection.style.display = 'block';
      loginSection.style.display = 'none';
      sessionBar.style.display = 'none';
      searchSection.style.display = 'none';
    } else {
      tryEnterApp();
    }
  });

  saveConfigBtn.addEventListener('click', () => {
    const newUrl = supaUrlInput.value.trim();
    const newKey = supaKeyInput.value.trim();
    const newGroqKey = groqKeyInput.value.trim();
    const newDashboardUrl = dashboardUrlInput.value.trim().replace(/\/$/, '');

    if (!newUrl || !newKey) {
      alert("Por favor completa la URL y Key de Supabase.");
      return;
    }

    const urlOrKeyChanged = newUrl !== supaUrl || newKey !== supaKey;

    supaUrl = newUrl;
    supaKey = newKey;
    groqKey = newGroqKey;
    dashboardUrl = newDashboardUrl;

    chrome.storage.local.set({ supaUrl, supaKey, groqKey, dashboardUrl }, () => {
      // Si cambió la URL o la key, la sesión vieja (si había) ya no sirve.
      if (urlOrKeyChanged) clearSession();

      const originalText = saveConfigBtn.innerText;
      saveConfigBtn.innerText = "¡Guardado!";
      saveConfigBtn.style.background = "#10b981";
      setTimeout(() => {
        saveConfigBtn.innerText = originalText;
        saveConfigBtn.style.background = "";
        tryEnterApp();
      }, 800);
    });
  });

  function setSearchMode(mode) {
    if (searchMode === mode) return;
    searchMode = mode;
    tabClientes.classList.toggle('active', mode === 'clientes');
    tabPolicia.classList.toggle('active', mode === 'policia');
    searchInput.placeholder = mode === 'clientes'
      ? 'Buscar por nombre, pasaporte o CPF...'
      : 'Buscar por ciudad...';
    searchInput.value = '';
    resultsList.innerHTML = '';
  }

  tabClientes.addEventListener('click', () => setSearchMode('clientes'));
  tabPolicia.addEventListener('click', () => setSearchMode('policia'));

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();
    if (q.length < 2) {
      resultsList.innerHTML = '';
      return;
    }

    searchTimeout = setTimeout(() => {
      if (searchMode === 'clientes') {
        searchClients(q);
      } else {
        searchPolicia(q);
      }
    }, 400);
  });

  async function searchClients(query) {
    if (!isSessionValid(authSession)) {
      showLoginUI();
      return;
    }

    loadingDiv.style.display = 'block';
    resultsList.innerHTML = '';

    try {
      // numero_pasaporte ya no es una columna real de `clientes` (vive en el
      // JSONB campos_personalizados) — filtrar por ella acá tira un 400 de
      // PostgREST en TODAS las búsquedas, que este catch confunde con un
      // error de credenciales.
      const url = `${supaUrl}/rest/v1/clientes?or=(nombre.ilike.%25${query}%25,cpf.ilike.%25${query}%25)&select=id,nombre,cpf,telefono&limit=15`;
      const res = await authFetch(url, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) throw new Error('Error buscando clientes');

      const clientes = await res.json();

      if (clientes.length === 0) {
        resultsList.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding: 20px 0;">No se encontraron resultados.</div>';
      } else {
        clientes.forEach(client => {
          const div = document.createElement('div');
          div.className = 'client-item';
          div.innerHTML = `
            <div class="client-name">${client.nombre}</div>
            <div class="client-cpf">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              ${client.cpf || 'Sin CPF'} • ${client.telefono || 'Sin Tel'}
            </div>
          `;
          div.addEventListener('click', () => handleClientSelect(client));
          resultsList.appendChild(div);
        });
      }
    } catch (err) {
      console.error(err);
      resultsList.innerHTML = '<div style="font-size:12px; color:#ef4444; text-align:center; padding: 10px 0;">Error de conexión. Revisa tus credenciales.</div>';
    } finally {
      loadingDiv.style.display = 'none';
    }
  }

  const ICON_MAPPIN = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
  const ICON_PHONE = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
  const ICON_MAIL = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>';
  const ICON_CLOCK = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }

  async function searchPolicia(query) {
    if (!isSessionValid(authSession)) {
      showLoginUI();
      return;
    }

    loadingDiv.style.display = 'block';
    resultsList.innerHTML = '';

    try {
      // Se llama a la función buscar_policias_por_ciudad (ver migración
      // database/standalone/014_rpc_buscar_policia_por_ciudad.sql) en vez de
      // consultar ciudades/policias directo: esas tablas tienen la misma RLS
      // "solo authenticated" que el resto del sistema, así que hace falta el
      // access_token de la sesión igual que en searchClients.
      const res = await authFetch(`${supaUrl}/rest/v1/rpc/buscar_policias_por_ciudad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busqueda: query }),
      });

      if (!res.ok) throw new Error('Error buscando ciudades');

      const resultados = (await res.json()).map(p => ({
        ...p,
        ciudadesCoincidentes: p.ciudades_coincidentes || []
      }));

      if (resultados.length === 0) {
        resultsList.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding: 20px 0;">No se encontró ninguna policía para esa ciudad.</div>';
      } else {
        resultados.forEach(p => {
          const div = document.createElement('div');
          div.className = 'policia-item';

          const badges = p.ciudadesCoincidentes
            .map(c => `<span class="policia-city-badge">${escapeHtml(c)}</span>`)
            .join('');

          const puntos = (p.puntos || [])
            .map(pt => `
              <div class="policia-punto">
                ${pt.sigla ? `<strong>${escapeHtml(pt.sigla)}:</strong> ` : ''}${escapeHtml(pt.direccion || 'Sin dirección')}
                ${pt.telefono ? ` · ${escapeHtml(pt.telefono)}` : ''}${pt.email ? ` · ${escapeHtml(pt.email)}` : ''}
              </div>
            `)
            .join('');

          div.innerHTML = `
            <div>${badges}</div>
            <div class="policia-name">${escapeHtml(p.nombre)}</div>
            ${p.direccion ? `<div class="policia-field">${ICON_MAPPIN} ${escapeHtml(p.direccion)}</div>` : ''}
            ${p.telefono ? `<div class="policia-field">${ICON_PHONE} ${escapeHtml(p.telefono)}</div>` : ''}
            ${p.email ? `<div class="policia-field">${ICON_MAIL} ${escapeHtml(p.email)}</div>` : ''}
            ${p.horario_atencion ? `<div class="policia-field">${ICON_CLOCK} ${escapeHtml(p.horario_atencion)}</div>` : ''}
            ${p.proceso ? `<div class="policia-field">${escapeHtml(p.proceso)}</div>` : ''}
            ${p.notas ? `<div class="policia-field">${escapeHtml(p.notas)}</div>` : ''}
            ${puntos}
          `;
          resultsList.appendChild(div);
        });
      }
    } catch (err) {
      console.error(err);
      resultsList.innerHTML = '<div style="font-size:12px; color:#ef4444; text-align:center; padding: 10px 0;">Error de conexión. Revisa tus credenciales.</div>';
    } finally {
      loadingDiv.style.display = 'none';
    }
  }

  async function handleClientSelect(clientInfo) {
    loadingDiv.style.display = 'block';
    resultsList.innerHTML = '';
    searchInput.value = '';

    try {
      // 1. Obtener datos base del cliente
      const baseRes = await authFetch(`${supaUrl}/rest/v1/clientes?id=eq.${clientInfo.id}&select=*`);
      const baseData = await baseRes.json();
      if (!baseData || baseData.length === 0) throw new Error("Cliente no encontrado");
      const client = baseData[0];

      // 2. Obtener datos operacionales (campos personalizados)
      const opsRes = await authFetch(`${supaUrl}/rest/v1/cliente_datos_operacionales?id_cliente=eq.${client.id}&select=valor,campos_datos_operacionales(nombre_campo)`);
      const customData = await opsRes.json();

      // 3. Obtener trámites (entradas) para extraer los campos personalizados por trámite
      const entradasRes = await authFetch(`${supaUrl}/rest/v1/entradas?id_cliente=eq.${client.id}&select=datos_personalizados&order=creado_en.desc`);
      const entradasData = await entradasRes.json();

      const fullData = {
        // numero_pasaporte, nombre_madre, nombre_padre, rnm, fecha_entrada_brasil
        // y lugar_entrada_brasil ya no son columnas reales de `clientes` — viven
        // en este JSONB. Se cargan primero para que los campos fijos de abajo
        // (que sí siguen siendo columnas) puedan pisarlos si hiciera falta.
        ...(client.campos_personalizados || {}),
        nombre: client.nombre,
        cpf: client.cpf,
        email: client.email,
        telefono: client.telefono,
        pais: client.pais,
        ciudad: client.ciudad,
        fecha_nacimiento: client.fecha_nacimiento,
        estado_civil: client.estado_civil,
        sexo: client.sexo,
        nacionalidad: client.nacionalidad,
        direccion: client.direccion
      };

      if (customData && customData.length > 0) {
        customData.forEach(cd => {
          if (cd.campos_datos_operacionales && cd.campos_datos_operacionales.nombre_campo) {
            fullData[cd.campos_datos_operacionales.nombre_campo.toLowerCase()] = cd.valor;
          }
        });
      }

      // Merge custom fields from tramites (entradas)
      if (entradasData && entradasData.length > 0) {
        entradasData.forEach(ent => {
          if (ent.datos_personalizados) {
            Object.keys(ent.datos_personalizados).forEach(key => {
              if (ent.datos_personalizados[key] && !fullData[key]) {
                fullData[key] = ent.datos_personalizados[key];
              }
            });
          }
        });
      }

      // Fetch relationships
      let relatives = [];
      try {
        const relRes = await authFetch(`${supaUrl}/rest/v1/relaciones_clientes?or=(cliente_id.eq.${client.id},cliente_relacionado_id.eq.${client.id})&select=*,cliente_principal:clientes!cliente_id(*),cliente_secundario:clientes!cliente_relacionado_id(*)`);
        if (relRes.ok) {
          const relacionesData = await relRes.json();
          relatives = relacionesData.map(r => {
            if (String(r.cliente_id) === String(client.id)) {
               return { ...r.cliente_secundario, tipo_relacion: r.tipo_relacion };
            } else {
               return { ...r.cliente_principal, tipo_relacion: r.tipo_relacion };
            }
          }).filter(r => r && r.id);

          // Inject relatives data into fullData with relation prefix
          relatives.forEach(rel => {
            if (!rel.tipo_relacion) return;
            // Clean up the relation name (e.g. 'padre/madre' -> 'padre_madre', 'cónyuge' -> 'conyuge')
            const prefix = rel.tipo_relacion.toLowerCase()
              .normalize("NFD").replace(new RegExp('[\\u0300-\\u036f]', 'g'), "") // remove accents
              .replace(/[^a-z0-9]/g, '_'); // replace non-alphanumeric with underscore

            // Add all base fields of the relative
            Object.keys(rel).forEach(key => {
              if (key !== 'tipo_relacion' && key !== 'id') {
                fullData[`${prefix}_${key}`] = rel[key];
              }
            });
          });
        }
      } catch (err) {
        console.warn('Error fetching relatives:', err);
      }

      // Fetch formularios
      try {
        const formRes = await authFetch(`${supaUrl}/rest/v1/formularios_clientes?cliente_id=eq.${client.id}&select=respuestas`);
        if (formRes.ok) {
          const formData = await formRes.json();
          formData.forEach(form => {
            if (form.respuestas) {
              Object.keys(form.respuestas).forEach(key => {
                fullData[key.toLowerCase()] = form.respuestas[key];
              });
            }
          });
        }
      } catch (err) {
        console.warn('Error fetching forms:', err);
      }

      chrome.storage.local.set({ activeClient: fullData, activeClientRelatives: relatives }, () => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (!tabs[0]) return;
          chrome.tabs.sendMessage(tabs[0].id, { action: "fillForm", data: fullData }, function(response) {
            if (chrome.runtime.lastError) {
              alert("⚠️ No se pudo autocompletar la página. Asegúrate de estar en una web compatible y recarga la página.");
              // Reload popup to show relatives without closing
              window.location.reload();
            } else {
              window.close();
            }
          });
        });
      });

    } catch (err) {
      console.error(err);
      alert('Error obteniendo datos completos del cliente.');
      loadingDiv.style.display = 'none';
    }
  }
});
