import React, { useState, useEffect } from 'react';
import { Save, Building2, MapPin, Mail, Phone, Clock, AlignLeft, Plus, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const PUNTO_VACIO = { sigla: '', direccion: '', telefono: '', email: '' };

const normalize = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

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
  const [ciudadSearch, setCiudadSearch] = useState('');
  const [puntos, setPuntos] = useState([]);
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
      setPuntos(
        (policia.puntos || []).map(p => ({
          id: p.id,
          sigla: p.sigla || '',
          direccion: p.direccion || '',
          telefono: p.telefono || '',
          email: p.email || '',
        }))
      );
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
      setPuntos([]);
    }
    setCiudadSearch('');
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

  const handlePuntoChange = (index, field, value) => {
    setPuntos(prev => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const handleAddPunto = () => {
    setPuntos(prev => [...prev, { ...PUNTO_VACIO }]);
  };

  const handleRemovePunto = (index) => {
    setPuntos(prev => prev.filter((_, i) => i !== index));
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

        // Delete existing relationships and puntos de atención
        await supabase.from('policias_ciudades').delete().eq('policia_id', policia.id);
        await supabase.from('policia_puntos').delete().eq('policia_id', policia.id);
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

      // Save Puntos de atención adicionales (ignora filas completamente vacías)
      const puntosToInsert = puntos
        .filter(p => p.sigla || p.direccion || p.telefono || p.email)
        .map(p => ({
          policia_id: savedPolicia.id,
          sigla: p.sigla || null,
          direccion: p.direccion || null,
          telefono: p.telefono || null,
          email: p.email || null,
        }));
      if (puntosToInsert.length > 0 && savedPolicia) {
        const { error: puntosError } = await supabase
          .from('policia_puntos')
          .insert(puntosToInsert);
        if (puntosError) throw puntosError;
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

        {/* Puntos de atención adicionales */}
        <div className="space-y-3 pt-4 border-t border-chrome-border">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-chrome-text">Puntos de atención adicionales</label>
              <p className="text-xs text-chrome-text-muted">
                Para trámites que se atienden en otra dirección dentro de la misma ciudad, ej. el posto de pasaportes.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddPunto}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-chrome-border bg-chrome-bg-active text-sm text-chrome-text hover:border-brand-primary/50 transition-colors flex-shrink-0"
            >
              <Plus size={14} />
              Añadir punto
            </button>
          </div>

          {puntos.length > 0 && (
            <div className="flex flex-col gap-3">
              {puntos.map((punto, index) => (
                <div key={punto.id || index} className="rounded-md border border-chrome-border bg-chrome-bg-active p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <input
                      type="text"
                      value={punto.sigla}
                      onChange={(e) => handlePuntoChange(index, 'sigla', e.target.value)}
                      className="w-full rounded-md border border-chrome-border bg-chrome-bg px-3 py-1.5 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors"
                      placeholder="Sigla (ej. NUCART/ATM/PA)"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePunto(index)}
                      className="p-1.5 text-chrome-text-muted hover:text-danger rounded-md hover:bg-chrome-bg flex-shrink-0"
                      title="Quitar punto"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <textarea
                      value={punto.direccion}
                      onChange={(e) => handlePuntoChange(index, 'direccion', e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-chrome-border bg-chrome-bg px-3 py-1.5 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors resize-none md:col-span-2"
                      placeholder="Dirección de este punto"
                    />
                    <input
                      type="text"
                      value={punto.telefono}
                      onChange={(e) => handlePuntoChange(index, 'telefono', e.target.value)}
                      className="w-full rounded-md border border-chrome-border bg-chrome-bg px-3 py-1.5 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors"
                      placeholder="Teléfono"
                    />
                    <input
                      type="email"
                      value={punto.email}
                      onChange={(e) => handlePuntoChange(index, 'email', e.target.value)}
                      className="w-full rounded-md border border-chrome-border bg-chrome-bg px-3 py-1.5 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors"
                      placeholder="Email"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ciudades Relacionadas */}
        <div className="space-y-3 pt-4 border-t border-chrome-border">
          <label className="text-sm font-medium text-chrome-text">Ciudades que cubre</label>

          <div className="flex flex-wrap gap-2">
            {selectedCiudades.length === 0 ? (
              <span className="text-sm text-chrome-text-muted italic">Ninguna ciudad asignada todavía.</span>
            ) : (
              selectedCiudades.map(id => {
                const c = ciudades.find(ciudad => ciudad.id === id);
                if (!c) return null;
                return (
                  <span
                    key={id}
                    className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-md border border-brand-primary bg-brand-primary/10 text-brand-primary text-sm font-medium"
                  >
                    {c.nombre}
                    <button
                      type="button"
                      onClick={() => handleCiudadToggle(id)}
                      className="p-0.5 rounded hover:bg-brand-primary/20"
                      title="Quitar ciudad"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              value={ciudadSearch}
              onChange={(e) => setCiudadSearch(e.target.value)}
              className="w-full rounded-md border border-chrome-border bg-chrome-bg px-3 py-2 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors"
              placeholder="Buscar ciudad para agregar..."
            />
            {ciudadSearch.trim() && (
              <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-chrome-border bg-chrome-bg shadow-lg">
                {(() => {
                  const q = normalize(ciudadSearch);
                  const resultados = ciudades
                    .filter(c => !selectedCiudades.includes(c.id) && normalize(c.nombre).includes(q))
                    .slice(0, 30);
                  if (resultados.length === 0) {
                    return <p className="px-3 py-2 text-sm text-chrome-text-muted">Sin resultados.</p>;
                  }
                  return resultados.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { handleCiudadToggle(c.id); setCiudadSearch(''); }}
                      className="block w-full text-left px-3 py-2 text-sm text-chrome-text hover:bg-chrome-bg-active"
                    >
                      {c.nombre}{c.estado ? ` — ${c.estado}` : ''}
                    </button>
                  ));
                })()}
              </div>
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
