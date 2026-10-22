import React, { useState } from 'react';
import {
  X,
  Bot,
  Play,
  Pause,
  Zap,
  FileText,
  PenTool,
  Users,
  MessageSquare,
  Sliders,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  RotateCw,
  Loader2,
  Copy,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAutonomousAgent } from '../../context/AutonomousAgentContext';

export default function AutonomousAgentModal() {
  const {
    isAgentRunning,
    isProcessingNow,
    stats,
    recentLogs,
    settings,
    isModalOpen,
    closeControlCenter,
    startAgent,
    pauseAgent,
    runBatchNow,
    updateSettings,
    clearLogs,
    clearExceptions
  } = useAutonomousAgent();

  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor' | 'exceptions' | 'settings'

  // Filtrar casos que requieran atención manual del operador (borrosos o errores)
  const exceptions = recentLogs.filter(
    l => l.type === 'warning' || l.type === 'error' || l.motivo || l.suggestedMessage
  );
  const totalExceptions = (stats.blurryDocs || 0) + (stats.errorDocs || 0);

  if (!isModalOpen) return null;

  const handleOpenClient = (clientId) => {
    if (!clientId) return;
    closeControlCenter();
    window.dispatchEvent(new CustomEvent('navigateToClient', { detail: { clientId } }));
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(5, 10, 20, 0.82)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'var(--color-bg-base, #0d1117)',
        width: '100%', maxWidth: '980px', maxHeight: '92vh',
        borderRadius: '16px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        overflow: 'hidden', animation: 'scaleIn 0.2s ease-out'
      }}>
        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              background: isAgentRunning
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(59, 130, 246, 0.25))'
                : 'rgba(255, 255, 255, 0.05)',
              border: isAgentRunning ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
              color: isAgentRunning ? '#10b981' : '#94a3b8',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot size={24} className={isProcessingNow ? 'animate-bounce' : ''} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  Piloto Automático Operacional
                </h2>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: isAgentRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                  color: isAgentRunning ? '#34d399' : '#94a3b8',
                  border: isAgentRunning ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <span style={{
                    height: '6px', width: '6px', borderRadius: '50%',
                    background: isAgentRunning ? '#10b981' : '#64748b',
                    display: 'inline-block'
                  }} className={isAgentRunning ? 'animate-pulse' : ''} />
                  {isAgentRunning ? 'ACTIVO (TRABAJANDO SOLO)' : 'PAUSADO'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#8b949e' }}>
                Agente autónomo que clasifica documentos, detecta familiares, extrae firmas y enriquece fichas sin intervención manual.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {/* Botón Maestro Iniciar / Pausar */}
            {isAgentRunning ? (
              <button
                onClick={pauseAgent}
                className="btn btn-secondary"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171',
                  background: 'rgba(239, 68, 68, 0.1)', fontSize: '0.8rem', padding: '0.45rem 0.9rem'
                }}
              >
                <Pause size={15} /> Pausar Agente
              </button>
            ) : (
              <button
                onClick={startAgent}
                className="btn btn-primary"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderColor: '#10b981', color: '#fff', fontSize: '0.8rem', padding: '0.45rem 0.9rem',
                  fontWeight: 600, boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                }}
              >
                <Play size={15} /> Activar Piloto Automático
              </button>
            )}

            <button
              onClick={closeControlCenter}
              className="btn btn-ghost"
              style={{ padding: '0.5rem', borderRadius: '8px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── METRICS TELEMETRY CARDS ────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem', padding: '1rem 1.75rem',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <StatCard
            icon={<FileText size={18} color="#3b82f6" />}
            value={stats.docsOrganized || 0}
            label="Documentos Organizados"
            badge="100% Auto"
          />
          <StatCard
            icon={<PenTool size={18} color="#0055ff" />}
            value={stats.signaturesExtracted || 0}
            label="Firmas en Caneta Azul"
            badge="100% Auto"
          />
          <StatCard
            icon={<Users size={18} color="#10b981" />}
            value={stats.familiesResolved || 0}
            label="Familiares Vinculados"
            badge="100% Auto"
          />
          <StatCard
            icon={<MessageSquare size={18} color="#a855f7" />}
            value={stats.chatsHarvested || 0}
            label="Entidades de Chat"
            badge="100% Auto"
          />
          <StatCard
            icon={<AlertTriangle size={18} color={totalExceptions > 0 ? "#f59e0b" : "#6e7681"} />}
            value={totalExceptions}
            label="Casos para Revisión"
            badge={totalExceptions > 0 ? "⚠️ Atención Manual" : "0 Casos"}
            onClick={() => setActiveTab('exceptions')}
            highlight={totalExceptions > 0}
          />
        </div>

        {/* ── PESTAÑAS Y ACCIONES INMEDIATAS ──────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.65rem 1.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: '#0d1117'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('monitor')}
              style={{
                background: activeTab === 'monitor' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: activeTab === 'monitor' ? '#60a5fa' : '#8b949e',
                border: activeTab === 'monitor' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.8rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
              }}
            >
              <RotateCw size={14} className={isProcessingNow ? 'animate-spin' : ''} />
              Monitor en Vivo ({recentLogs.length})
            </button>

            <button
              onClick={() => setActiveTab('exceptions')}
              style={{
                background: activeTab === 'exceptions' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                color: activeTab === 'exceptions' ? '#fbbf24' : '#8b949e',
                border: activeTab === 'exceptions' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.8rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
              }}
            >
              <AlertTriangle size={14} className={exceptions.length > 0 ? 'text-amber-400' : ''} />
              ⚠️ Solo Casos Borrosos y Errores ({exceptions.length})
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              style={{
                background: activeTab === 'settings' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: activeTab === 'settings' ? '#60a5fa' : '#8b949e',
                border: activeTab === 'settings' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                borderRadius: '6px', padding: '0.35rem 0.8rem', fontSize: '0.8rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
              }}
            >
              <Sliders size={14} /> Alcance y Reglas
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => runBatchNow(5)}
              disabled={isProcessingNow}
              className="btn btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '0.75rem', padding: '0.35rem 0.75rem',
                background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
                borderColor: 'rgba(59,130,246,0.3)', color: '#60a5fa'
              }}
              title="Fuerza al agente a procesar 5 tareas de inmediato"
            >
              {isProcessingNow ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              Procesar Lote de 5 Ahora
            </button>

            <button
              onClick={() => runBatchNow(10)}
              disabled={isProcessingNow}
              className="btn btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '0.75rem', padding: '0.35rem 0.75rem'
              }}
              title="Fuerza al agente a procesar 10 tareas de inmediato"
            >
              <Zap size={13} />
              Lote de 10
            </button>
          </div>
        </div>

        {/* ── CUERPO PRINCIPAL SEGÚN PESTAÑA ─────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.75rem' }}>
          {activeTab === 'monitor' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Barra de estado en vivo */}
              {isProcessingNow && (
                <div style={{
                  padding: '0.65rem 1rem', borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)',
                  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#93c5fd'
                }}>
                  <Loader2 size={16} className="animate-spin text-blue-400" />
                  <span>El agente está analizando un documento con IA en este instante...</span>
                </div>
              )}

              {/* Terminal de Actividad en Tiempo Real */}
              <div style={{
                background: '#040711',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '1rem',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.78rem',
                color: '#e6edf3',
                minHeight: '340px',
                maxHeight: '440px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem'
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  color: '#6e7681', fontSize: '0.7rem'
                }}>
                  <span>REGISTRO DE ACCIONES AUTÓNOMAS (STREAMING)</span>
                  <button
                    onClick={clearLogs}
                    style={{ background: 'transparent', border: 'none', color: '#6e7681', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Limpiar registro"
                  >
                    <Trash2 size={12} /> Limpiar
                  </button>
                </div>

                {recentLogs.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '240px', color: '#484f58', gap: '8px' }}>
                    <Bot size={32} />
                    <span>El registro está listo. El agente comenzará a volcar operaciones automáticamente.</span>
                  </div>
                ) : (
                  recentLogs.map(log => {
                    let color = '#cbd5e1';
                    if (log.type === 'success') color = '#34d399';
                    else if (log.type === 'warning') color = '#fbbf24';
                    else if (log.type === 'error') color = '#f87171';
                    else if (log.type === 'info') color = '#60a5fa';

                    return (
                      <div key={log.id} style={{ display: 'flex', gap: '8px', lineHeight: '1.45', wordBreak: 'break-word' }}>
                        <span style={{ color: '#6e7681', flexShrink: 0 }}>[{log.timestamp}]</span>
                        <span style={{ color }}>{log.message}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : activeTab === 'exceptions' ? (
            /* Pestaña: Casos que requieren atención humana (Borrosos / Errores) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 0.25rem' }}>
                    Bandeja de Casos para Revisión Manual ({exceptions.length})
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#8b949e', margin: 0 }}>
                    Todo lo normal se procesa 100% solo. Aquí solo aparecen fotos borrosas o archivos con error que requieren contacto con el cliente.
                  </p>
                </div>
                {exceptions.length > 0 && (
                  <button
                    onClick={clearExceptions}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Marcar todo como resuelto
                  </button>
                )}
              </div>

              {exceptions.length === 0 ? (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '12px', padding: '2.5rem', textAlign: 'center',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem'
                }}>
                  <CheckCircle2 size={36} color="#34d399" />
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                    ¡Excelente! Cero casos pendientes de revisión
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '440px' }}>
                    El agente no ha encontrado documentos borrosos ni errores. Todo el flujo se mantiene automatizado sin intervención manual.
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {exceptions.map(item => (
                    <div key={item.id} style={{
                      background: item.type === 'error' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(245, 158, 11, 0.06)',
                      border: item.type === 'error' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                            background: item.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: item.type === 'error' ? '#f87171' : '#fbbf24'
                          }}>
                            {item.type === 'error' ? '🚨 ERROR DE LECTURA' : '⚠️ FOTO BORROSA'}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                            {item.clientName || `Cliente #${item.clientId || ''}`}
                          </span>
                          {item.docId && (
                            <span style={{ fontSize: '0.7rem', color: '#6e7681' }}>
                              (Doc #{item.docId})
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#6e7681' }}>{item.timestamp}</span>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        <span style={{ color: '#94a3b8' }}>Diagnóstico de IA:</span> {item.motivo || item.message}
                      </div>

                      {item.suggestedMessage && (
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.35)', borderRadius: '6px', padding: '0.65rem 0.85rem',
                          border: '1px dashed rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', gap: '6px'
                        }}>
                          <span style={{ fontSize: '0.7rem', color: '#8b949e', fontWeight: 600 }}>
                            Mensaje sugerido para responder por WhatsApp:
                          </span>
                          <p style={{ fontSize: '0.78rem', color: '#93c5fd', margin: 0, fontStyle: 'italic' }}>
                            "{item.suggestedMessage}"
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(item.suggestedMessage);
                                toast.success('¡Mensaje de WhatsApp copiado al portapapeles!');
                              }}
                              style={{
                                background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)',
                                color: '#60a5fa', fontSize: '0.72rem', padding: '4px 9px', borderRadius: '4px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <Copy size={12} /> Copiar Mensaje
                            </button>

                            {item.clientId && (
                              <button
                                onClick={() => handleOpenClient(item.clientId)}
                                style={{
                                  background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                                  color: '#fff', fontSize: '0.72rem', padding: '4px 9px', borderRadius: '4px',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                              >
                                <ExternalLink size={12} /> Abrir Ficha del Cliente
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Pestaña: Configuración y Reglas del Agente */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '680px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 0.25rem' }}>
                  Reglas de Automatización Total
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#8b949e', margin: 0 }}>
                  Personaliza qué operaciones tiene permitido realizar el agente de forma automática.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <SettingRow
                  label="Auto-organizar documentos de WhatsApp / Kommo"
                  description="Descarga el archivo, analiza con IA Visión, renombra a TIPO - NOMBRE y autocompleta la ficha."
                  checked={settings.autoOrganizeDocs}
                  onChange={v => updateSettings({ autoOrganizeDocs: v })}
                />
                <SettingRow
                  label="Detección y vinculación automática de familiares"
                  description="Si el documento de WhatsApp pertenece a la esposa, esposo o hijo, crea la ficha y le transfiere el archivo."
                  checked={settings.autoDetectFamilies}
                  onChange={v => updateSettings({ autoDetectFamilies: v })}
                />
                <SettingRow
                  label="Auto-extracción de firma digital en pasaportes"
                  description="Al clasificar un pasaporte o carnet, extrae automáticamente la firma en Caneta Azul Bic y la archiva."
                  checked={settings.autoExtractSignatures}
                  onChange={v => updateSettings({ autoExtractSignatures: v })}
                />
                <SettingRow
                  label="Cosecha y validación de CPF y direcciones desde el chat"
                  description="Revisa conversaciones en WhatsApp, valida CPFs con módulo 11 y completa campos vacíos."
                  checked={settings.autoHarvestChats}
                  onChange={v => updateSettings({ autoHarvestChats: v })}
                />
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pausa si la cola está vacía</span>
                  <span style={{ color: '#60a5fa' }}>{settings.cycleIntervalSecs}s</span>
                </label>
                <input
                  type="range"
                  min="3"
                  max="60"
                  step="1"
                  value={settings.cycleIntervalSecs}
                  onChange={e => updateSettings({ cycleIntervalSecs: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#10b981' }}>
                  ⚡ Modo Continuo activo: Mientras haya documentos en la cola, el agente procesa seguido (cada 2 seg). Esta pausa solo aplica cuando no quedan documentos por procesar.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, badge, onClick, highlight }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: highlight ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.03)',
        border: highlight ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '10px',
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {icon}
        <span style={{
          fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px',
          background: highlight ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.06)',
          color: highlight ? '#fbbf24' : '#94a3b8'
        }}>
          {badge}
        </span>
      </div>
      <div style={{
        fontSize: '1.4rem', fontWeight: 700,
        color: highlight ? '#fbbf24' : '#f8fafc',
        marginTop: '2px'
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>
        {label}
      </div>
    </div>
  );
}

function SettingRow({ label, description, checked, onChange }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      padding: '0.75rem', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer'
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: '3px', accentColor: '#3b82f6' }}
      />
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: '#8b949e', marginTop: '2px' }}>{description}</div>
      </div>
    </label>
  );
}
