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
  Loader2
} from 'lucide-react';
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
    clearLogs
  } = useAutonomousAgent();

  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor' | 'settings'

  if (!isModalOpen) return null;

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
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem', padding: '1rem 1.75rem',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <StatCard
            icon={<FileText size={18} color="#3b82f6" />}
            value={stats.docsOrganized || 0}
            label="Documentos Organizados"
            badge="IA Visión"
          />
          <StatCard
            icon={<PenTool size={18} color="#0055ff" />}
            value={stats.signaturesExtracted || 0}
            label="Firmas en Caneta Azul"
            badge="Auto-recorte"
          />
          <StatCard
            icon={<Users size={18} color="#10b981" />}
            value={stats.familiesResolved || 0}
            label="Familiares Vinculados"
            badge="Auto-fichas"
          />
          <StatCard
            icon={<MessageSquare size={18} color="#a855f7" />}
            value={stats.chatsHarvested || 0}
            label="Entidades de Chat"
            badge="CPF Mod 11"
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
                  <span>Frecuencia del ciclo autónomo</span>
                  <span style={{ color: '#60a5fa' }}>Cada {settings.cycleIntervalSecs} segundos</span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="120"
                  step="5"
                  value={settings.cycleIntervalSecs}
                  onChange={e => updateSettings({ cycleIntervalSecs: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#6e7681' }}>
                  Recomendado: 35 segundos para respetar los límites de tokens por minuto (TPM) de Groq.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, badge }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.07)',
      borderRadius: '10px',
      padding: '0.85rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {icon}
        <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
          {badge}
        </span>
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
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
