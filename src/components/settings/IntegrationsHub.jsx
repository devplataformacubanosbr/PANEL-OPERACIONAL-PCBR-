import React, { useState } from 'react';
import { ChevronLeft, FileSpreadsheet, MessageCircle, Share2, Mail } from 'lucide-react';
import IntegracionesSettings from './IntegracionesSettings';
import WhatsAppSettings from './WhatsAppSettings';
import KommoSettings from './KommoSettings';
import EmailSettings from './EmailSettings';

const INTEGRATIONS = [
  {
    id: 'tally',
    name: 'Formularios Tally',
    icon: FileSpreadsheet,
    color: '#378ADD',
    blurb: 'Enlaces de formularios externos para mandarle a los clientes.',
    description: 'Guarda los enlaces a tus formularios de Tally (u otro proveedor) para compartirlos con los clientes desde su ficha. El sistema le agrega automáticamente el ID del cliente a cada enlace que copiás.',
    Component: IntegracionesSettings,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: MessageCircle,
    color: '#25D366',
    blurb: 'Conectá tu número de WhatsApp y las reglas del bot.',
    description: 'Conecta el número de WhatsApp de tu equipo (Evolution API, WhatsApp Cloud API oficial de Meta, o un webhook propio) para chatear con tus clientes desde el Panel, y configura las respuestas automáticas del bot fuera de horario.',
    Component: WhatsAppSettings,
  },
  {
    id: 'kommo',
    name: 'Kommo CRM',
    icon: Share2,
    color: '#BA7517',
    blurb: 'Sincronizá contactos y leads con tu cuenta de Kommo.',
    description: 'Sincroniza contactos y leads de tu cuenta de Kommo con los clientes y trámites del Panel: mapeá qué campo de Kommo corresponde a cuál campo local, y recibí las actualizaciones en tiempo real vía webhook.',
    Component: KommoSettings,
  },
  {
    id: 'email',
    name: 'Email (Gmail)',
    icon: Mail,
    color: '#D93025',
    blurb: 'Enviá correos y adjuntos desde tu cuenta de Google Workspace.',
    description: 'Conecta una cuenta de Gmail o Google Workspace para enviar correos transaccionales a tus clientes y a entidades de forma automatizada, pudiendo adjuntar documentos de la ficha del cliente.',
    Component: EmailSettings,
  },
];

export default function IntegrationsHub() {
  const [activeId, setActiveId] = useState(null);
  const active = INTEGRATIONS.find(i => i.id === activeId);

  if (!active) {
    return (
      <div>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>Integraciones</h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Conectá el Panel con las herramientas que ya usás.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {INTEGRATIONS.map(integration => {
            const Icon = integration.icon;
            return (
              <button
                key={integration.id}
                onClick={() => setActiveId(integration.id)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem',
                  background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                  background: `${integration.color}18`, color: integration.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                    {integration.name}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    {integration.blurb}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const Icon = active.icon;
  return (
    <div>
      <button
        onClick={() => setActiveId(null)}
        className="btn btn-ghost"
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0', marginBottom: '1rem', color: 'var(--color-text-secondary)' }}
      >
        <ChevronLeft size={16} /> Integraciones
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: 'var(--radius-md)', flexShrink: 0,
          background: `${active.color}18`, color: active.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} />
        </div>
        <div>
          <h2 style={{ margin: '0 0 0.35rem 0', fontSize: '1.125rem', color: 'var(--color-text-primary)' }}>{active.name}</h2>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-secondary)', maxWidth: '650px', lineHeight: '1.5' }}>
            {active.description}
          </p>
        </div>
      </div>

      <active.Component />
    </div>
  );
}
