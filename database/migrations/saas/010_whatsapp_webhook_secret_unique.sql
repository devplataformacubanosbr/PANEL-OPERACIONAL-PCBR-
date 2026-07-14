-- 010_whatsapp_webhook_secret_unique.sql
-- webhook-whatsapp-in resolves the owning organization by webhook_secret
-- (see evolution-manager, which generates one per instance). A unique
-- partial index keeps that lookup unambiguous and fast.

CREATE UNIQUE INDEX IF NOT EXISTS idx_integraciones_whatsapp_webhook_secret
  ON public.integraciones_whatsapp (webhook_secret)
  WHERE webhook_secret IS NOT NULL;
