import { fillSismigraForm, predictValueForInput, injectValueToInput } from './autofill.js';
import { predictFieldWithAI, predictFormWithAI } from './ai.js';

let floatingBtn = null;
let contextualMenuEl = null;
let currentlyFocusedInput = null;

const hasFormElements = () => {
  return document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea').length > 0;
};

export function injectOrUpdateBtn(client) {
  if (!hasFormElements()) {
    if (floatingBtn) floatingBtn.style.display = 'none';
    return;
  }

  if (!floatingBtn) {
    floatingBtn = document.createElement('div');
    floatingBtn.id = 'dashboard-autofill-btn';
    floatingBtn.innerHTML = `
      <div id="cbr-floating-container" style="position: fixed; bottom: 20px; right: 20px; z-index: 999999; background: #2563eb; color: white; padding: 12px 20px; border-radius: 8px; font-family: sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 10px; border: 2px solid #1d4ed8; transition: opacity 0.2s;">
        <div id="cbr-drag-handle" style="cursor: grab; display: flex; align-items: center; justify-content: center; padding-right: 5px;" title="Mover">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
        </div>
        <div id="cbr-action-area" style="cursor: pointer; display: flex; align-items: center; gap: 10px; padding-right: 10px; border-right: 1px solid rgba(255,255,255,0.2);">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          <div id="cbr-btn-content" style="display:flex; flex-direction:column;">
            <span id="cbr-btn-title" style="font-weight:bold; font-size:14px;">Autocompletar Normal</span>
            <span id="cbr-btn-client" style="font-size:11px; opacity:0.9;">Cliente: ${client.nombre.substring(0, 25)}...</span>
          </div>
        </div>
        <div id="cbr-ai-btn" style="cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 6px 10px; border-radius: 4px; background: linear-gradient(135deg, #d946ef, #8b5cf6); border: 1px solid #fdf4ff; color: white; font-weight: bold; font-size: 13px; margin-left: 5px; box-shadow: 0 0 8px rgba(217, 70, 239, 0.4);" title="Autocompletar con Groq AI">
          ✨ IA
        </div>
        <div id="cbr-min-btn" style="cursor: pointer; padding-left: 10px; opacity: 0.8;" title="Minimizar/Maximizar">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="8" y1="12" x2="16" y2="12"></line></svg>
        </div>
      </div>
    `;
    
    const actionArea = floatingBtn.querySelector('#cbr-action-area');
    actionArea.addEventListener('click', () => {
      chrome.storage.local.get(['activeClient'], (res) => {
        if (res.activeClient) {
          const count = fillSismigraForm(res.activeClient);
          const titleSpan = floatingBtn.querySelector('#cbr-btn-title');
          titleSpan.innerText = `¡${count} campos rellenados!`;
          setTimeout(() => {
            titleSpan.innerText = 'Autocompletar Formulario';
          }, 2000);
        }
      });
    });
    
    const aiBtnAction = floatingBtn.querySelector('#cbr-ai-btn');
    let aiRequestInFlight = false;
    aiBtnAction.addEventListener('click', () => {
      if (aiRequestInFlight) return;
      chrome.storage.local.get(['activeClient'], async (res) => {
        if (res.activeClient) {
          aiRequestInFlight = true;
          aiBtnAction.innerText = '⏳ Procesando...';
          try {
            const predictions = await predictFormWithAI(res.activeClient);
            const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')).filter(f => !f.id.includes('searchInput'));
            let filledCount = 0;
            
            Object.keys(predictions).forEach(indexStr => {
              const idx = parseInt(indexStr);
              const val = predictions[indexStr];
              if (inputs[idx] && val && val !== 'NONE') {
                if (val === 'RADIO_CHECK') {
                  inputs[idx].checked = true;
                  inputs[idx].dispatchEvent(new Event('change', { bubbles: true }));
                  filledCount++;
                } else {
                  injectValueToInput(inputs[idx], val);
                  filledCount++;
                }
              }
            });
            
            aiBtnAction.innerText = `¡${filledCount} con IA!`;
            setTimeout(() => aiBtnAction.innerText = '✨ IA', 3000);
          } catch (err) {
            alert(err.message);
            aiBtnAction.innerText = '✨ IA';
          } finally {
            aiRequestInFlight = false;
          }
        }
      });
    });

    floatingBtn.addEventListener('mouseenter', () => floatingBtn.firstElementChild.style.transform = 'translateY(-2px)');
    floatingBtn.addEventListener('mouseleave', () => floatingBtn.firstElementChild.style.transform = 'translateY(0)');

    document.body.appendChild(floatingBtn);

    let isDragging = false;
    let startX, startY, initialX, initialY;
    const container = floatingBtn.querySelector('#cbr-floating-container');
    const dragHandle = floatingBtn.querySelector('#cbr-drag-handle');
    
    dragHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = container.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      container.style.left = initialX + 'px';
      container.style.top = initialY + 'px';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      container.style.left = (initialX + dx) + 'px';
      container.style.top = (initialY + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    const minBtn = floatingBtn.querySelector('#cbr-min-btn');
    const contentArea = floatingBtn.querySelector('#cbr-btn-content');
    let isMinimized = false;
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isMinimized = !isMinimized;
      contentArea.style.display = isMinimized ? 'none' : 'flex';
    });
  } else {
    floatingBtn.style.display = 'flex';
    const clientSpan = floatingBtn.querySelector('#cbr-btn-client');
    if (clientSpan) {
      const newText = `Cliente: ${client.nombre.substring(0, 25)}...`;
      if (clientSpan.innerText !== newText) {
        clientSpan.innerText = newText;
      }
    }
  }
}

