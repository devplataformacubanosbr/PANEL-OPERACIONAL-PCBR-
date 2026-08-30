export function predictValueForInput(input, data) {
  const nameAttr = (input.name || '').toLowerCase();
  const idAttr = (input.id || '').toLowerCase();
  let labelText = '';
  if (input.labels && input.labels.length > 0) {
    labelText = input.labels[0].textContent.toLowerCase();
  } else {
    if (input.previousElementSibling) {
      labelText = input.previousElementSibling.textContent.toLowerCase();
    } 
    
    if (!labelText || labelText.trim() === '') {
      let current = input;
      for (let i = 0; i < 4; i++) {
        if (!current.parentElement) break;
        current = current.parentElement;
        
        const labelEl = current.querySelector('label');
        if (labelEl) {
          labelText = labelEl.textContent.toLowerCase();
          break;
        }
        
        const prevSibling = current.previousElementSibling;
        if (prevSibling && prevSibling.textContent.trim().length > 0 && prevSibling.textContent.length < 150) {
          labelText = prevSibling.textContent.toLowerCase();
          break;
        }
        
        const text = current.textContent.trim();
        if (text.length > 0 && text.length < 200 && !text.includes('\n\n')) {
          labelText = text.toLowerCase();
        }
      }
    }
  }

  let fieldsetText = '';
  const fieldset = input.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) fieldsetText = legend.textContent.toLowerCase();
  }
  const panel = input.closest('.ui-panel, .ui-fieldset');
  if (panel) {
    const header = panel.querySelector('.ui-panel-title, .ui-fieldset-legend');
    if (header) fieldsetText += ' ' + header.textContent.toLowerCase();
  }

  const placeholderAttr = (input.placeholder || '').toLowerCase();
  const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
  const identifier = `${nameAttr} ${idAttr} ${placeholderAttr} ${ariaLabel} ${labelText} ${fieldsetText}`.toLowerCase();

  let valueToInject = null;
  const getCustom = (keyword) => {
    const foundKey = Object.keys(data).find(k => k.replace(/\s|\./g, '').includes(keyword.replace(/\s|\./g, '')));
    return foundKey ? data[foundKey] : null;
  };

  if (identifier.includes('nome') || identifier.includes('name') || identifier.includes('nombre')) {
    if (!identifier.includes('mae') && !identifier.includes('pai') && !identifier.includes('filia') && !identifier.includes('madre') && !identifier.includes('padre')) {
      if (identifier.includes('sobrenome') || identifier.includes('apellido')) {
        if (data.apellidos) {
          valueToInject = data.apellidos;
        } else {
          const parts = (data.nombre || '').split(' ');
          valueToInject = parts.length > 1 ? parts.slice(1).join(' ') : data.nombre;
        }
      } else if (identifier.includes('completo')) {
        valueToInject = data.nombre;
      } else {
        if (data.nombres) {
          valueToInject = data.nombres;
        } else {
          valueToInject = (data.nombre || '').split(' ')[0];
        }
      }
    }
  }
  if (identifier.includes('cpf')) {
    let cpfVal = data.cpf || getCustom('cpf');
    if (cpfVal && cpfVal.length === 11 && !cpfVal.includes('.')) {
      cpfVal = cpfVal.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    valueToInject = cpfVal;
  }
  if (identifier.includes('mail') || identifier.includes('correo') || identifier.includes('eletrônico')) {
    valueToInject = data.email;
  }
  if (identifier.includes('ocupacao') || identifier.includes('profissao') || identifier.includes('ocupación')) {
    valueToInject = data.profesion || getCustom('profesion');
  }
  if (identifier.includes('sexo') || identifier.includes('gender') || identifier.includes('genero') || identifier.includes('gênero')) {
    let sexoVal = getCustom('sexo') || data.sexo || '';
    if (identifier.includes('filia') || identifier.includes('mae') || identifier.includes('pai')) {
      if (identifier.includes('1') || identifier.includes('mae') || identifier.includes('madre')) {
        sexoVal = 'f';
      } else if (identifier.includes('2') || identifier.includes('pai') || identifier.includes('padre')) {
        sexoVal = 'm';
      }
    }

    if (input.type === 'radio') {
      const val = input.value || input.nextElementSibling?.textContent || labelText || '';
      if (sexoVal.toLowerCase() === 'm' || sexoVal.toLowerCase().includes('masc')) {
        if (val.toLowerCase().includes('masc') || val === 'm' || val === 'M') valueToInject = 'RADIO_CHECK';
      } else if (sexoVal.toLowerCase() === 'f' || sexoVal.toLowerCase().includes('fem')) {
        if (val.toLowerCase().includes('fem') || val === 'f' || val === 'F') valueToInject = 'RADIO_CHECK';
      }
    } else {
      valueToInject = sexoVal;
    }
  }
  if (identifier.includes('nascimento') || identifier.includes('birth') || identifier.includes('nacimiento')) {
    if (identifier.includes('cidade') || identifier.includes('municipio') || identifier.includes('ciudad')) {
      valueToInject = data.lugar_nacimiento || data.ciudad || getCustom('lugar') || getCustom('ciudad');
    } else if (identifier.includes('pais') || identifier.includes('país')) {
      valueToInject = data.pais || getCustom('pais');
    } else if (identifier.includes('estado') || identifier.includes('provincia') || identifier.includes('província')) {
      valueToInject = getCustom('uf') || getCustom('estado');
    } else {
      let dateVal = getCustom('fechanac') || data.fecha_nacimiento;
      if (dateVal && dateVal.includes('-')) {
        const [y, m, d] = dateVal.split('-');
        if (y.length === 4) dateVal = `${d}/${m}/${y}`;
      }
      valueToInject = dateVal;
    }
  }
  if (identifier.includes('nacionalidade') || identifier.includes('nacionalidad')) {
    valueToInject = data.nacionalidad || data.pais;
  }
  if (identifier.includes('estadocivil') || identifier.includes('civil')) {
    valueToInject = getCustom('estadocivil') || data.estado_civil;
  }
  
  if (identifier.includes('rnm') || identifier.includes('registro nacional de inmigrante')) {
    if (input.type === 'radio') {
      const val = input.value || input.nextElementSibling?.textContent || labelText || '';
      const tieneRnm = (data.rnm && data.rnm.trim() !== '');
      if (tieneRnm && (val.toLowerCase() === 'sim' || val.toLowerCase() === 'sí' || val.toLowerCase() === 'si' || val === 'S')) valueToInject = 'RADIO_CHECK';
      if (!tieneRnm && (val.toLowerCase() === 'não' || val.toLowerCase() === 'no' || val === 'N')) valueToInject = 'RADIO_CHECK';
    } else {
      let rnmVal = data.rnm || getCustom('rnm') || '';
      valueToInject = rnmVal.replace(/-/g, '');
    }
  }
  if (identifier.includes('responsable') && input.type === 'radio') {
     const val = input.value || input.nextElementSibling?.textContent || labelText || '';
     if (val.toLowerCase() === 'não' || val.toLowerCase() === 'no' || val === 'N') valueToInject = 'RADIO_CHECK';
  }
  
  if (identifier.includes('nomes anteriores') || identifier.includes('nacionalidade brasileira')) {
    if (input.type === 'radio') {
      const val = input.value || input.nextElementSibling?.textContent || labelText || '';
      if (val.toLowerCase() === 'não' || val.toLowerCase() === 'no' || val === 'N') valueToInject = 'RADIO_CHECK';
    }
  }
  if (identifier.includes('autoridade expedidora')) {
    valueToInject = data.nacionalidad || data.pais;
  }
  if (identifier.includes('documento de viaje') || identifier.includes('passaporte') || identifier.includes('pasaporte')) {
    if (identifier.includes('tipo')) {
      valueToInject = 'PASAPORTE';
    } else if (identifier.includes('número') || identifier.includes('numero')) {
      valueToInject = data.pasaporte || data.numero_pasaporte || data.numero_documento || getCustom('pasaporte');
    } else if (identifier.includes('expedidor') || identifier.includes('emissor')) {
      valueToInject = data.nacionalidad || data.pais;
    }
  }
  if (identifier.includes('entrada')) {
    if (identifier.includes('fecha') || identifier.includes('data')) {
      let dateVal = getCustom('fechaentrada') || data.fecha_entrada || getCustom('entrada');
      if (dateVal && dateVal.includes('-')) {
        const [y, m, d] = dateVal.split('-');
        if (y.length === 4) dateVal = `${d}/${m}/${y}`;
      }
      valueToInject = dateVal;
    } else if (identifier.includes('local')) {
      valueToInject = getCustom('localentrada');
    }
  }
  if (identifier.includes('transporte')) {
    valueToInject = getCustom('transporte');
  }
  
  if (identifier.includes('idioma') || identifier.includes('língua') || identifier.includes('lingua')) {
    valueToInject = getCustom('idioma') || data.idioma || 'Espanhol';
  }

  let dirObj = null;
  try {
    if (data.direccion && typeof data.direccion === 'string' && data.direccion.startsWith('{')) {
      dirObj = JSON.parse(data.direccion);
    }
  } catch (e) {}

  if (identifier.includes('cep') || identifier.includes('código postal')) {
    valueToInject = dirObj ? dirObj.cep : getCustom('cep');
  } else if (identifier.includes('calle') || identifier.includes('logradouro') || (identifier.includes('endereco') && !identifier.includes('alteração') && !identifier.includes('alteracao')) || identifier.includes('dirección residencial')) {
    let calle = dirObj ? dirObj.endereco : (data.direccion && !data.direccion.startsWith('{') ? data.direccion : getCustom('calle'));
    if (dirObj && dirObj.numero && identifier.includes('calle') && !identifier.includes('número')) {
      calle = `${calle}, ${dirObj.numero}`;
    }
    valueToInject = calle;
  } else if (identifier.includes('número') || (identifier.includes('numero') && !identifier.includes('documento') && !identifier.includes('passaporte') && !identifier.includes('telefone') && !identifier.includes('celular'))) {
    valueToInject = dirObj ? dirObj.numero : getCustom('numero');
  } else if (identifier.includes('complemento')) {
    valueToInject = dirObj ? dirObj.complemento : getCustom('complemento');
  } else if (identifier.includes('barrio') || identifier.includes('bairro')) {
    valueToInject = dirObj ? dirObj.bairro : getCustom('barrio');
  } else if (!identifier.includes('nascimento') && !identifier.includes('nacimiento') && (identifier.includes('cidade') || identifier.includes('ciudad') || identifier.includes('municipio'))) {
    valueToInject = dirObj ? dirObj.cidade : (data.ciudad || getCustom('ciudad'));
  } else if (!identifier.includes('nascimento') && !identifier.includes('nacimiento') && (identifier.includes('uf') || identifier.includes('estado'))) {
    valueToInject = dirObj ? dirObj.estado : getCustom('uf');
  } else if (identifier.includes('teléfono') || identifier.includes('telefone') || identifier.includes('celular')) {
    valueToInject = data.telefono || getCustom('telefono');
  }

  if (identifier.includes('uf') && identifier.includes('federación')) {
    valueToInject = dirObj ? dirObj.estado : getCustom('uf');
  }
  if (identifier.includes('filiacao') || identifier.includes('mae') || identifier.includes('pai') || identifier.includes('filiación')) {
    if (identifier.includes('1') || identifier.includes('mae') || identifier.includes('madre')) {
      valueToInject = getCustom('madre') || data.nombre_madre;
    } else if (identifier.includes('2') || identifier.includes('pai') || identifier.includes('padre')) {
      valueToInject = getCustom('padre') || data.nombre_padre;
    }
  }
  
  return valueToInject;
}

