import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { LoadingSpinner } from '../LoadingSpinner';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ConfigCamposClientesSettings() {
  const [campos, setCampos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const initialForm = {
    nombre_campo: '',
    identificador: '',
    categoria: 'Informaciones Personales',
    tipo: 'text',
    requerido: false
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    loadCampos();
  }, []);

  const loadCampos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('config_campos_clientes')
        .select('*')
        .order('orden', { ascending: true });

      if (error) throw error;
      setCampos(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar campos personalizados');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.identificador || !formData.nombre_campo) {
       toast.error('Nombre e identificador son obligatorios');
       return;
    }

    // Validar formato de identificador
    if (!/^[a-z0-9_]+$/.test(formData.identificador)) {
      toast.error('El identificador solo puede contener minúsculas, números y guiones bajos');
      return;
    }

    setSaving(true);
    try {
      const maxOrden = campos.length > 0 ? Math.max(...campos.map(c => c.orden || 0)) : 0;

      const payload = {
        nombre_campo: formData.nombre_campo,
        identificador: formData.identificador,
        categoria: formData.categoria,
        tipo: formData.tipo,
        requerido: formData.requerido,
        orden: maxOrden + 1
      };

      const { error } = await supabase.from('config_campos_clientes').insert([payload]);

      if (error) {
        if (error.code === '23505') {
          toast.error('Ya existe un campo con este identificador');
        } else {
          throw error;
        }
      } else {
        toast.success('Campo agregado exitosamente');
        setIsAdding(false);
        setFormData(initialForm);
        loadCampos();
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar el campo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar el campo "${nombre}"? Los datos guardados de los clientes en este campo dejarán de verse en la interfaz, pero seguirán en la base de datos.`)) return;

    try {
      const { error } = await supabase.from('config_campos_clientes').delete().eq('id', id);
      if (error) throw error;
      toast.success('Campo eliminado');
      loadCampos();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar');
    }
  };

  const handleIdentificadorChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    setFormData(prev => ({ ...prev, identificador: val }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>Campos Base</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Define campos nuevos que aparecerán en la ficha de tus clientes (Ej: Profesión). No afecta a los 13 campos migratorios ya fijos (RNM, Pasaporte, etc.).
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} /> Nuevo Campo
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddSubmit} style={{ background: 'var(--color-bg-elevated)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Nombre del Campo (Visible)</label>
              <input required type="text" value={formData.nombre_campo} onChange={e => setFormData({...formData, nombre_campo: e.target.value})} className="form-input" placeholder="Ej. Profesión" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Identificador Interno (Clave JSON)</label>
              <input required type="text" value={formData.identificador} onChange={handleIdentificadorChange} className="form-input" placeholder="ej. profesion" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Categoría de Pestaña</label>
              <select value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} className="form-input">
                <option value="Informaciones Personales">Informaciones Personales</option>
                <option value="Documentos de Identidad">Documentos de Identidad</option>
                <option value="Datos Familiares">Datos Familiares</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Tipo de Input</label>
              <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className="form-input">
                <option value="text">Texto</option>
                <option value="date">Fecha</option>
                <option value="number">Número</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={() => setIsAdding(false)} className="btn btn-ghost">Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Campo'}
            </button>
          </div>
        </form>
      )}

      <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {campos.length === 0 ? (
           <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
             No tienes campos personalizados configurados.
           </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Nombre</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Identificador</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Categoría</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Tipo</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {campos.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500 }}>{c.nombre_campo}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontFamily: 'monospace', color: 'var(--color-primary)' }}>{c.identificador}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{c.categoria}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{c.tipo}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button onClick={() => handleDelete(c.id, c.nombre_campo)} className="btn btn-ghost" style={{ padding: '0.25rem', color: 'var(--color-danger)' }} title="Eliminar campo">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
