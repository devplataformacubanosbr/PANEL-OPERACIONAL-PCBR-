/**
 * useClientViewEdit.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Encapsula toda la lógica del modal de edición de datos del cliente:
 * preparación del formulario, manejo de campos fijos y dinámicos, CEP lookup,
 * filtrado por búsqueda, guardado, y eliminación de campos.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { handleError } from '../utils/errorHandler';
import { FIXED_FIELDS_CATALOG } from '../components/clientView.constants';

export default function useClientViewEdit({ clientId, client, fetchClientData }) {
  // Todos los campos del cliente son columnas fijas de `clientes` (versión standalone).
  const fixedFields = FIXED_FIELDS_CATALOG;

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  // Form data
  const [editFormData, setEditFormData] = useState([]);
  const [newFields, setNewFields] = useState([]);
  const [editModalSearchQuery, setEditModalSearchQuery] = useState('');

  // ── CEP Lookup ─────────────────────────────────────────────────────────────
  const handleCepSearch = async (cepValue, callback) => {
    if (!cepValue) return;
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          if (callback) {
            callback(data);
          } else {
            setEditFormData(prev => prev.map(f => {
              if (f.id === 'direccion') {
                return {
                  ...f,
                  _endereco: data.logradouro || f._endereco,
                  _bairro: data.bairro || f._bairro,
                  _cidade: data.localidade || f._cidade,
                  _estado: data.uf || f._estado
                };
              }
              return f;
            }));
          }
        } else {
          toast.error("CEP no encontrado en ViaCEP");
        }
      } catch (err) {
        console.error('[useClientViewEdit] Error fetching CEP:', err);
        toast.error("Error al conectar con ViaCEP");
      }
    } else {
      toast.error("El CEP debe tener 8 números");
    }
  };

  // ── Open edit modal ────────────────────────────────────────────────────────
  const openEditModal = (categoriaId) => {
    let _targetTabs = [];
    let activeCategoriasNombres = [];

    if (categoriaId === 'ALL_PERSONAL') {
      activeCategoriasNombres = ["Informaciones Personales", "Datos Familiares", "Documentos de Identidad"];
    } else {
      // If we used a tab string directly, though with the new system, we might not have dynamic tabs anyway.
      // But let's assume we map tabs if passed.
      activeCategoriasNombres = [categoriaId || 'Informaciones Personales'];
    }

    const activeFixedFields = fixedFields.filter(f => activeCategoriasNombres.includes(f.category_name));

    // 1. Populate Fixed Fields
    const formData = [];
    activeFixedFields.forEach(f => {
      let extraArgs = {};
      if (f.id === 'nombre') {
        const fullName = (client[f.id] || '').trim().toUpperCase();
        const parts = fullName.split(' ');

        const padreName = (client.nombre_padre || '').trim().toUpperCase().split(' ');
        const madreName = (client.nombre_madre || '').trim().toUpperCase().split(' ');

        let splitIndex = 1;

        if (parts.length > 2) {
          splitIndex = parts.length - 2;

          const padreApe1 = padreName.length > 1 ? padreName[padreName.length - 2] : null;
          const madreApe1 = madreName.length > 1 ? madreName[madreName.length - 2] : null;

          if (padreApe1 && madreApe1) {
            const childApe1 = parts[parts.length - 2];
            const childApe2 = parts[parts.length - 1];

            if (childApe1 === padreApe1 && childApe2 === madreApe1) {
              splitIndex = parts.length - 2;
            } else {
              const padreIdx = parts.indexOf(padreApe1);
              if (padreIdx > 0) {
                splitIndex = padreIdx;
              }
            }
          }
        }

        extraArgs._nombres = parts.slice(0, splitIndex).join(' ') || '';
        extraArgs._apellidos = parts.slice(splitIndex).join(' ') || '';
      }
      if (f.id === 'direccion') {
        let dirData = {};
        try {
          if (typeof client.direccion === 'string' && client.direccion.startsWith('{')) {
            dirData = JSON.parse(client.direccion);
          } else if (typeof client.direccion === 'object' && client.direccion !== null) {
            dirData = client.direccion;
          } else if (client.direccion) {
            dirData._endereco = client.direccion;
          }
        } catch (_e) { }
        extraArgs._cep = dirData.cep || '';
        extraArgs._endereco = dirData.endereco || dirData._endereco || '';
        extraArgs._numero = dirData.numero || '';
        extraArgs._complemento = dirData.complemento || '';
        extraArgs._bairro = dirData.bairro || '';
        extraArgs._cidade = dirData.cidade || '';
        extraArgs._estado = dirData.estado || '';
        extraArgs._ponto_referencia = dirData.ponto_referencia || '';
      }
      const valor = client[f.id] || '';

      formData.push({
        id: f.id,
        campo_id: f.id,
        nombre_campo: f.nombre_campo,
        valor: valor,
        es_fijo: true,
        ...extraArgs
      });
    });



    setEditFormData(formData);
    setNewFields([]);
    setEditingCategoryId(categoriaId);
    setIsEditModalOpen(true);
  };

  // ── Delete field data ──────────────────────────────────────────────────────
  const handleDeleteFieldData = async (dataId, es_fijo) => {
    if (!window.confirm('¿Borrar este dato del cliente?')) return;
    try {
      if (es_fijo) {
        await supabase.from('clientes').update({ [dataId]: null }).eq('id', clientId);
      }
      setEditFormData(editFormData.map(f => f.id === dataId ? { ...f, valor: '' } : f));
      await fetchClientData();
    } catch (err) { handleError(err, 'Error borrando dato base'); }
  };

  // ── Add custom field ───────────────────────────────────────────────────────
  const handleAddCustomField = () => {
    setNewFields([...newFields, { id: Date.now(), campo_id: '', valor: '', customName: '' }]);
  };

  // ── Save all edits ─────────────────────────────────────────────────────────
  const handleSaveEdits = async () => {
    setIsSaving(true);
    try {
      const fixedUpdates = {};

      for (const field of editFormData) {
        if (field.es_fijo) {
          let upperValue = field.valor?.toUpperCase() || null;
          if (field.id === 'nombre') {
            upperValue = `${(field._nombres || '').trim()} ${(field._apellidos || '').trim()}`.trim().toUpperCase();
            upperValue = upperValue || null;
          }
          if (field.id === 'direccion') {
            const dirObj = {
              cep: field._cep || '',
              endereco: field._endereco || '',
              numero: field._numero || '',
              complemento: field._complemento || '',
              bairro: field._bairro || '',
              cidade: field._cidade || '',
              estado: field._estado || '',
              ponto_referencia: field._ponto_referencia || ''
            };
            upperValue = JSON.stringify(dirObj);
          }

          if (client[field.id] !== upperValue && (client[field.id] || upperValue)) {
            fixedUpdates[field.id] = upperValue;
          }
        }
      }

      // Process newFields (Custom EAV fields added via dropdown)
      for (const nf of newFields) {
        if (!nf.campo_id || !nf.valor) continue;
        const upperVal = nf.valor.toUpperCase();

        const isFixed = fixedFields.find(f => f.id === nf.campo_id);
        if (isFixed) {
          fixedUpdates[nf.campo_id] = upperVal;
          continue;
        }

        // Con la nueva arquitectura standalone no existen campos dinámicos: todo
        // campo de cliente es una columna fija de `clientes`, así que ignoramos
        // cualquier campo nuevo que no esté en el catálogo fijo.
        console.warn('Ignoring new field not mapped in fixed config:', nf.campo_id);
      }

      if (Object.keys(fixedUpdates).length > 0) {
        const { error: fErr } = await supabase.from('clientes').update(fixedUpdates).eq('id', clientId);
        if (fErr) throw fErr;
      }

      await fetchClientData();
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('[useClientViewEdit] Error saving edits:', err);
      alert('Error al guardar. Verifica la consola.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Search filtering for edit modal ────────────────────────────────────────
  const normalizeEditSearchText = (value = '') =>
    String(value || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const editModalQuery = normalizeEditSearchText(editModalSearchQuery);

  const filteredEditFormData = editFormData.filter(field => {
    if (!editModalQuery) return true;
    const fieldName = normalizeEditSearchText(field.nombre_campo);
    let fieldValue = '';
    if (field.id === 'nombre') {
      fieldValue = normalizeEditSearchText(`${field._nombres || ''} ${field._apellidos || ''}`);
    } else if (field.id === 'direccion') {
      fieldValue = normalizeEditSearchText(`${field._endereco || ''} ${field._numero || ''} ${field._bairro || ''} ${field._cidade || ''}`);
    } else {
      fieldValue = normalizeEditSearchText(field.valor);
    }
    return fieldName.includes(editModalQuery) || fieldValue.includes(editModalQuery);
  });

  const filteredNewFields = newFields.filter(field => {
    if (!editModalQuery) return true;
    const campoRef = FIXED_FIELDS_CATALOG.find(f => f.id === field.campo_id);
    const fieldName = normalizeEditSearchText(campoRef?.nombre_campo || '');
    const fieldValue = normalizeEditSearchText(field.valor);
    return fieldName.includes(editModalQuery) || fieldValue.includes(editModalQuery);
  });

  const hasEditModalResults = filteredEditFormData.length > 0 || filteredNewFields.length > 0;

  return {
    // State
    isEditModalOpen,
    setIsEditModalOpen,
    isSaving,
    editFormData,
    setEditFormData,
    newFields,
    setNewFields,
    editModalSearchQuery,
    setEditModalSearchQuery,
    editingCategoryId,
    // Computed
    filteredEditFormData,
    filteredNewFields,
    hasEditModalResults,
    // Handlers
    openEditModal,
    handleSaveEdits,
    handleDeleteFieldData,
    handleAddCustomField,
    handleCepSearch,
  };
}