export function injectValueToInput(input, valueToInject) {
  if (!valueToInject) return false;
  
  if (valueToInject === 'RADIO_CHECK') {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('click', { bubbles: true }));
    return true;
  } else if (input.tagName !== 'SELECT') {
    input.focus();
    
    let finalValue = valueToInject;
    
    if (window.location.href.includes('agenda-web')) {
      if (typeof finalValue === 'string' && finalValue.match(/^[\d.\-\/]+$/)) {
        finalValue = finalValue.replace(/[.\-\/]/g, '');
      }
    }
    
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, finalValue);
    } else {
      input.value = finalValue;
    }
    
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Tab' }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    
    return true;
  } else {
    let optionFound = false;
    for (let i = 0; i < input.options.length; i++) {
      if (input.options[i].text.toUpperCase().includes(valueToInject.toUpperCase()) || 
          valueToInject.toUpperCase().includes(input.options[i].text.toUpperCase())) {
        input.value = input.options[i].value;
        optionFound = true;
        break;
      }
    }
    if (optionFound) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

export function fillSismigraForm(data) {
  let fieldsFilled = 0;
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
  
  inputs.forEach(input => {
    const valueToInject = predictValueForInput(input, data);
    if (injectValueToInput(input, valueToInject)) {
      fieldsFilled++;
    }
  });

  return fieldsFilled;
}
