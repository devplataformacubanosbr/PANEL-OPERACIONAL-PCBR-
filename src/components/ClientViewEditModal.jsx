import React from 'react';
import { Search, Trash2, Plus, X } from 'lucide-react';

export default function ClientViewEditModal({
  isOpen,
  onClose,

  client = {},
  relaciones = [],
  editFormData = [],
  onEditFormDataChange,
  newFields = [],
  _onNewFieldsChange,
  onSaveEdits,
  isSaving,
  searchQuery,
  onSearchChange,
  _fixedFieldsCatalog = [],
  handleCepSearch,
  toIsoDate,
  toSlashDate,
}) {
  const [isCopying, setIsCopying] = React.useState(false);

  if (!isOpen) return null;

  const ESTADO_CIVIL_OPTIONS = [
    "Casado(a)", "Divorciado(a)", "Outro", "Separado(a) Judicialmente",
    "Solteiro(a)", "União Estável", "Viúvo(a)"
  ];

  const SEXO_OPTIONS = ["Masculino", "Feminino"];

  const normalizeEditSearchText = (value = '') =>
    String(value || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const editModalQuery = normalizeEditSearchText(searchQuery);
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

  const hasEditModalResults = filteredEditFormData.length > 0 || newFields.length > 0;

  const handleCopyFromRelative = async (e) => {
    const relId = e.target.value;
    if (!relId) return;
    setIsCopying(true);
    try {
      const { supabase } = await import('../supabaseClient');
      const { data: relClient } = await supabase.from('clientes').select('*').eq('id', relId).single();


      const ignoredFields = ['nombre', 'cpf', 'rnm', 'carnet_identidad', 'fecha_nacimiento', 'sexo', 'numero_pasaporte', 'numero_refugio'];

      onEditFormDataChange(prev => prev.map(field => {
        let newVal = null;
        if (field.id === 'direccion') {
          if (relClient && (relClient.endereco || relClient.cidade || relClient.cep)) {
            return {
              ...field,
              _cep: relClient.cep || field._cep || '',
              _endereco: relClient.endereco || field._endereco || '',
              _numero: relClient.numero || field._numero || '',
              _bairro: relClient.bairro || field._bairro || '',
              _cidade: relClient.cidade || field._cidade || '',
              _estado: relClient.estado || field._estado || '',
              _complemento: relClient.complemento || field._complemento || ''
            };
          }
        } else if (!ignoredFields.includes(field.id) && !ignoredFields.includes(field.nombre_campo?.toLowerCase())) {
          if (field.id && relClient && relClient[field.id]) {
            newVal = relClient[field.id];
          } else if (field.is_custom_json && relClient && relClient.campos_personalizados) {
            newVal = relClient.campos_personalizados[field.id];
          }
        }
        
        if (newVal) {
          return { ...field, valor: newVal };
        }
        return field;
      }));
      
      const toast = (await import('react-hot-toast')).default;
      toast.success('Datos copiados exitosamente');
    } catch (err) {
      console.error(err);
      const toast = (await import('react-hot-toast')).default;
      toast.error('Error al copiar datos');
    } finally {
      setIsCopying(false);
      e.target.value = ''; // reset select
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Editar Datos del Cliente</h2>
          
          {relaciones && relaciones.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select 
                className="form-input" 
                onChange={handleCopyFromRelative}
                disabled={isCopying}
                style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem', width: 'auto' }}
              >
                <option value="">{isCopying ? 'Copiando...' : 'Copiar datos de...'}</option>
                {relaciones.map(r => {
                  const relative = r.cliente_id === client.id ? r.cliente_secundario : r.cliente_principal;
                  return (
                    <option key={r.id} value={relative.id}>
                      {relative.nombre} ({r.tipo_relacion})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, maxWidth: '400px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="var(--color-text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Filtrar campos..."
                className="form-input"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                style={{ paddingLeft: '2.2rem', width: '100%', fontSize: '0.875rem' }}
              />
            </div>
            <button className="btn btn-ghost" style={{ padding: '0.5rem', flexShrink: 0 }} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!hasEditModalResults ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No se encontraron campos que coincidan con "{searchQuery}"
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {filteredEditFormData.map(field => {
                const isDate = field.id && String(field.id).includes('fecha');
                const isEstadoCivil = field.id === 'estado_civil';
                const isSexo = field.id === 'sexo';
                const isNombre = field.id === 'nombre';
                const isDireccion = field.id === 'direccion';

                const updateField = (updates) => {
                  onEditFormDataChange(prev => prev.map(f => (f.id === field.id && f.campo_id === field.campo_id) ? { ...f, ...updates } : f));
                };

                if (isNombre) {
                  return (
                    <div key={field.id || field.campo_id} style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Nombres</label>
                        <input type="text" className="form-input" value={field._nombres || ''} onChange={e => updateField({ _nombres: e.target.value })} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Apellidos</label>
                        <input type="text" className="form-input" value={field._apellidos || ''} onChange={e => updateField({ _apellidos: e.target.value })} />
                      </div>
                    </div>
                  );
                }

                if (isDireccion) {
                  return (
                    <div key={field.id || field.campo_id} style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{field.nombre_campo}</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>CEP</label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input type="text" className="form-input" placeholder="00000-000" value={field._cep || ''} onChange={e => {
                              const val = e.target.value;
                              updateField({ _cep: val });
                              if (val.replace(/\D/g, '').length === 8 && handleCepSearch) {
                                handleCepSearch(val, (data) => updateField({ _endereco: data.logradouro, _bairro: data.bairro, _cidade: data.localidade, _estado: data.uf }));
                              }
                            }} />
                            {handleCepSearch && (
                              <button type="button" className="btn btn-secondary" onClick={() => handleCepSearch(field._cep, (data) => updateField({ _endereco: data.logradouro, _bairro: data.bairro, _cidade: data.localidade, _estado: data.uf }))}>
                                <Search size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Calle/Avenida</label>
                          <input type="text" className="form-input" value={field._endereco || ''} onChange={e => updateField({ _endereco: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Número</label>
                          <input type="text" className="form-input" value={field._numero || ''} onChange={e => updateField({ _numero: e.target.value })} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Bairro</label>
                          <input type="text" className="form-input" value={field._bairro || ''} onChange={e => updateField({ _bairro: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Ciudad</label>
                          <input type="text" className="form-input" value={field._cidade || ''} onChange={e => updateField({ _cidade: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Estado (UF)</label>
                          <input type="text" className="form-input" value={field._estado || ''} onChange={e => updateField({ _estado: e.target.value })} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Complemento / Referencia</label>
                        <input type="text" className="form-input" value={field._complemento || ''} onChange={e => updateField({ _complemento: e.target.value })} />
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={field.id || field.campo_id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{field.nombre_campo}</label>
                    {isDate ? (
                      <input type="date" className="form-input" value={toIsoDate ? toIsoDate(field.valor) : (field.valor || '')} onChange={e => updateField({ valor: toSlashDate ? toSlashDate(e.target.value) : e.target.value })} />
                    ) : isEstadoCivil ? (
                      <select className="form-input" value={field.valor || ''} onChange={e => updateField({ valor: e.target.value })}>
                        <option value="">Seleccione...</option>
                        {ESTADO_CIVIL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : isSexo ? (
                      <select className="form-input" value={field.valor || ''} onChange={e => updateField({ valor: e.target.value })}>
                        <option value="">Seleccione...</option>
                        {SEXO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input type="text" className="form-input" value={field.valor || ''} onChange={e => updateField({ valor: e.target.value })} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={onSaveEdits} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
