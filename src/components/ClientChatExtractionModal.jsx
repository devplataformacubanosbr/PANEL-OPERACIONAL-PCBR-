import React, { useState, useMemo } from 'react';
import { Sparkles, X, Check, Users, UserPlus, AlertCircle, ArrowRight, ShieldCheck, Home } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '../utils/dateFormatter';

export default function ClientChatExtractionModal({
  isOpen,
  onClose,
  client,
  extractedData,
  onApply,
  isApplying = false
}) {
  if (!isOpen || !extractedData) return null;

  // Formateador legible de dirección
  const formatAddressObj = (dir) => {
    if (!dir) return '';
    if (typeof dir === 'string') return dir;
    const parts = [];
    if (dir.endereco) parts.push(dir.endereco);
    if (dir.numero) parts.push(`N° ${dir.numero}`);
    if (dir.complemento) parts.push(dir.complemento);
    if (dir.bairro) parts.push(`Bairro ${dir.bairro}`);
    if (dir.cidade) parts.push(dir.cidade);
    if (dir.estado) parts.push(dir.estado);
    if (dir.cep) parts.push(`CEP: ${dir.cep}`);
    return parts.join(', ');
  };

  // Mapear campos detectados a su valor actual en el cliente
  const candidateFields = useMemo(() => {
    if (!client || !extractedData) return [];

    const currentDireccionFormatted = (() => {
      const raw = client.direccion;
      if (!raw) return '';
      try {
        if (typeof raw === 'string' && raw.startsWith('{')) {
          return formatAddressObj(JSON.parse(raw));
        }
      } catch (_) {}
      return String(raw);
    })();

    const definitions = [
      {
        key: 'NOMBRE_COMPLETO',
        label: 'Nombre Completo',
        currentVal: client.nombre || '',
        extractedVal: extractedData.NOMBRE_COMPLETO || '',
      },
      {
        key: 'CPF',
        label: 'CPF',
        currentVal: client.cpf || '',
        extractedVal: extractedData.CPF || '',
      },
      {
        key: 'TELEFONO',
        label: 'Teléfono / WhatsApp',
        currentVal: client.telefono || '',
        extractedVal: extractedData.TELEFONO || '',
      },
      {
        key: 'EMAIL',
        label: 'Email',
        currentVal: client.email || '',
        extractedVal: extractedData.EMAIL || '',
      },
      {
        key: 'DIRECCION',
        label: 'Dirección en Brasil',
        currentVal: currentDireccionFormatted,
        extractedVal: extractedData.DIRECCION ? formatAddressObj(extractedData.DIRECCION) : '',
        rawExtracted: extractedData.DIRECCION,
      },
      {
        key: 'CIUDAD',
        label: 'Ciudad',
        currentVal: client.ciudad || '',
        extractedVal: extractedData.CIUDAD || extractedData.DIRECCION?.cidade || '',
      },
      {
        key: 'ESTADO',
        label: 'Estado',
        currentVal: client.estado || client.estado_federal || '',
        extractedVal: extractedData.ESTADO || extractedData.DIRECCION?.estado || '',
      },
      {
        key: 'NACIONALIDAD',
        label: 'Nacionalidad',
        currentVal: client.nacionalidad || '',
        extractedVal: extractedData.NACIONALIDAD || '',
      },
      {
        key: 'FECHA_NACIMIENTO',
        label: 'Fecha de Nacimiento',
        currentVal: client.fecha_nacimiento ? formatDate(client.fecha_nacimiento) : '',
        extractedVal: extractedData.FECHA_NACIMIENTO || '',
      },
      {
        key: 'SEXO',
        label: 'Sexo',
        currentVal: client.sexo || '',
        extractedVal: extractedData.SEXO || '',
      },
      {
        key: 'ESTADO_CIVIL',
        label: 'Estado Civil',
        currentVal: client.estado_civil || '',
        extractedVal: extractedData.ESTADO_CIVIL || '',
      },
      {
        key: 'NUMERO_DOCUMENTO',
        label: 'Pasaporte',
        currentVal: client.campos_personalizados?.numero_pasaporte || '',
        extractedVal: extractedData.NUMERO_DOCUMENTO || '',
      },
      {
        key: 'RNM',
        label: 'RNM / Registro Migratorio',
        currentVal: client.campos_personalizados?.rnm || '',
        extractedVal: extractedData.RNM || '',
      },
      {
        key: 'CARNET_IDENTIDAD',
        label: 'Carnet de Identidad / RG',
        currentVal: client.campos_personalizados?.carnet_identidad || '',
        extractedVal: extractedData.CARNET_IDENTIDAD || '',
      },
      {
        key: 'NUMERO_REFUGIO',
        label: 'Protocolo de Refugio',
        currentVal: client.campos_personalizados?.numero_refugio || '',
        extractedVal: extractedData.NUMERO_REFUGIO || '',
      },
      {
        key: 'NOMBRE_MADRE',
        label: 'Nombre de la Madre',
        currentVal: client.campos_personalizados?.nombre_madre || '',
        extractedVal: extractedData.NOMBRE_MADRE || '',
      },
      {
        key: 'NOMBRE_PADRE',
        label: 'Nombre del Padre',
        currentVal: client.campos_personalizados?.nombre_padre || '',
        extractedVal: extractedData.NOMBRE_PADRE || '',
      },
      {
        key: 'LUGAR_NACIMIENTO',
        label: 'Lugar de Nacimiento',
        currentVal: client.lugar_nacimiento || '',
        extractedVal: extractedData.LUGAR_NACIMIENTO || '',
      },
    ];

    // Incluir campos adicionales si la IA extrajo alguno
    if (extractedData.CAMPOS_ADICIONALES && typeof extractedData.CAMPOS_ADICIONALES === 'object') {
      Object.entries(extractedData.CAMPOS_ADICIONALES).forEach(([k, v]) => {
        if (v) {
          const lowerKey = k.toLowerCase();
          definitions.push({
            key: k,
            label: k.replace(/_/g, ' '),
            currentVal: client.campos_personalizados?.[lowerKey] || '',
            extractedVal: String(v),
            isAdditional: true
          });
        }
      });
    }

    // Filtrar solo aquellos campos donde el chat encontró algún valor
    return definitions.filter(d => Boolean(d.extractedVal && String(d.extractedVal).trim().length > 0));
  }, [client, extractedData]);

  // Estado de checkboxes para campos del titular
  // Por defecto: seleccionados solo aquellos donde el cliente actual NO tiene valor (o está vacío)
  const [selectedFields, setSelectedFields] = useState(() => {
    const initial = {};
    candidateFields.forEach(f => {
      const isCurrentEmpty = !f.currentVal || String(f.currentVal).trim() === '';
      initial[f.key] = isCurrentEmpty;
    });
    return initial;
  });

  // Estado de selección de familiares detectados
  const familiares = useMemo(() => {
    return Array.isArray(extractedData.FAMILIARES_MENCIONADOS)
      ? extractedData.FAMILIARES_MENCIONADOS.filter(f => f && f.nombre)
      : [];
  }, [extractedData]);

  const [selectedRelatives, setSelectedRelatives] = useState(() => {
    const initial = {};
    familiares.forEach((_, idx) => {
      initial[idx] = true; // Por defecto vincular todos los familiares detectados
    });
    return initial;
  });

  const toggleField = (key) => {
    setSelectedFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleRelative = (idx) => {
    setSelectedRelatives(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleApplyClick = async () => {
    // 1. Filtrar los campos seleccionados
    const dataToApply = {};
    candidateFields.forEach(f => {
      if (selectedFields[f.key]) {
        if (f.key === 'DIRECCION') {
          dataToApply.DIRECCION = f.rawExtracted || f.extractedVal;
        } else {
          dataToApply[f.key] = f.extractedVal;
        }
      }
    });

    // 2. Filtrar familiares seleccionados
    const relativesToCreate = familiares.filter((_, idx) => selectedRelatives[idx]);

    if (Object.keys(dataToApply).length === 0 && relativesToCreate.length === 0) {
      toast.error('Selecciona al menos un dato o familiar para aplicar.');
      return;
    }

    if (onApply) {
      await onApply({
        clientUpdates: dataToApply,
        relativesToCreate
      });
    }
  };

  const selectedCount = Object.values(selectedFields).filter(Boolean).length;
  const selectedRelativesCount = Object.values(selectedRelatives).filter(Boolean).length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '780px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg, 12px)',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
        background: 'var(--surface-raised, #181c24)',
        color: 'var(--color-text-primary, #fff)'
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.08))',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(55,138,221,0.2), rgba(29,158,117,0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(55,138,221,0.3)'
            }}>
              <Sparkles size={18} color="var(--brand-primary, #378ADD)" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
                Completar Ficha desde el Chat
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #8a94a6)' }}>
                Cliente: <strong>{client.nombre}</strong>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '0.4rem', borderRadius: '50%' }}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Banner de explicación */}
          <div style={{
            padding: '0.75rem 1rem',
            background: 'rgba(55,138,221,0.08)',
            border: '1px solid rgba(55,138,221,0.2)',
            borderRadius: 'var(--radius-md, 8px)',
            fontSize: '0.825rem',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem'
          }}>
            <ShieldCheck size={18} color="#378ADD" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Modo Seguro:</strong> Los campos vacíos están preseleccionados para autocompletar. Los campos que ya tenían datos guardados no se sobreescriben a menos que marques su casilla manualmente.
            </div>
          </div>

          {candidateFields.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2.5rem 1rem',
              color: 'var(--color-text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={32} opacity={0.6} />
              <p style={{ margin: 0 }}>No se encontraron datos estructurados adicionales en los mensajes de chat.</p>
            </div>
          ) : (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>
                  Datos del Titular ({candidateFields.length} detectados)
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const all = {};
                      candidateFields.forEach(f => { all[f.key] = true; });
                      setSelectedFields(all);
                    }}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Seleccionar todos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const none = {};
                      candidateFields.forEach(f => { none[f.key] = false; });
                      setSelectedFields(none);
                    }}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  >
                    Deseleccionar
                  </button>
                </div>
              </div>

              {/* Tabla Comparativa */}
              <div style={{
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.08))' }}>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', width: '30px' }}>✓</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', width: '160px' }}>Campo</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Valor Actual</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Detectado en Chat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidateFields.map((f, i) => {
                      const isCurrentEmpty = !f.currentVal || String(f.currentVal).trim() === '';
                      const isChecked = !!selectedFields[f.key];

                      return (
                        <tr
                          key={f.key}
                          onClick={() => toggleField(f.key)}
                          style={{
                            borderBottom: i < candidateFields.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            background: isChecked ? 'rgba(55,138,221,0.05)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleField(f.key)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {f.label}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', color: isCurrentEmpty ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
                            {isCurrentEmpty ? (
                              <span style={{ fontStyle: 'italic', opacity: 0.6 }}>(Vacío)</span>
                            ) : (
                              <span>{f.currentVal}</span>
                            )}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: '#38bdf8' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span>{f.extractedVal}</span>
                              {isCurrentEmpty && (
                                <span style={{
                                  fontSize: '0.65rem',
                                  padding: '0.1rem 0.35rem',
                                  background: 'rgba(23,198,113,0.15)',
                                  color: 'var(--color-success, #17c671)',
                                  borderRadius: '4px',
                                  fontWeight: 600
                                }}>
                                  NUEVO
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sección de Familiares Detectados (Flujo C) */}
          {familiares.length > 0 && (
            <div style={{
              padding: '1rem',
              background: 'rgba(216,90,48,0.05)',
              border: '1px solid rgba(216,90,48,0.2)',
              borderRadius: 'var(--radius-md, 8px)',
              marginTop: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#ea580c' }}>
                <Users size={18} />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                  Familiares Detectados en el Chat ({familiares.length})
                </h3>
              </div>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Se detectaron personas relacionadas mencionadas en la conversación. Al seleccionarlas, se creará su ficha de cliente y quedarán vinculadas como "Familiar" en la pestaña de Relaciones.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {familiares.map((fam, idx) => {
                  const isChecked = !!selectedRelatives[idx];
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleRelative(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        background: isChecked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRelative(idx)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            {fam.nombre}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            Relación: <strong>{fam.parentesco || 'Familiar'}</strong>
                            {fam.cpf ? ` • CPF: ${fam.cpf}` : ''}
                            {fam.detalles ? ` • ${fam.detalles}` : ''}
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: 'rgba(216,90,48,0.15)',
                        color: '#f97316',
                        fontWeight: 600
                      }}>
                        Crear & Vincular
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--color-border, rgba(255,255,255,0.08))',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Seleccionados: <strong>{selectedCount}</strong> datos del titular
            {familiares.length > 0 && ` y ${selectedRelativesCount} familiares`}
          </span>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApplyClick}
              disabled={isApplying || (selectedCount === 0 && selectedRelativesCount === 0)}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'linear-gradient(135deg, var(--brand-primary, #378ADD), var(--brand-primary-dark, #1d4ed8))'
              }}
            >
              {isApplying ? (
                <>Guardando...</>
              ) : (
                <>
                  <Check size={16} /> Aplicar Datos a la Ficha
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
