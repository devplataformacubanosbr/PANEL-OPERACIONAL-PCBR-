-- database/standalone/003_email_schema.sql

CREATE TABLE public.integraciones_email (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  proveedor text NOT NULL DEFAULT 'gmail'::text,
  email_remitente text,
  refresh_token text,
  access_token text,
  token_expiry timestamp with time zone,
  activo boolean DEFAULT true,
  creado_en timestamp with time zone DEFAULT now(),
  actualizado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT integraciones_email_pkey PRIMARY KEY (id)
);

CREATE TABLE public.mensajes_email (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id bigint NOT NULL,
  asunto text NOT NULL,
  cuerpo text NOT NULL,
  destinatarios text[] NOT NULL,
  adjuntos jsonb DEFAULT '[]'::jsonb,
  remitente text DEFAULT 'sistema'::text,
  estado text DEFAULT 'enviado'::text,
  operario text,
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT mensajes_email_pkey PRIMARY KEY (id),
  CONSTRAINT mensajes_email_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE
);

-- RLS para integraciones_email
ALTER TABLE public.integraciones_email ENABLE ROW LEVEL SECURITY;
CREATE POLICY integraciones_email_allow_authenticated ON public.integraciones_email
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS para mensajes_email
ALTER TABLE public.mensajes_email ENABLE ROW LEVEL SECURITY;
CREATE POLICY mensajes_email_allow_authenticated ON public.mensajes_email
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
