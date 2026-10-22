/**
 * autonomousAgentService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor del Agente Autónomo Operacional (Piloto Automático).
 * 
 * Capacidades 100% automatizadas:
 * 1. Auto-organización y clasificación de documentos entrantes (WhatsApp/Kommo).
 * 2. Detección automática de familiares (creación de fichas y traspaso de archivos).
 * 3. Autocompletado de datos del cliente (CPF mod 11, pasaportes, carnet, fechas).
 * 4. Extracción autónoma de firmas de pasaportes (Caneta Azul Bic transparente).
 * 5. Generación automática de borradores de "PDF Único".
 * 6. Rescate de datos y entidades desde conversaciones de chat.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '../supabaseClient.js';
import { analyzeDocumentImage, detectSignatureBoundingBox } from './aiService.js';
import { getCliente } from './clientesService.js';
import { reassignDocument, uploadDocument, getSignedUrl } from './storageService.js';
import { resolvePersonAndApplyData } from './clientExtractionService.js';
import { convertPdfPageToImageBase64 } from './pdfToImage.js';
import { processSignatureImage, PASSPORT_SIGNATURE_PRESETS } from '../utils/signatureExtractor.js';
import { validateAndFormatCpf, validateAndFormatEmail, parseBrazilianAddress } from '../utils/entityParser.js';

// ── 1. PROCESAR SIGUIENTE DOCUMENTO PENDIENTE DE WHATSAPP / KOMMO ───────────
export async function processNextPendingDocument(options = {}, logCallback = () => {}) {
  try {
    // Buscar el documento pendiente más reciente que aún no haya sido organizado
    const { data: candidates, error: fetchErr } = await supabase
      .from('documentos_pendientes')
      .select('*')
      .not('nombre_archivo', 'like', '% - %')
      .not('nombre_archivo', 'ilike', '%BORROSO%')
      .order('creado_en', { ascending: false })
      .limit(10);

    if (fetchErr) throw fetchErr;
    if (!candidates || candidates.length === 0) {
      return { success: false, message: 'No hay documentos pendientes sin organizar en la cola.' };
    }

    // Filtrar candidatos analizables (ignorar audios)
    const doc = candidates.find(d => {
      const tc = (d.tipo_contenido || '').toLowerCase();
      const n = (d.nombre_archivo || '').toLowerCase();
      if (tc.startsWith('audio/')) return false;
      return tc.startsWith('image/') || tc === 'application/pdf' || n.endsWith('.pdf') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.png') || n.endsWith('.webp');
    });

    if (!doc) {
      return { success: false, message: 'Los documentos en cola no son imágenes o PDFs legibles.' };
    }

    logCallback({
      type: 'info',
      message: `📄 Analizando documento pendiente #${doc.id}: "${doc.nombre_archivo || 'Sin nombre'}"...`,
      clientId: doc.cliente_id
    });

    // Resolver ruta en storage
    let path = doc.url_archivo;
    if (path.startsWith('http')) {
      const parts = path.split('/whatsapp_media/');
      path = parts.length === 2 ? decodeURIComponent(parts[1].split('?')[0]) : null;
    }
    if (!path) {
      throw new Error(`Ruta de archivo inválida para el documento #${doc.id}`);
    }

    const { data: blob, error: dlErr } = await supabase.storage.from('whatsapp_media').download(path);
    if (dlErr || !blob) throw new Error(dlErr?.message || 'Error al descargar archivo');

    const isPdf = doc.tipo_contenido === 'application/pdf' || (doc.nombre_archivo || '').toLowerCase().endsWith('.pdf');
    let fileOrBase64 = blob;
    if (isPdf) {
      const converted = await convertPdfPageToImageBase64(blob, 1, 2.5);
      fileOrBase64 = converted.base64;
    }

    // Analizar con IA de visión (reglas estrictas anti-alucinación)
    const aiData = await analyzeDocumentImage(fileOrBase64);
    if (!aiData) {
      throw new Error('La IA no devolvió datos estructurados para este documento.');
    }

    // CASO A: Imagen borrosa o ilegible
    if (aiData.DOCUMENTO_BORROSO === true || aiData.ILEGIBLE === true) {
      const motivo = aiData.MOTIVO_ILEGIBLE || 'Imagen borrosa o sin nitidez';
      const flaggedName = `⚠️ BORROSO - ${doc.nombre_archivo || 'Documento'}`;
      await supabase.from('documentos_pendientes').update({ nombre_archivo: flaggedName }).eq('id', doc.id);

      logCallback({
        type: 'warning',
        message: `⚠️ Documento #${doc.id} marcado como BORROSO (${motivo}). La IA protegió la ficha y no inventó datos.`,
        clientId: doc.cliente_id
      });
      return { success: true, action: 'flagged_blurry', docId: doc.id, motivo };
    }

    // CASO B: Documento con datos válidos
    const currentCliente = await getCliente(doc.cliente_id);
    if (!currentCliente) {
      throw new Error(`Cliente #${doc.cliente_id} no encontrado en base de datos.`);
    }

    const tipoDoc = aiData.TIPO_DOCUMENTO || 'DOCUMENTO';

    const { moved, targetClient, isNewClient } = await resolvePersonAndApplyData({
      currentCliente,
      extractedData: aiData,
      moveDocument: (targetId, newName) => reassignDocument(doc.id, targetId, newName),
    });

    const finalClientId = targetClient?.id || currentCliente.id;
    const finalName = targetClient?.nombre || currentCliente.nombre || aiData.NOMBRE_COMPLETO || '';

    if (moved) {
      logCallback({
        type: 'success',
        message: `🔀 Documento "${tipoDoc}" pertenecía a un familiar: ${isNewClient ? 'Ficha creada para' : 'Vinculado a'} "${finalName}" con documento reasignado y ficha completada.`,
        clientId: finalClientId
      });
    } else {
      const formattedName = `${tipoDoc.toUpperCase()} - ${finalName.toUpperCase()}`;
      await supabase.from('documentos_pendientes').update({ nombre_archivo: formattedName }).eq('id', doc.id);

      logCallback({
        type: 'success',
        message: `✨ Documento clasificado como "${formattedName}" y ficha de ${finalName} actualizada.`,
        clientId: finalClientId
      });
    }

    // Disparar eventos para refrescar UI en tiempo real
    window.dispatchEvent(new CustomEvent('documentProcessed', { detail: { documentId: doc.id, clientId: finalClientId } }));
    window.dispatchEvent(new CustomEvent('generatePdfUnicoCheck', { detail: { clientId: finalClientId } }));

    // Si el documento clasificado fue un Pasaporte o Carnet, intentar extraer firma de inmediato
    if (options.autoExtractSignatures && (tipoDoc.includes('PASAPORTE') || tipoDoc.includes('CARNET'))) {
      await autoExtractClientSignature(finalClientId, fileOrBase64, finalName, logCallback);
    }

    return {
      success: true,
      action: moved ? 'moved_to_relative' : 'organized_client_doc',
      docId: doc.id,
      tipoDoc,
      targetClient: finalName
    };
  } catch (err) {
    logCallback({
      type: 'error',
      message: `❌ Error organizando documento: ${err.message}`
    });
    return { success: false, error: err.message };
  }
}

// ── 2. AUTO-EXTRAER FIRMA DIGITAL EN CANETA AZUL DESDE PASAPORTE / CARNET ───
export async function autoExtractClientSignature(clientId, imageSource, clientName, logCallback = () => {}) {
  try {
    // 1. Verificar si el cliente ya tiene FIRMA_DIGITAL
    const { data: existingFirma } = await supabase
      .from('documentos_operacionales')
      .select('id')
      .eq('id_cliente', clientId)
      .eq('tipo_documento', 'FIRMA_DIGITAL')
      .maybeSingle();

    if (existingFirma) {
      return { skipped: true, reason: 'El cliente ya cuenta con firma digital registrada.' };
    }

    logCallback({
      type: 'info',
      message: `🖋️ Extrayendo automáticamente firma digital para ${clientName || `Cliente #${clientId}`}...`,
      clientId
    });

    // 2. Cargar imagen en un elemento Image en memoria
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let srcUrl = imageSource;
    if (typeof imageSource !== 'string') {
      srcUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(imageSource);
      });
    }

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = srcUrl;
    });

    // 3. Preset Pasaporte Cubano estándar (x: 8%, y: 64%, w: 38%, h: 18%)
    const preset = PASSPORT_SIGNATURE_PRESETS[0].crop;
    const cropPx = {
      x: (preset.x / 100) * img.width,
      y: (preset.y / 100) * img.height,
      width: (preset.width / 100) * img.width,
      height: (preset.height / 100) * img.height
    };

    // 4. Procesar y convertir a Caneta Azul Bic transparente con autotrim
    const result = processSignatureImage(img, cropPx, {
      threshold: 155,
      invert: false,
      inkColor: '#0033aa', // Caneta Azul Bic
      enhanceThinLines: true,
      autoTrim: true
    });

    if (!result || result.isEmpty) {
      logCallback({
        type: 'warning',
        message: `⚠️ No se detectó suficiente trazo en la zona de firma de ${clientName}. Se requerirá recorte manual.`,
        clientId
      });
      return { success: false, reason: 'Firma vacía o tenue' };
    }

    // 5. Convertir a Blob y guardar en Supabase Storage
    const res = await fetch(result.base64);
    const blob = await res.blob();
    const safeName = (clientName || 'cliente').replace(/\s+/g, '_').toLowerCase();
    const file = new File([blob], `firma_${safeName}.png`, { type: 'image/png' });

    const uploadRes = await uploadDocument(file, clientId, `Firma Digital - ${clientName}`, 'FIRMA_DIGITAL');
    if (uploadRes.error) throw new Error(uploadRes.error);

    // 6. Actualizar campo personalizado en la ficha del cliente
    const { data: cli } = await supabase.from('clientes').select('campos_personalizados').eq('id', clientId).single();
    const curCampos = cli?.campos_personalizados || {};

    await supabase.from('clientes').update({
      campos_personalizados: {
        ...curCampos,
        firma_digital_url: uploadRes.data.url_archivo,
        tiene_firma_digital: true,
        extraido_por_agente: true
      }
    }).eq('id', clientId);

    logCallback({
      type: 'success',
      message: `✅ Firma en Caneta Azul extraída y guardada en bóveda digital para ${clientName}.`,
      clientId
    });

    window.dispatchEvent(new CustomEvent('refreshClientData', { detail: { clientId } }));
    return { success: true, docId: uploadRes.data.id };
  } catch (err) {
    logCallback({
      type: 'error',
      message: `❌ Error al extraer firma de ${clientName}: ${err.message}`,
      clientId
    });
    return { success: false, error: err.message };
  }
}

// ── 3. RESCATAR Y VALIDAR DATOS DESDE CHATS DE WHATSAPP ─────────────────────
export async function harvestNextClientChat(logCallback = () => {}) {
  try {
    // Buscar un cliente con CPF vacío que tenga mensajes de chat
    const { data: clients, error: cErr } = await supabase
      .from('clientes')
      .select('id, nombre, cpf, email')
      .or('cpf.is.null,cpf.eq.""')
      .order('id', { ascending: false })
      .limit(10);

    if (cErr) throw cErr;
    if (!clients || clients.length === 0) return { success: false, message: 'Todos los clientes ya tienen CPF o datos completos.' };

    for (const client of clients) {
      const { data: msgs, error: mErr } = await supabase
        .from('mensajes')
        .select('texto')
        .eq('cliente_id', client.id)
        .limit(30);

      if (mErr || !msgs || msgs.length === 0) continue;

      const fullChat = msgs.map(m => m.texto || '').join('\n');

      // 1. Buscar CPF con validación módulo 11
      const cpfMatches = fullChat.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g) || [];
      let validCpf = null;
      for (const m of cpfMatches) {
        const validated = validateAndFormatCpf(m);
        if (validated) {
          validCpf = validated;
          break;
        }
      }

      // 2. Buscar Email
      const emailMatches = fullChat.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      const validEmail = emailMatches.length > 0 ? validateAndFormatEmail(emailMatches[0]) : null;

      // 3. Buscar Dirección
      const address = parseBrazilianAddress(fullChat);

      const updates = {};
      if (validCpf && (!client.cpf || client.cpf.trim() === '')) updates.cpf = validCpf;
      if (validEmail && (!client.email || client.email.trim() === '')) updates.email = validEmail;
      if (address.cidade) updates.ciudad = address.cidade;
      if (address.estado) updates.estado = address.estado;
      if (address.endereco) updates.direccion = `${address.endereco}, ${address.numero || 'S/N'}${address.cep ? ' - CEP ' + address.cep : ''}`;

      if (Object.keys(updates).length > 0) {
        await supabase.from('clientes').update(updates).eq('id', client.id);

        logCallback({
          type: 'success',
          message: `💬 Chat cosechado para ${client.nombre}: rescatado ${validCpf ? 'CPF ' + validCpf : ''} ${validEmail ? 'Email ' + validEmail : ''}`,
          clientId: client.id
        });

        return { success: true, clientId: client.id, updates };
      }
    }

    return { success: false, message: 'No se encontraron entidades nuevas en los chats analizados.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── 4. EJECUTOR DE UNA RONDA COMPLETA DEL AGENTE (SINGLE CYCLE) ──────────────
export async function runAgentCycle(settings = {}, logCallback = () => {}) {
  const {
    autoOrganizeDocs = true,
    autoExtractSignatures = true,
    autoHarvestChats = true,
  } = settings;

  // 1. Intentar organizar documento pendiente
  if (autoOrganizeDocs) {
    const docRes = await processNextPendingDocument({ autoExtractSignatures }, logCallback);
    if (docRes.success) return { task: 'document_organized', details: docRes };
  }

  // 2. Intentar cosechar datos de chat
  if (autoHarvestChats) {
    const chatRes = await harvestNextClientChat(logCallback);
    if (chatRes.success) return { task: 'chat_harvested', details: chatRes };
  }

  return { task: 'idle', message: 'No hay tareas pendientes en este ciclo.' };
}
