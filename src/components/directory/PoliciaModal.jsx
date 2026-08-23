import React, { useState, useEffect } from 'react';
import { Save, Building2, MapPin, Mail, Phone, Clock, AlignLeft } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function PoliciaModal({ isOpen, onClose, policia, ciudades, onSave }) {
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    email: '',
    horario_atencion: '',
    notas: '',
  });
  const [selectedCiudades, setSelectedCiudades] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (policia) {
      setFormData({
        nombre: policia.nombre || '',
        direccion: policia.direccion || '',
        telefono: policia.telefono || '',
        email: policia.email || '',
        horario_atencion: policia.horario_atencion || '',
        notas: policia.notas || '',
      });
      setSelectedCiudades(policia.ciudades?.map(c => c.id) || []);
    } else {
      setFormData({
        nombre: '',
        direccion: '',
        telefono: '',
        email: '',
        horario_atencion: '',
        notas: '',
      });
      setSelectedCiudades([]);
    }
  }, [policia, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCiudadToggle = (ciudadId) => {
    setSelectedCiudades(prev => 
      prev.includes(ciudadId) 
        ? prev.filter(id => id !== ciudadId)
        : [...prev, ciudadId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.nombre) {
      setError('El nombre es obligatorio.');
      return;
    }

    setIsSaving(true);
    try {
      let savedPolicia = null;
      
      // Save Policia
      if (policia?.id) {
        // Update
        const { data, error: updateError } = await supabase
          .from('policias')
          .update(formData)
          .eq('id', policia.id)
          .select()
          .single();
        if (updateError) throw updateError;
        savedPolicia = data;

        // Delete existing relationships
        await supabase.from('policias_ciudades').delete().eq('policia_id', policia.id);
      } else {
        // Insert
        const { data, error: insertError } = await supabase
          .from('policias')
          .insert([formData])
          .select()
          .single();
        if (insertError) throw insertError;
        savedPolicia = data;
      }

      // Save Relationships
      if (selectedCiudades.length > 0 && savedPolicia) {
        const relsToInsert = selectedCiudades.map(ciudad_id => ({
          policia_id: savedPolicia.id,
          ciudad_id: ciudad_id
        }));
        const { error: relError } = await supabase
          .from('policias_ciudades')
          .insert(relsToInsert);
        if (relError) throw relError;
      }

      onSave(); // Refresh data in parent
      onClose();
    } catch (err) {
      console.error(err);
      if (err.code === '42P01') {
         setError('Las tablas no existen en Supabase. No se puede guardar. Asegúrate de ejecutar el script SQL.');
      } else {
         setError(err.message || 'Error al guardar la policía.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={policia ? 'Editar Policía' : 'Añadir Nueva Policía'}
      maxWidth={720}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={isSaving} form="policia-form">
            {isSaving ? 'Guardando...' : (policia ? 'Guardar Cambios' : 'Añadir Policía')}
          </Button>
        </>
      )}
    >
      <form id="policia-form" onSubmit={handleSubmit} className="flex flex-col gap-5 py-4">
        
        {error && (
          <div className="rounded-md bg-danger/10 p-4 border border-danger/20 text-danger text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nombre */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-chrome-text">Nombre de la Comisaría <span className="text-danger">*</span></label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-text-muted" />
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                className="w-full rounded-md border border-chrome-border bg-chrome-bg px-10 py-2 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors"
                placeholder="Ej. Policía Federal de São Paulo"
              />
            </div>
          </div>

          {/* Dirección */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-chrome-text">Dirección</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-3 text-chrome-text-muted" />
              <textarea
                name="direccion"
                value={formData.direccion}
                onChange={handleChange}
                rows={2}
                className="w-full rounded-md border border-chrome-border bg-chrome-bg pl-10 pr-4 py-2 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors resize-none"
                placeholder="Dirección completa"
              />
            </div>
          </div>

          {/* Teléfono */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-chrome-text">Teléfono</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-text-muted" />
              <input
                type="text"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                className="w-full rounded-md border border-chrome-border bg-chrome-bg px-10 py-2 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors"
                placeholder="Ej. +55 11 1234-5678"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-chrome-text">Correo Electrónico</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-text-muted" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-md border border-chrome-border bg-chrome-bg px-10 py-2 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors"
                placeholder="pf@gov.br"
              />
            </div>
          </div>

          {/* Horario */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-chrome-text">Horario de Atención</label>
            <div className="relative">
              <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-text-muted" />
              <input
                type="text"
                name="horario_atencion"
                value={formData.horario_atencion}
                onChange={handleChange}
                className="w-full rounded-md border border-chrome-border bg-chrome-bg px-10 py-2 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors"
                placeholder="Lunes a Viernes de 08:00 a 17:00"
              />
            </div>
          </div>
        </div>

        {/* Ciudades Relacionadas */}
        <div className="space-y-3 pt-4 border-t border-chrome-border">
          <label className="text-sm font-medium text-chrome-text">Ciudades que cubre</label>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
            {ciudades.length === 0 ? (
              <span className="text-sm text-chrome-text-muted">No hay ciudades registradas.</span>
            ) : (
              ciudades.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleCiudadToggle(c.id)}
                  className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                    selectedCiudades.includes(c.id)
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-medium'
                      : 'border-chrome-border bg-chrome-bg-active text-chrome-text-muted hover:border-chrome-border-hover'
                  }`}
                >
                  {c.nombre}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Notas */}
        <div className="space-y-1.5 pt-4 border-t border-chrome-border">
          <label className="text-sm font-medium text-chrome-text">Notas o Requisitos Especiales</label>
          <div className="relative">
            <AlignLeft size={16} className="absolute left-3 top-3 text-chrome-text-muted" />
            <textarea
              name="notas"
              value={formData.notas}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-md border border-chrome-border bg-chrome-bg pl-10 pr-4 py-2 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors resize-none"
              placeholder="Información adicional sobre esta comisaría..."
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
