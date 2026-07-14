/**
 * useEvolutionConnection.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica compartida de conexión WhatsApp vía Evolution API (servidor compartido
 * del SaaS): generación de QR y verificación de estado, invocando la edge
 * function `evolution-manager`. Usado por WhatsAppSettings (configuración) y
 * OnboardingWizard (alta inicial de agencia).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { extractFunctionErrorMessage } from '../utils/errorHandler';

export default function useEvolutionConnection() {
  const [qrBase64, setQrBase64] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [waStatus, setWaStatus] = useState('unknown'); // 'connected' | 'connecting' | 'unknown'

  const generateQR = useCallback(async () => {
    setQrLoading(true);
    setQrBase64('');
    try {
      const { data, error } = await supabase.functions.invoke('evolution-manager', {
        body: { action: 'get_qr' }
      });
      if (error) throw new Error(await extractFunctionErrorMessage(error));
      if (data?.error) throw new Error(data.error);

      if (data?.base64) {
        setQrBase64(data.base64);
        setWaStatus('connecting');
      } else if (data?.instanceStatus === 'open') {
        setWaStatus('connected');
      }
      return data;
    } finally {
      setQrLoading(false);
    }
  }, []);

  const checkStatus = useCallback(async () => {
    setQrLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-manager', {
        body: { action: 'status' }
      });
      if (!error && !data?.error) {
        setWaStatus(data?.status === 'open' ? 'connected' : 'connecting');
      }
      return data;
    } finally {
      setQrLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setQrBase64('');
    setWaStatus('unknown');
  }, []);

  const disconnect = useCallback(async () => {
    setQrLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-manager', {
        body: { action: 'logout' }
      });
      if (error) throw new Error(await extractFunctionErrorMessage(error));
      if (data?.error) throw new Error(data.error);
      reset();
      return data;
    } finally {
      setQrLoading(false);
    }
  }, [reset]);

  return { qrBase64, qrLoading, waStatus, setWaStatus, generateQR, checkStatus, reset, disconnect };
}
