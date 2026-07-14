-- 1. Añadir columna bot_activo a la tabla clientes
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS bot_activo boolean DEFAULT false;

-- 2. Crear tabla de notificaciones para el equipo
CREATE TABLE IF NOT EXISTS notificaciones_equipo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mensaje text NOT NULL,
  cliente_id bigint REFERENCES clientes(id) ON DELETE CASCADE,
  leida boolean DEFAULT false,
  creado_en timestamp with time zone DEFAULT now()
);

-- 3. Habilitar RLS en notificaciones_equipo (opcional, o deshabilitarlo para MVP)
ALTER TABLE notificaciones_equipo ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas para notificaciones_equipo (acceso libre para autenticados)
DROP POLICY IF EXISTS "Permitir select a todos los autenticados" ON notificaciones_equipo;
CREATE POLICY "Permitir select a todos los autenticados" 
ON notificaciones_equipo FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Permitir insert a todos los autenticados" ON notificaciones_equipo;
CREATE POLICY "Permitir insert a todos los autenticados" 
ON notificaciones_equipo FOR INSERT 
TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir update a todos los autenticados" ON notificaciones_equipo;
CREATE POLICY "Permitir update a todos los autenticados" 
ON notificaciones_equipo FOR UPDATE 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Permitir delete a todos los autenticados" ON notificaciones_equipo;
CREATE POLICY "Permitir delete a todos los autenticados" 
ON notificaciones_equipo FOR DELETE 
TO authenticated 
USING (true);

-- 5. Asegurarnos que supabase realtime pueda enviar cambios de esta tabla
-- Si la base de datos lo requiere:
alter publication supabase_realtime add table notificaciones_equipo;
