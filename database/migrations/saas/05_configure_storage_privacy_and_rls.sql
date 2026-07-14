-- 5. Configure Storage Privacy and RLS Policies for documentos_operacionales
-- Corregido: usaba public.get_user_org_id() (nombre de función que
-- nunca existió en producción); el real es public.get_user_org_id(). Ver
-- auditoría 2026-07-11 / 03_create_rls_helpers_and_policies.sql.

-- Make bucket private or create if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos_operacionales', 'documentos_operacionales', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing storage policy if exists
DROP POLICY IF EXISTS "Storage organization isolation" ON storage.objects;

-- Create storage isolation policy
CREATE POLICY "Storage organization isolation" ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'documentos_operacionales'
  AND split_part(name, '/', 1) = public.get_user_org_id()::text
)
WITH CHECK (
  bucket_id = 'documentos_operacionales'
  AND split_part(name, '/', 1) = public.get_user_org_id()::text
);
