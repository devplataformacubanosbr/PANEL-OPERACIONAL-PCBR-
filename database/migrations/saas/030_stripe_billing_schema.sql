-- 030. Extiende planes/suscripciones (007_subscriptions_schema.sql) para
-- Stripe Checkout + Billing. limites_uso queda fuera de alcance: v1 solo
-- gatea por suscripciones.estado, no por métricas de uso por recurso.
--
-- Igual que el resto del repo (ver auditoría 2026-07-11 y
-- pcbr_multitenant_schema): los archivos bajo database/migrations/saas/ no
-- siempre reflejan lo que quedó realmente aplicado en producción. La tabla
-- planes en vivo resultó no tener descripcion (y potencialmente otras
-- columnas de 007_subscriptions_schema.sql) — por eso este archivo asegura
-- primero las columnas base de planes/suscripciones antes de usarlas. Los
-- ADD COLUMN IF NOT EXISTS son no-op si la columna ya existe, así que esto
-- es seguro de correr contra cualquier estado real de la tabla.

-- === planes: columnas base (por si 007 no quedó aplicado tal cual) ===
ALTER TABLE public.planes
  ADD COLUMN IF NOT EXISTS nombre VARCHAR(255),
  ADD COLUMN IF NOT EXISTS descripcion TEXT,
  ADD COLUMN IF NOT EXISTS precio NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS limite_usuarios INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- === planes: columnas nuevas de Stripe ===
ALTER TABLE public.planes
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
  ADD COLUMN IF NOT EXISTS es_prueba BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS planes_stripe_price_id_key
  ON public.planes (stripe_price_id) WHERE stripe_price_id IS NOT NULL;

-- === suscripciones: columnas base (mismo motivo que planes arriba) ===
ALTER TABLE public.suscripciones
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.planes(id),
  ADD COLUMN IF NOT EXISTS estado VARCHAR(50) NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS fecha_fin TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- === suscripciones: columnas nuevas de Stripe ===
ALTER TABLE public.suscripciones
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.suscripciones ALTER COLUMN estado SET DEFAULT 'trialing';

ALTER TABLE public.suscripciones DROP CONSTRAINT IF EXISTS suscripciones_estado_check;
ALTER TABLE public.suscripciones ADD CONSTRAINT suscripciones_estado_check
  CHECK (estado IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete'));

-- Un único registro "vivo" de suscripción por organización (no historial).
CREATE UNIQUE INDEX IF NOT EXISTS suscripciones_organization_id_key
  ON public.suscripciones (organization_id);

-- El webhook de Stripe resuelve la organización EXCLUSIVAMENTE vía estos dos
-- índices, nunca vía metadata del payload entrante (ver stripe-webhook).
CREATE UNIQUE INDEX IF NOT EXISTS suscripciones_stripe_customer_id_key
  ON public.suscripciones (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS suscripciones_stripe_subscription_id_key
  ON public.suscripciones (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- === Corrección de seguridad ===
-- tenant_isolation_policy (007_subscriptions_schema.sql) era FOR ALL, es
-- decir que cualquier miembro autenticado de un tenant podía hacer
-- UPDATE suscripciones SET estado='active' desde el navegador y
-- autoasignarse un plan pago gratis. El estado de suscripción solo se debe
-- poder escribir desde Edge Functions (service role, que ignora RLS).
DROP POLICY IF EXISTS tenant_isolation_policy ON public.suscripciones;

CREATE POLICY select_own_subscription ON public.suscripciones
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id());

-- === Seed: plan de prueba + planes pagos ===
-- precio y limite_almacenamiento_gb son placeholders, ajustar antes de ir a producción.
-- stripe_price_id se completa a mano (Studio/SQL) tras crear los Products
-- correspondientes en el Dashboard de Stripe (ver Fase 1.0 del plan).
-- limite_almacenamiento_gb: columna NOT NULL preexistente en la tabla planes
-- en vivo, no declarada en ningún migration file del repo (mismo motivo que
-- las columnas base más arriba) — hay que incluirla para que el INSERT no falle.
INSERT INTO public.planes (nombre, descripcion, precio, limite_usuarios, limite_almacenamiento_gb, es_prueba, activo)
SELECT 'Prueba Gratuita', 'Acceso completo por 14 días, sin tarjeta.', 0, 5, 5, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.planes WHERE es_prueba = true);

INSERT INTO public.planes (nombre, descripcion, precio, limite_usuarios, limite_almacenamiento_gb, es_prueba, activo)
SELECT 'Essencial', 'Para agencias pequeñas empezando con WhatsApp.', 97.00, 3, 10, false, true
WHERE NOT EXISTS (SELECT 1 FROM public.planes WHERE nombre = 'Essencial');

INSERT INTO public.planes (nombre, descripcion, precio, limite_usuarios, limite_almacenamiento_gb, es_prueba, activo)
SELECT 'Profissional', 'Para equipos en crecimiento con varios operadores.', 197.00, 10, 50, false, true
WHERE NOT EXISTS (SELECT 1 FROM public.planes WHERE nombre = 'Profissional');

-- === Backfill ===
-- Organizaciones que ya existían antes de este sistema reciben una prueba
-- de cortesía de 30 días para no quedar bloqueadas el día del deploy.
INSERT INTO public.suscripciones (organization_id, plan_id, estado, fecha_inicio, trial_ends_at)
SELECT o.id, (SELECT id FROM public.planes WHERE es_prueba = true LIMIT 1), 'trialing', now(), now() + interval '30 days'
FROM public.organizaciones o
WHERE o.id <> '00000000-0000-0000-0000-000000000000'
  AND NOT EXISTS (SELECT 1 FROM public.suscripciones s WHERE s.organization_id = o.id);
