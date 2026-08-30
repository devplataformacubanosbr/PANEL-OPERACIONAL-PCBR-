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

  let supaUrl = '';
  let supaKey = '';
  let groqKey = '';
  let dashboardUrl = '';

  // Load config and active client
  chrome.storage.local.get(['supaUrl', 'supaKey', 'groqKey', 'dashboardUrl', 'activeClient', 'activeClientRelatives'], (res) => {
    if (res.supaUrl && res.supaKey) {
      supaUrl = res.supaUrl;
      supaKey = res.supaKey;
      supaUrlInput.value = supaUrl;
      supaKeyInput.value = supaKey;
    } else {
      configSection.style.display = 'block';
    }

    if (res.groqKey) {
      groqKey = res.groqKey;
      groqKeyInput.value = groqKey;
    }

    if (res.dashboardUrl) {
      dashboardUrl = res.dashboardUrl;
      dashboardUrlInput.value = dashboardUrl;
    }

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
    configSection.style.display = configSection.style.display === 'none' ? 'block' : 'none';
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

    supaUrl = newUrl;
    supaKey = newKey;
    groqKey = newGroqKey;
    dashboardUrl = newDashboardUrl;

    chrome.storage.local.set({ supaUrl, supaKey, groqKey, dashboardUrl }, () => {
      configSection.style.display = 'none';
      // Muestra un pequeño aviso de guardado
      const originalText = saveConfigBtn.innerText;
      saveConfigBtn.innerText = "¡Guardado!";
      saveConfigBtn.style.background = "#10b981";
      setTimeout(() => {
        saveConfigBtn.innerText = originalText;
        saveConfigBtn.style.background = "";
      }, 2000);
    });
  });

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();
    if (q.length < 2) {
      resultsList.innerHTML = '';
      return;
    }
    
    searchTimeout = setTimeout(() => {
      searchClients(q);
    }, 400);
  });

  async function searchClients(query) {
    if (!supaUrl || !supaKey) {
      alert('⚙️ Por favor configura Supabase primero.');
      configSection.style.display = 'block';
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
      const res = await fetch(url, {
        headers: {
          'apikey': supaKey,
          'Authorization': `Bearer ${supaKey}`,
          'Content-Type': 'application/json'
        }
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

  async function handleClientSelect(clientInfo) {
    loadingDiv.style.display = 'block';
    resultsList.innerHTML = '';
    searchInput.value = '';
    
    try {
      // 1. Obtener datos base del cliente
      const baseRes = await fetch(`${supaUrl}/rest/v1/clientes?id=eq.${clientInfo.id}&select=*`, {
        headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` }
      });
      const baseData = await baseRes.json();
      if (!baseData || baseData.length === 0) throw new Error("Cliente no encontrado");
      const client = baseData[0];

      // 2. Obtener datos operacionales (campos personalizados)
      const opsRes = await fetch(`${supaUrl}/rest/v1/cliente_datos_operacionales?id_cliente=eq.${client.id}&select=valor,campos_datos_operacionales(nombre_campo)`, {
        headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` }
      });
      const customData = await opsRes.json();

      // 3. Obtener trámites (entradas) para extraer los campos personalizados por trámite
      const entradasRes = await fetch(`${supaUrl}/rest/v1/entradas?id_cliente=eq.${client.id}&select=datos_personalizados&order=creado_en.desc`, {
        headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` }
      });
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
        const relRes = await fetch(`${supaUrl}/rest/v1/relaciones_clientes?or=(cliente_id.eq.${client.id},cliente_relacionado_id.eq.${client.id})&select=*,cliente_principal:clientes!cliente_id(*),cliente_secundario:clientes!cliente_relacionado_id(*)`, {
          headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` }
        });
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
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
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
        const formRes = await fetch(`${supaUrl}/rest/v1/formularios_clientes?cliente_id=eq.${client.id}&select=respuestas`, {
          headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` }
        });
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
