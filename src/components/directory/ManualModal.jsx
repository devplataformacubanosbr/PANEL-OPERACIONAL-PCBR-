import React, { useState, useEffect } from 'react';
import { Save, FileText, Link as LinkIcon, AlignLeft, Bot, Upload, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { chat } from '../../services/aiService';
import { extractPdfText } from '../../services/pdfToImage';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function ManualModal({ isOpen, onClose, manual, onSave }) {
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    contenido: '',
    url_pdf: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    if (manual) {
      setFormData({
        titulo: manual.titulo || '',
        descripcion: manual.descripcion || '',
        contenido: manual.contenido || '',
        url_pdf: manual.url_pdf || '',
      });
    } else {
      setFormData({
        titulo: '',
        descripcion: '',
        contenido: '',
        url_pdf: '',
      });
    }
  }, [manual, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleOrganizeText = async (textToOrganize) => {
    const text = typeof textToOrganize === 'string' ? textToOrganize : formData.contenido;
    if (!text || text.trim().length === 0) return;
    
    setIsGenerating(true);
    setError('');
    try {
      const messages = [
        { role: 'system', content: 'Eres un asistente experto en organizar manuales y procedimientos. Tu objetivo es tomar un texto en bruto y convertirlo en una guía clara, estructurada por pasos y bien formateada usando Markdown. Evita saludos, despedidas o introducciones; devuelve únicamente el contenido organizado.' },
        { role: 'user', content: `Por favor resume y organiza este texto de un documento de trámites en un plan de pasos claros y ordenados:\n\n${text}` }
      ];
      const response = await chat(messages);
      setFormData(prev => ({ ...prev, contenido: response }));
    } catch (err) {
      console.error(err);
      setError('Error al generar resumen con IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset
    setIsGenerating(true);
    setError('');
    try {
      const text = await extractPdfText(file);
      if (!text || text.trim().length === 0) {
        throw new Error('El PDF parece estar vacío o es una imagen escaneada sin texto seleccionable.');
      }
      await handleOrganizeText(text);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al procesar el PDF.');
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.titulo) {
      setError('El título es obligatorio.');
      return;
    }

    setIsSaving(true);
    try {
      if (manual?.id) {
        // Update
        const { error: updateError } = await supabase
          .from('manuales_tramites')
          .update(formData)
          .eq('id', manual.id);
        if (updateError) throw updateError;
      } else {
        // Insert
        const { error: insertError } = await supabase
          .from('manuales_tramites')
          .insert([formData]);
        if (insertError) throw insertError;
      }

      onSave();
      onClose();
    } catch (err) {
      console.error(err);
      if (err.code === '42P01') {
         setError('Las tablas no existen en Supabase. No se puede guardar. Asegúrate de ejecutar el script SQL.');
      } else {
         setError(err.message || 'Error al guardar el manual.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={manual ? 'Editar Manual' : 'Añadir Nuevo Manual'}
      maxWidth={640}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={isSaving} form="manual-form">
            {isSaving ? 'Guardando...' : (manual ? 'Guardar Cambios' : 'Añadir Manual')}
          </Button>
        </>
      )}
    >
      <form id="manual-form" onSubmit={handleSubmit} className="flex flex-col gap-5 py-4">
        
        {error && (
          <div className="rounded-md bg-danger/10 p-4 border border-danger/20 text-danger text-sm">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-chrome-text">Título del Manual <span className="text-danger">*</span></label>
          <div className="relative">
            <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-text-muted" />
            <input
              type="text"
              name="titulo"
              value={formData.titulo}
              onChange={handleChange}
              className="w-full rounded-md border border-chrome-border bg-chrome-bg px-10 py-2 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors"
              placeholder="Ej. Manual de Refugio"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-chrome-text">Breve Descripción</label>
          <div className="relative">
            <AlignLeft size={16} className="absolute left-3 top-3 text-chrome-text-muted" />
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows={2}
              className="w-full rounded-md border border-chrome-border bg-chrome-bg pl-10 pr-4 py-2 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors resize-none"
              placeholder="¿De qué trata este trámite?"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-chrome-text">Contenido (Texto libre / Markdown)</label>
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isGenerating}
                className="text-xs flex items-center gap-1.5 text-brand-primary hover:text-brand-primary/80 transition-colors disabled:opacity-50"
              >
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} 
                Subir PDF y Resumir
              </button>
              <button 
                type="button" 
                onClick={handleOrganizeText} 
                disabled={isGenerating || !formData.contenido.trim()}
                className="text-xs flex items-center gap-1.5 text-brand-primary hover:text-brand-primary/80 transition-colors disabled:opacity-50"
                title="Organizar texto actual con IA"
              >
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />} 
                Mejorar Texto
              </button>
            </div>
          </div>
          <input 
            type="file" 
            accept="application/pdf" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          <textarea
            name="contenido"
            value={formData.contenido}
            onChange={handleChange}
            disabled={isGenerating}
            rows={6}
            className="w-full rounded-md border border-chrome-border bg-chrome-bg p-3 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors resize-y disabled:opacity-75"
            placeholder={isGenerating ? "La IA está analizando y estructurando el contenido..." : "Escribe aquí el contenido detallado del trámite o pega la guía..."}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-chrome-text">Enlace al Documento PDF (Opcional)</label>
          <div className="relative">
            <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-chrome-text-muted" />
            <input
              type="url"
              name="url_pdf"
              value={formData.url_pdf}
              onChange={handleChange}
              className="w-full rounded-md border border-chrome-border bg-chrome-bg px-10 py-2 text-sm text-chrome-text outline-none focus:border-brand-primary transition-colors"
              placeholder="https://..."
            />
          </div>
        </div>

      </form>
    </Modal>
  );
}