export function hideFloatingBtn() {
  if (floatingBtn) floatingBtn.style.display = 'none';
}

function createContextMenu() {
  if (contextualMenuEl) return;
  contextualMenuEl = document.createElement('div');
  contextualMenuEl.id = 'cbr-context-menu';
  contextualMenuEl.style.cssText = `
    position: absolute;
    z-index: 9999999;
    background: white;
    border: 1px solid #e5e7eb;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 6px;
    display: none;
    flex-direction: column;
    max-height: 250px;
    height: 250px;
    width: 250px;
    overflow-y: auto;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 12px;
  `;
  
  document.addEventListener('mousedown', (e) => {
    if (contextualMenuEl && !contextualMenuEl.contains(e.target) && e.target !== currentlyFocusedInput) {
      contextualMenuEl.style.display = 'none';
    }
  });
  document.body.appendChild(contextualMenuEl);
}

function createMenuItem(label, value, isRecommended = false) {
  const item = document.createElement('div');
  item.style.cssText = `
    padding: 8px 12px; 
    cursor: pointer; 
    border-radius: 6px; 
    transition: background 0.15s; 
    display: flex; 
    flex-direction: column;
    margin-bottom: 2px;
    ${isRecommended ? 'background: #eff6ff; border: 1px solid #bfdbfe;' : 'background: transparent;'}
  `;
  
  if (label) {
    const labelSpan = document.createElement('span');
    labelSpan.style.cssText = 'font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;';
    labelSpan.innerText = label;
    item.appendChild(labelSpan);
  }
  
  const valSpan = document.createElement('span');
  valSpan.style.cssText = `color: #111827; font-weight: ${isRecommended ? '600' : '400'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
  valSpan.innerText = value;
  item.appendChild(valSpan);

  item.addEventListener('mouseenter', () => item.style.background = isRecommended ? '#dbeafe' : '#f3f4f6');
  item.addEventListener('mouseleave', () => item.style.background = isRecommended ? '#eff6ff' : 'transparent');
  
  item.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentlyFocusedInput) {
      injectValueToInput(currentlyFocusedInput, value);
      contextualMenuEl.style.display = 'none';
    }
  });
  return item;
}

export function showContextMenuForInput(input, clientData) {
  if (!contextualMenuEl) createContextMenu();
  
  if (input.type === 'radio' || input.type === 'checkbox' || input.type === 'hidden' || input.type === 'submit' || input.type === 'button' || input.type === 'search') return;
  if (input.readOnly || input.disabled) return;
  
  // Ignorar inputs de librerías de select (como Select2) o de búsqueda
  if (input.classList.contains('select2-search__field') || input.getAttribute('role') === 'combobox' || input.getAttribute('role') === 'searchbox') return;
  if (input.closest('.select2-container')) return;

  const displayData = { ...clientData };
  if (displayData.nombre && !displayData.nombres && !displayData.apellidos) {
    const parts = displayData.nombre.split(' ');
    displayData.nombres = parts[0];
    displayData.apellidos = parts.length > 1 ? parts.slice(1).join(' ') : '';
  }

  if (displayData.direccion && displayData.direccion.startsWith('{')) {
    try {
      const dirObj = JSON.parse(displayData.direccion);
      if (dirObj.cep) displayData.cep = dirObj.cep;
      if (dirObj.endereco) displayData.calle = dirObj.endereco;
      if (dirObj.numero) displayData.numero_casa = dirObj.numero;
      if (dirObj.complemento) displayData.complemento = dirObj.complemento;
      if (dirObj.bairro) displayData.barrio = dirObj.bairro;
      if (dirObj.cidade) displayData.ciudad = dirObj.cidade;
      if (dirObj.estado) displayData.estado = dirObj.estado;
      delete displayData.direccion;
    } catch (e) {}
  }

  currentlyFocusedInput = input;
  const rect = input.getBoundingClientRect();
  
  let topPos = window.scrollY + rect.bottom + 4;
  if (rect.bottom + 260 > window.innerHeight && rect.top > 260) {
    topPos = window.scrollY + rect.top - 260; // Show above the input if not enough space below
  }
  
  contextualMenuEl.style.top = `${topPos}px`;
  contextualMenuEl.style.left = `${window.scrollX + rect.left}px`;
  contextualMenuEl.innerHTML = '';
  
  const searchContainer = document.createElement('div');
  searchContainer.style.cssText = 'padding: 0 2px 6px; margin-bottom: 6px; position: sticky; top: -6px; background: white; z-index: 10; border-bottom: 1px solid #e5e7eb; padding-top: 6px; display: flex; gap: 4px; align-items: center;';
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Buscar dato...';
  searchInput.style.cssText = 'width: 100%; padding: 6px 8px; font-size: 11px; border: 1px solid #d1d5db; border-radius: 4px; outline: none; box-sizing: border-box; font-family: inherit;';
  
  const closeBtn = document.createElement('div');
  closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  closeBtn.style.cssText = 'cursor: pointer; color: #9ca3af; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center;';
  closeBtn.title = 'Cerrar sugerencias';
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = '#f3f4f6');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'transparent');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    contextualMenuEl.style.display = 'none';
  });

  searchContainer.appendChild(searchInput);
  searchContainer.appendChild(closeBtn);
  contextualMenuEl.appendChild(searchContainer);
  
  const aiBtn = document.createElement('div');
  aiBtn.innerText = '✨ Preguntar a Groq AI';
  aiBtn.style.cssText = 'padding: 8px 12px; cursor: pointer; border-radius: 6px; background: linear-gradient(to right, #fdf4ff, #fae8ff); color: #c026d3; font-weight: bold; margin-bottom: 6px; border: 1px solid #f5d0fe; text-align: center; font-size: 11px;';
  let contextAiInFlight = false;
  aiBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (contextAiInFlight) return;
    contextAiInFlight = true;
    aiBtn.innerText = '⏳ Analizando...';
    try {
      const result = await predictFieldWithAI(currentlyFocusedInput, displayData);
      if (result && result !== 'NONE') {
        injectValueToInput(currentlyFocusedInput, result);
        contextualMenuEl.style.display = 'none';
      } else {
        aiBtn.innerText = '❌ No se dedujo dato';
        setTimeout(() => aiBtn.innerText = '✨ Preguntar a Groq AI', 2000);
      }
    } catch (err) {
      alert(err.message);
      aiBtn.innerText = '✨ Preguntar a Groq AI';
    } finally {
      contextAiInFlight = false;
    }
  });
  contextualMenuEl.appendChild(aiBtn);
  
  const predictedValue = predictValueForInput(input, displayData);
  
  if (predictedValue && predictedValue !== 'RADIO_CHECK') {
    const title = document.createElement('div');
    title.innerText = 'SUGERENCIA AUTOMÁTICA';
    title.style.cssText = 'padding: 4px 10px 2px; font-weight: bold; color: #2563eb; font-size: 10px; margin-bottom: 2px;';
    contextualMenuEl.appendChild(title);
    
    const item = createMenuItem(null, predictedValue, true);
    contextualMenuEl.appendChild(item);
    
    const divider = document.createElement('div');
    divider.style.cssText = 'height: 1px; background: #e5e7eb; margin: 6px 0;';
    contextualMenuEl.appendChild(divider);
  }
  
  const title2 = document.createElement('div');
  title2.innerText = 'ELEGIR OTRO DATO';
  title2.style.cssText = 'padding: 4px 10px 2px; font-weight: bold; color: #9ca3af; font-size: 10px; margin-bottom: 4px;';
  contextualMenuEl.appendChild(title2);
  
  const gridContainer = document.createElement('div');
  gridContainer.style.cssText = 'display: grid; grid-template-columns: 1fr; gap: 4px;';
  contextualMenuEl.appendChild(gridContainer);
  
  const ignoredKeys = ['id', 'created_at', 'user_id', 'estatus', 'empresa_id', 'updated_at', 'avatar_url'];
  
  const dataEntries = Object.entries(displayData).filter(([k,v]) => 
    typeof v === 'string' && v.trim().length > 0 && v !== predictedValue && !ignoredKeys.includes(k) && !v.startsWith('{')
  );
  
  dataEntries.forEach(([key, val]) => {
    const item = createMenuItem(key.replace(/_/g, ' '), val, false);
    gridContainer.appendChild(item);
  });
  
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    Array.from(gridContainer.children).forEach(item => {
      if (item.innerText.toLowerCase().includes(term)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  });
  
  searchInput.addEventListener('keydown', (e) => {
    e.stopPropagation(); // Prevenir atajos de teclado mientras se busca
    if (e.key === 'Escape') {
      contextualMenuEl.style.display = 'none';
    }
  });
  
  contextualMenuEl.style.display = 'flex';
}

export function setupContextEvents() {
  document.addEventListener('dblclick', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (contextualMenuEl) {
        contextualMenuEl.style.display = 'none';
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && contextualMenuEl && contextualMenuEl.style.display !== 'none') {
      contextualMenuEl.style.display = 'none';
    }
  });

  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (contextualMenuEl && contextualMenuEl.contains(e.target)) return;
      
      chrome.storage.local.get(['activeClient'], (res) => {
        if (res.activeClient && res.activeClient.nombre) {
          showContextMenuForInput(e.target, res.activeClient);
        }
      });
    }
  });

  window.addEventListener('scroll', (e) => { 
    if (contextualMenuEl && contextualMenuEl.style.display !== 'none') {
      if (e.target === contextualMenuEl || contextualMenuEl.contains(e.target)) {
        return;
      }
      contextualMenuEl.style.display = 'none'; 
    }
  }, true);
  
  window.addEventListener('resize', () => { 
    if(contextualMenuEl) contextualMenuEl.style.display = 'none'; 
  });
}
