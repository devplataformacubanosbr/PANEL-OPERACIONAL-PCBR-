import React from 'react';
import { User, Search, Edit2, Copy, Check } from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';

const ClientPersonalData = ({
  client,

  fixedFields,
  localSearchQuery,
  setLocalSearchQuery,
  openEditModal,
  handleCopy,
  copiedId
}) => {
  const targetNames = ['Informaciones Personales', 'Datos Familiares', 'Documentos de Identidad'];
  // Estos identificadores de "Documentos de Identidad" ya se muestran con su
  // propio diseño agrupado en "Documentos Asociados" (docGroups, más abajo);
  // se excluyen aquí para no duplicarlos. Cualquier campo NUEVO que un admin
  // agregue en esa categoría (vía ConfigCamposClientesSettings) no está en esta
  // lista, así que sí pasa por el loop genérico y queda visible.
  const DOC_GROUP_FIELD_IDS = new Set([
    'rnm', 'numero_pasaporte', 'fecha_emision_pasaporte', 'fecha_vencimiento_pasaporte',
    'numero_refugio', 'fecha_vencimiento_refugio', 'carnet_identidad'
  ]);
  // We can just iterate directly over the sections now that we don't depend on the old categorias table
  // targetCats logic can be removed, we just render the sections that have matching fixedFields.

  return (
    <section id="personal-data" className="glass-panel" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={20} color="var(--color-primary)" /> Datos del Cliente
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', maxWidth: '300px', width: '100%' }}>
            <Search size={16} color="var(--color-text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar dato (ej. Madre, Pasaporte)..."
              className="form-input"
              value={localSearchQuery}
              onChange={e => setLocalSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.2rem', width: '100%', fontSize: '0.875rem' }}
            />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => openEditModal('ALL_PERSONAL')} style={{ flexShrink: 0 }}>
            <Edit2 size={14} style={{ marginRight: '4px' }} /> Editar Datos
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {targetNames.map(catName => {
          const sectionFields = fixedFields.filter(f => f.category_name === catName);

          // Extract data
          const sectionData = [];
          sectionFields.forEach(campo => {
            if (catName === 'Documentos de Identidad' && DOC_GROUP_FIELD_IDS.has(campo.id)) return;
            
            const val = client[campo.id];
            if (val) sectionData.push({ campo_id: campo.id, valor: val });
          });

          const query = localSearchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

          // If it's Informaciones Personales, we might want to exclude "direccion" since we render it as its own section later
          const visibleFields = sectionData.filter(d => {
            if (d.campo_id === 'direccion') return false;
            if (!d.valor) return false;

            if (query) {
              const campoDef = sectionFields.find(c => c.id === d.campo_id);
              if (!campoDef) return false;
              const fieldName = campoDef.nombre_campo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const fieldVal = String(d.valor).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              if (!fieldName.includes(query) && !fieldVal.includes(query)) return false;
            }
            return true;
          });

          if (visibleFields.length === 0) return null;

          const titleMap = {
            'Informaciones Personales': 'Datos Personales',
            'Datos Familiares': 'Padres y Familiares',
            'Documentos de Identidad': 'Documentos'
          };

          return (
            <React.Fragment key={catName}>
              <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginTop: '0.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  {titleMap[catName] || catName}
                </h3>
              </div>
              {visibleFields.map(dato => {
                const campo = sectionFields.find(c => c.id === dato.campo_id);

                if (campo.id === 'nombre') {
                  const fullName = (dato.valor || '').trim().toUpperCase();
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
                        if (padreIdx > 0) splitIndex = padreIdx;
                      }
                    }
                  }

                  const n_nombres = parts.slice(0, splitIndex).join(' ') || '';
                  const n_apellidos = parts.slice(splitIndex).join(' ') || '';

                  return (
                    <React.Fragment key={campo.id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 0', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ flex: '0 0 140px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                          Nombres
                        </div>
                        <div style={{ flex: 1, fontSize: '0.875rem', color: 'var(--color-text-primary)', fontWeight: 500, paddingRight: '1rem', wordBreak: 'break-word' }}>
                          {n_nombres}
                        </div>
                        <button onClick={() => handleCopy(n_nombres || '', 'nombres')} className="btn btn-ghost" style={{ padding: '0.35rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-elevated)', flexShrink: 0 }} title="Copiar">
                          {copiedId === 'nombres' ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 0', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ flex: '0 0 140px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                          Apellidos
                        </div>
                        <div style={{ flex: 1, fontSize: '0.875rem', color: 'var(--color-text-primary)', fontWeight: 500, paddingRight: '1rem', wordBreak: 'break-word' }}>
                          {n_apellidos}
                        </div>
                        <button onClick={() => handleCopy(n_apellidos || '', 'apellidos')} className="btn btn-ghost" style={{ padding: '0.35rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-elevated)', flexShrink: 0 }} title="Copiar">
                          {copiedId === 'apellidos' ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </React.Fragment>
                  );
                }

                return (
                  <div key={campo.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ flex: '0 0 140px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                      {campo.nombre_campo}
                    </div>
                    <div style={{ flex: 1, fontSize: '0.875rem', color: 'var(--color-text-primary)', fontWeight: 500, paddingRight: '1rem', wordBreak: 'break-word' }}>
                      {dato.valor}
                    </div>
                    <button onClick={() => handleCopy(dato.valor, campo.id)} className="btn btn-ghost" style={{ padding: '0.35rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-elevated)', flexShrink: 0 }} title="Copiar">
                      {copiedId === campo.id ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                    </button>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}


        {/* Documentos Asociados (Datos) */}
        {(() => {
          const docGroups = [
            {
              id: 'cpf',
              label: 'CPF',
              icon: '🆔',
              fields: [
                { id: 'cpf', label: 'Nº CPF' }
              ],
              fieldValue: (fieldId) => client?.[fieldId],
              color: '#378ADD'
            },
            {
              id: 'pasaporte',
              label: 'Pasaporte',
              icon: '🛂',
              fields: [
                { id: 'numero_pasaporte', label: 'Nº Pasaporte' },
                { id: 'fecha_emision_pasaporte', label: 'Emisión' },
                { id: 'fecha_vencimiento_pasaporte', label: 'Vencimiento' }
              ],
              fieldValue: (fieldId) => client?.[fieldId],
              color: '#1D9E75'
            },
            {
              id: 'rnm',
              label: 'RNM / Identidad',
              icon: '🪪',
              fields: [
                { id: 'rnm', label: 'Nº RNM' },
                { id: 'carnet_identidad', label: 'Carnet Identidad' }
              ],
              fieldValue: (fieldId) => client?.[fieldId],
              color: '#BA7517'
            },
            {
              id: 'refugio',
              label: 'Refugio',
              icon: '🛡️',
              fields: [
                { id: 'numero_refugio', label: 'Protocolo Refugio' },
                { id: 'fecha_vencimiento_refugio', label: 'Vencimiento' }
              ],
              fieldValue: (fieldId) => client?.[fieldId],
              color: '#D85A30'
            }
          ];

          const hasAnyData = docGroups.some(g => g.fields.some(f => g.fieldValue(f.id, f.custom)));
          if (!hasAnyData) return null;

          return (
            <React.Fragment>
              <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginTop: '0.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  Documentos Asociados
                </h3>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
                {docGroups.map(group => {
                  const hasData = group.fields.some(f => group.fieldValue(f.id, f.custom));
                  if (!hasData) return null;

                  return (
                    <div
                      key={group.id}
                      style={{
                        border: `1px solid ${group.color}33`,
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        background: `${group.color}08`
                      }}
                    >
                      {/* Header del grupo */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: `${group.color}15`,
                        borderBottom: `1px solid ${group.color}22`,
                        fontSize: '0.78rem', fontWeight: 600,
                        color: group.color
                      }}>
                        <span>{group.icon}</span>
                        <span>{group.label}</span>
                      </div>

                      <div style={{ padding: '0.65rem' }}>
                        {group.fields.map(field => {
                          const val = group.fieldValue(field.id, field.custom);
                          if (!val) return null;
                          return (
                            <div key={field.id} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '0.35rem 0', gap: '0.5rem'
                            }}>
                              <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0 }}>
                                {field.label}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'right', wordBreak: 'break-word' }}>
                                  {String(field.id).includes('fecha') ? formatDate(val) : val}
                                </span>
                                <button onClick={() => handleCopy(val, `${group.id}-${field.id}`)} className="btn btn-ghost" style={{ padding: '0.15rem', borderRadius: '4px', flexShrink: 0 }}>
                                  {copiedId === `${group.id}-${field.id}` ? <Check size={11} color="var(--color-success)" /> : <Copy size={11} />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </React.Fragment>
          );
        })()}


        {/* Dirección Section */}
        {(() => {
          const dirDato = client['direccion'];
          if (!dirDato) return null;

          let dirObj = {};
          try {
            if (typeof dirDato === 'string' && dirDato.startsWith('{')) dirObj = JSON.parse(dirDato);
            else if (typeof dirDato === 'object' && dirDato !== null) dirObj = dirDato;
            else dirObj.endereco = dirDato;
          } catch (_e) {
            dirObj.endereco = dirDato;
          }

          const subFields = [
            { id: 'cep', label: 'CEP', val: dirObj.cep },
            { id: 'endereco', label: 'Endereço', val: dirObj.endereco },
            { id: 'numero', label: 'Número', val: dirObj.numero },
            { id: 'complemento', label: 'Complemento', val: dirObj.complemento },
            { id: 'bairro', label: 'Bairro', val: dirObj.bairro },
            { id: 'cidade', label: 'Cidade (Residência)', val: dirObj.cidade },
            { id: 'estado', label: 'Estado (Residência)', val: dirObj.estado },
            { id: 'ponto_referencia', label: 'Ponto de Referência', val: dirObj.ponto_referencia }
          ].filter(sf => {
            if (!sf.val) return false;
            const query = localSearchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (query) {
              const fieldName = sf.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const fieldVal = String(sf.val).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              if (!fieldName.includes(query) && !fieldVal.includes(query)) return false;
            }
            return true;
          });

          if (subFields.length === 0) return null;

          const rua = dirObj.endereco;
          const num = dirObj.numero;
          const comp = dirObj.complemento;
          const bairro = dirObj.bairro;
          const cid = dirObj.cidade;
          const uf = dirObj.estado;
          const cep = dirObj.cep;
          const ref = dirObj.ponto_referencia;

          let line1 = [rua, num].filter(Boolean).join(', ');
          if (comp) line1 += ` - ${comp}`;
          let line2 = [bairro, cid, uf].filter(Boolean).join(' - ');
          let addressFull = [line1, line2, cep ? `CEP: ${cep}` : '', ref ? `Ref: ${ref}` : ''].filter(Boolean).join(' | ');

          return (
            <React.Fragment>
              <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginTop: '0.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  Dirección Completa
                </h3>
              </div>
              {subFields.map(sf => (
                <div key={`dir-${sf.id}`} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1rem', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
                      {sf.label}
                    </label>
                    <div style={{ fontSize: '1rem', color: 'var(--color-text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>
                      {sf.val}
                    </div>
                  </div>
                  <button onClick={() => handleCopy(sf.val, sf.id)} className="btn btn-ghost" style={{ padding: '0.4rem', borderRadius: 'var(--radius-md)', marginLeft: '0.5rem', background: 'var(--color-bg-primary)' }} title="Copiar rápido">
                    {copiedId === sf.id ? <Check size={16} color="var(--color-success)" /> : <Copy size={16} />}
                  </button>
                </div>
              ))}

              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1rem', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
                    Dirección Concatenada
                  </label>
                  <div style={{ fontSize: '1rem', color: 'var(--color-text-primary)', fontWeight: 500, wordBreak: 'break-word', lineHeight: '1.5' }}>
                    {line1 && <div>{line1}</div>}
                    {line2 && <div>{line2}</div>}
                    {(cep || ref) && <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>{cep ? `CEP: ${cep}` : ''} {ref ? `(Ref: ${ref})` : ''}</div>}
                    {(!line1 && !line2 && !cep && !ref && dirObj.endereco) && <div>{dirObj.endereco}</div>}
                  </div>
                </div>
                <button onClick={() => handleCopy(addressFull || dirObj.endereco, 'direccion')} className="btn btn-ghost" style={{ padding: '0.4rem', borderRadius: 'var(--radius-md)', marginLeft: '0.5rem', background: 'var(--color-bg-primary)' }} title="Copiar dirección completa">
                  {copiedId === 'direccion' ? <Check size={16} color="var(--color-success)" /> : <Copy size={16} />}
                </button>
              </div>
            </React.Fragment>
          );
        })()}
      </div>
    </section>
  );
};

export default ClientPersonalData;