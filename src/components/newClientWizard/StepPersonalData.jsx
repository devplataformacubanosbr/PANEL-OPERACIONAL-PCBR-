import React from "react";
import { UserPlus, Sparkles, UploadCloud, MessageSquare, Loader2 } from "lucide-react";
import FormField from "./FormField";
import Button from "../ui/Button";

export default function StepPersonalData({
  formData,
  updateField,
  visibleError,
  quick = false,
  handleFileUpload,
  handleChatPaste,
  isExtracting,
  uploadedFile,
  fileInputRef
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Autocompletar con IA en Paso 1 */}
      {handleFileUpload && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg border border-dashed border-border bg-bg-elevated">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-brand-primary/10 text-brand-primary">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">Autocompletar con IA</div>
              <div className="text-[0.75rem] text-text-muted">
                {uploadedFile
                  ? `📄 Archivo adjunto: ${uploadedFile.name}`
                  : "Subí foto de documento o pegá texto de chat"}
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="file"
              accept="image/*,application/pdf"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isExtracting}
              onClick={() => fileInputRef?.current?.click()}
              className="flex-1 sm:flex-none flex items-center gap-1 text-xs"
            >
              {isExtracting ? (
                <><Loader2 size={13} className="animate-spin" /> Analizando...</>
              ) : (
                <><UploadCloud size={13} /> {uploadedFile ? 'Cambiar doc' : 'Subir doc'}</>
              )}
            </Button>
            {handleChatPaste && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isExtracting}
                onClick={handleChatPaste}
                className="flex-1 sm:flex-none flex items-center gap-1 text-xs"
              >
                <MessageSquare size={13} /> Pegar chat
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-brand-primary">
        <UserPlus size={18} />
        <h3 className="m-0 [font:var(--font-page-title)]">Datos personales</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Nombres" name="nombres" required value={formData.nombres} onChange={updateField} error={visibleError('nombres')} placeholder="Ej. Juan Carlos" />
        <FormField label="Apellidos" name="apellidos" required value={formData.apellidos} onChange={updateField} error={visibleError('apellidos')} placeholder="Ej. Pérez Gómez" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="CPF" name="cpf" value={formData.cpf} onChange={updateField} error={visibleError('cpf')} placeholder="000.000.000-00" />
        <FormField label="Carnet / Identidad" name="carnet_identidad" value={formData.carnet_identidad} onChange={updateField} error={visibleError('carnet_identidad')} />
        <FormField label="Teléfono" name="telefono" value={formData.telefono} onChange={updateField} error={visibleError('telefono')} placeholder="+55 ..." />
        <FormField label="Email" name="email" type="email" value={formData.email} onChange={updateField} error={visibleError('email')} placeholder="cliente@email.com" />
      </div>

      {!quick && (
        <FormField label="ID Kommo (opcional)" name="id_kommo" value={formData.id_kommo} onChange={updateField} placeholder="Ej. 23314228" />
      )}
      {!quick && (
        <p className="m-0 text-xs text-text-muted">
          Si completás el ID Kommo, los mensajes de este lead se sincronizarán automáticamente.
        </p>
      )}
    </div>
  );
}
