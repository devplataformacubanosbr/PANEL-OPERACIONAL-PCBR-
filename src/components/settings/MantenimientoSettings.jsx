import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { mergeContacts } from '../../services/mergeService';
import {
  getDatabaseHealthReport,
  normalizeExistingCpfs,
  normalizeExistingEmails,
  harvestChatEntities,
  normalizeDocumentTypes,
  synchronizeCustomFields
} from '../../services/dataQualityService';
import {
  Search,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Database,
  Sparkles,
  RefreshCw,
  Users,
  FileText,
  MessageSquare,
  Mail,
  MapPin,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MantenimientoSettings() {
  const [activeSubTab, setActiveSubTab] = useState('calidad'); // 'calidad' | 'duplicados'

  // --- Estado de Calidad de Datos ---
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthData, setHealthData] = useState(null);
  const [runningAction, setRunningAction] = useState(null);
  const [actionProgress, setActionProgress] = useState(null);
  const [actionResult, setActionResult] = useState(null);

  // --- Estado de Duplicados ---
  const [loadingDupes, setLoadingDupes] = useState(false);
  const [merging, setMerging] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [skippedGroups, setSkippedGroups] = useState(0);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [mergeResults, setMergeResults] = useState(null);

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const data = await getDatabaseHealthReport();
      setHealthData(data);
    } catch (err) {
      console.error('Error cargando diagnóstico:', err);
      toast.error('Error al cargar reporte de calidad de datos');
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  // --- Acciones de Calidad de Datos ---
  const handleNormalizeFormats = async () => {
    setRunningAction('formatos');
    setActionResult(null);
    const toastId = toast.loading('Normalizando CPFs y correos...');
    try {
      const cpfs = await normalizeExistingCpfs((p) => setActionProgress(`Normalizando CPF ${p.current} de ${p.total}...`));
      const emails = await normalizeExistingEmails();
      await fetchHealth();
      setActionResult({
        title: 'Normalización de Formatos Completada',
        message: `Se revisaron ${cpfs.checked} CPFs (${cpfs.updated} formateados a XXX.XXX.XXX-XX) y se normalizaron ${emails.updated} correos a minúsculas limpias.`
      });
      toast.success('Formatos normalizados con éxito', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Error al normalizar formatos: ' + err.message, { id: toastId });
    } finally {
      setRunningAction(null);
      setActionProgress(null);
    }
  };

  const handleHarvestChat = async () => {
    setRunningAction('chat_harvest');
    setActionResult(null);
    const toastId = toast.loading('Escaneando historial de chats de WhatsApp...');
    try {
      const res = await harvestChatEntities((p) =>
        setActionProgress(`Analizando cliente ${p.current} de ${p.total} (${p.cpfsFound} CPFs, ${p.emailsFound} emails encontrados)...`)
      );
      await fetchHealth();
      setActionResult({
        title: 'Rescate de Datos desde Chats Completado',
        message: `Se rescataron y validaron matemáticamente ${res.cpfsFound} CPFs, ${res.emailsFound} correos y ${res.addressesFound} direcciones desde mensajes de clientes.`
      });
      toast.success('Rescate de chats finalizado', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Error al rescatar datos de chats: ' + err.message, { id: toastId });
    } finally {
      setRunningAction(null);
      setActionProgress(null);
    }
  };

  const handleSyncCustomFields = async () => {
    setRunningAction('sync_custom');
    setActionResult(null);
    const toastId = toast.loading('Sincronizando campos migratorios y direcciones...');
    try {
      const res = await synchronizeCustomFields();
      await fetchHealth();
      setActionResult({
        title: 'Sincronización de Fichas Completada',
        message: `Se sincronizaron datos migratorios y domiciliarios en ${res.updated} clientes.`
      });
      toast.success('Campos sincronizados con éxito', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Error al sincronizar campos: ' + err.message, { id: toastId });
    } finally {
      setRunningAction(null);
      setActionProgress(null);
    }
  };

  const handleNormalizeDocTypes = async () => {
    setRunningAction('docs_norm');
    setActionResult(null);
    const toastId = toast.loading('Estandarizando categorías de documentos...');
    try {
      const res = await normalizeDocumentTypes();
      await fetchHealth();
      setActionResult({
        title: 'Limpieza de Documentos Completada',
        message: `Se actualizaron y corrigieron las categorías de ${res.updated} documentos operacionales.`
      });
      toast.success('Documentos normalizados con éxito', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Error al normalizar documentos: ' + err.message, { id: toastId });
    } finally {
      setRunningAction(null);
      setActionProgress(null);
    }
  };

  // --- Lógica de Duplicados ---
  const findDuplicates = async () => {
    setLoadingDupes(true);
    setMergeResults(null);
    setDuplicates([]);
    setSkippedGroups(0);
    try {
      let allClients = [];
      let from = 0;
      const step = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + step - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allClients = allClients.concat(data);
        if (data.length < step) break;
        from += step;
      }

      const phoneGroups = {};
      allClients.forEach((client) => {
        if (client.telefono) {
          const phone = client.telefono.replace(/\D/g, '');
          if (phone && phone.length > 5) {
            if (!phoneGroups[phone]) phoneGroups[phone] = [];
            phoneGroups[phone].push(client);
          }
        }
      });

      const { data: relationsData, error: relError } = await supabase
        .from('relaciones_clientes')
        .select('cliente_id, cliente_relacionado_id');

      if (relError) throw relError;

      const relatedPairs = new Set();
      if (relationsData) {
        relationsData.forEach((r) => {
          relatedPairs.add(`${r.cliente_id}-${r.cliente_relacionado_id}`);
          relatedPairs.add(`${r.cliente_relacionado_id}-${r.cliente_id}`);
        });
      }

      const safeDupes = [];
      let skipped = 0;

      Object.values(phoneGroups).forEach((group) => {
        if (group.length > 1) {
          let hasInternalRelations = false;
          for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
              if (relatedPairs.has(`${group[i].id}-${group[j].id}`)) {
                hasInternalRelations = true;
                break;
              }
            }
            if (hasInternalRelations) break;
          }

          if (hasInternalRelations) {
            skipped++;
          } else {
            safeDupes.push(group);
          }
        }
      });

      setDuplicates(safeDupes);
      setSkippedGroups(skipped);
    } catch (error) {
      console.error('Error finding duplicates:', error);
      toast.error('Error al buscar duplicados: ' + error.message);
    } finally {
      setLoadingDupes(false);
    }
  };

  const handleMergeAll = async () => {
    if (!window.confirm(`¿Estás seguro de que deseas fusionar ${duplicates.length} grupos de contactos? Esta acción moverá mensajes, trámites y documentos al contacto más antiguo de cada grupo.`)) {
      return;
    }

    setMerging(true);
    setMergeProgress(0);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < duplicates.length; i++) {
      const group = duplicates[i];
      const sorted = [...group].sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
      const target = sorted[0];
      const sources = sorted.slice(1);

      try {
        for (const source of sources) {
          await mergeContacts(target.id, source.id);
        }
        successCount++;
      } catch (err) {
        console.error('Error fusionando grupo:', group, err);
        failedCount++;
      }

      setMergeProgress(Math.round(((i + 1) / duplicates.length) * 100));
    }

    setMerging(false);
    setDuplicates([]);
    setMergeResults({ success: successCount, failed: failedCount });
    fetchHealth();
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Sub-navegación superior */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('calidad')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            background: activeSubTab === 'calidad' ? 'var(--brand-primary-light, rgba(99, 102, 241, 0.15))' : 'transparent',
            color: activeSubTab === 'calidad' ? 'var(--color-primary, #6366f1)' : 'var(--color-text-secondary)',
            fontWeight: activeSubTab === 'calidad' ? 600 : 500,
          }}
        >
          <Database size={16} />
          Calidad y Enriquecimiento de Datos
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('duplicados')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            background: activeSubTab === 'duplicados' ? 'var(--brand-primary-light, rgba(99, 102, 241, 0.15))' : 'transparent',
            color: activeSubTab === 'duplicados' ? 'var(--color-primary, #6366f1)' : 'var(--color-text-secondary)',
            fontWeight: activeSubTab === 'duplicados' ? 600 : 500,
          }}
        >
          <Wand2 size={16} />
          Fusión de Contactos Duplicados
        </button>
      </div>

      {/* ──────────────── TAB 1: CALIDAD Y ENRIQUECIMIENTO ──────────────── */}
      {activeSubTab === 'calidad' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header con botón de recargar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Diagnóstico y Normalización de la Base de Datos
              </h3>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                Audita, corrige formatos, valida matemáticamente los CPFs y rescata datos desde mensajes de WhatsApp.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchHealth}
              disabled={healthLoading || runningAction}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RefreshCw size={14} className={healthLoading ? 'animate-spin' : ''} />
              Actualizar Diagnóstico
            </button>
          </div>

          {/* Cards de Métricas */}
          {healthLoading && !healthData ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
              Calculando diagnóstico de la base de datos...
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  <Users size={14} /> Total Clientes
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.35rem' }}>
                  {healthData?.totalClientes?.toLocaleString() || 0}
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  <CheckCircle2 size={14} color="#10b981" /> CPFs con Formato
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '0.35rem' }}>
                  {healthData?.cpfFormateados?.toLocaleString() || 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  {healthData?.conCpf?.toLocaleString()} con algún CPF
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  <Mail size={14} /> Correos Limpios
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.35rem' }}>
                  {healthData?.conEmail?.toLocaleString() || 0}
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  <MapPin size={14} /> Con Domicilio
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.35rem' }}>
                  {healthData?.conDireccion?.toLocaleString() || 0}
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  <MessageSquare size={14} /> Mensajes Chat
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.35rem' }}>
                  {healthData?.totalMensajes?.toLocaleString() || 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  {healthData?.documentosPendientes?.toLocaleString()} docs WhatsApp
                </div>
              </div>
            </div>
          )}

          {/* Banner de progreso de acción */}
          {runningAction && (
            <div style={{ padding: '1.25rem', background: 'var(--color-bg-surface)', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <Loader2 size={18} className="animate-spin" color="var(--color-primary)" />
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                  Ejecutando proceso...
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                {actionProgress || 'Procesando registros en la base de datos...'}
              </div>
            </div>
          )}

          {/* Resultado de la acción */}
          {actionResult && (
            <div style={{ padding: '1.25rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: 0, color: '#10b981', fontWeight: 600 }}>{actionResult.title}</h4>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                  {actionResult.message}
                </p>
              </div>
            </div>
          )}

          {/* Acciones Disponibles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* Acción 1: Normalizar Formatos */}
            <div style={{ padding: '1.25rem', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: '0.4rem' }}>
                  <Sparkles size={16} color="var(--color-primary)" />
                  Normalizar CPFs y Emails
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  Valida matemáticamente cada CPF con el algoritmo oficial y formatea a <code>XXX.XXX.XXX-XX</code>. Pasa todos los correos a minúsculas limpias.
                </p>
              </div>
              <button
                type="button"
                onClick={handleNormalizeFormats}
                disabled={!!runningAction}
                className="btn btn-primary btn-sm"
                style={{ marginTop: '1rem', width: '100%' }}
              >
                {runningAction === 'formatos' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Ejecutar Normalización
              </button>
            </div>

            {/* Acción 2: Rescatar Datos de Chats */}
            <div style={{ padding: '1.25rem', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: '0.4rem' }}>
                  <MessageSquare size={16} color="#10b981" />
                  Rescatar Datos de Chats
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  Escanea los mensajes de WhatsApp en busca de CPFs válidos, correos, teléfonos y direcciones para rellenar las fichas incompletas sin inventar datos.
                </p>
              </div>
              <button
                type="button"
                onClick={handleHarvestChat}
                disabled={!!runningAction}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '1rem', width: '100%' }}
              >
                {runningAction === 'chat_harvest' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Escanear y Rescatar
              </button>
            </div>

            {/* Acción 3: Sincronizar Fichas */}
            <div style={{ padding: '1.25rem', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: '0.4rem' }}>
                  <Database size={16} color="#f59e0b" />
                  Sincronizar Fichas
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  Armoniza datos entre los campos personalizados (JSONB) y las columnas fijas de clientes (ciudad, estado, dirección completa).
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncCustomFields}
                disabled={!!runningAction}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '1rem', width: '100%' }}
              >
                {runningAction === 'sync_custom' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Sincronizar Campos
              </button>
            </div>

            {/* Acción 4: Limpiar Tipos de Documentos */}
            <div style={{ padding: '1.25rem', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: '0.4rem' }}>
                  <FileText size={16} color="#06b6d4" />
                  Limpiar Documentos
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  Estandariza los tipos de documentos operacionales (convierte nombres de archivos accidentales en CPF, PASAPORTE, RNM o SISCONARE).
                </p>
              </div>
              <button
                type="button"
                onClick={handleNormalizeDocTypes}
                disabled={!!runningAction}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '1rem', width: '100%' }}
              >
                {runningAction === 'docs_norm' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Estandarizar Tipos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TAB 2: FUSIÓN DE DUPLICADOS ──────────────── */}
      {activeSubTab === 'duplicados' && (
        <div style={{ background: 'var(--color-bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Fusión Masiva de Contactos Duplicados</h3>
          <p style={{ margin: '0.5rem 0 1.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Escanea toda la base de datos de clientes buscando números de teléfono duplicados. Identifica y respeta grupos familiares para no fusionar familiares entre sí por error.
          </p>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={findDuplicates}
              disabled={loadingDupes || merging}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {loadingDupes ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Buscar Duplicados
            </button>

            {duplicates.length > 0 && !merging && (
              <button
                className="btn btn-primary"
                onClick={handleMergeAll}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-success)', color: 'white', border: 'none' }}
              >
                <Wand2 size={16} />
                Fusionar {duplicates.length} grupos
              </button>
            )}
          </div>

          {merging && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                <span>Fusionando contactos...</span>
                <span>{mergeProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--color-bg-canvas)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${mergeProgress}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
          )}

          {mergeResults && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0 }} />
              <div>
                <h4 style={{ margin: 0, color: '#10b981', fontWeight: 600 }}>Fusión Completada</h4>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  Se fusionaron con éxito {mergeResults.success} grupos de contactos.
                  {mergeResults.failed > 0 && ` Hubo errores en ${mergeResults.failed} grupos.`}
                </p>
              </div>
            </div>
          )}

          {!loadingDupes && !merging && duplicates.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Grupos encontrados ({duplicates.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {duplicates.map((group, index) => (
                  <div key={index} style={{ padding: '1rem', background: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <AlertTriangle size={16} color="var(--color-warning)" />
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Teléfono: {group[0].telefono}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: 'auto', background: 'var(--color-bg-surface)', padding: '2px 8px', borderRadius: '12px' }}>
                        {group.length} contactos
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                      {group.map((contact) => (
                        <div key={contact.id} style={{ fontSize: '0.75rem', padding: '0.5rem', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '2px' }}>{contact.nombre || 'Sin nombre'}</div>
                          <div style={{ color: 'var(--color-text-muted)' }}>{contact.email || 'Sin email'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loadingDupes && !merging && skippedGroups > 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <AlertTriangle size={20} color="var(--color-warning)" style={{ flexShrink: 0 }} />
              <div>
                <h4 style={{ margin: 0, color: 'var(--color-warning)', fontWeight: 600 }}>Grupos Omitidos</h4>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  Se omitieron {skippedGroups} grupo(s) de contactos porque contienen familiares vinculados entre sí que comparten el mismo teléfono.
                </p>
              </div>
            </div>
          )}

          {!loadingDupes && !merging && duplicates.length === 0 && mergeResults === null && (
            <div style={{ marginTop: '1.5rem', padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              Haz clic en "Buscar Duplicados" para analizar la base de datos.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
