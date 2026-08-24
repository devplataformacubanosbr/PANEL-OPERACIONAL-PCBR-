-- Script para crear la tabla de agendamientos pendientes y ajustar confirmados

-- 1. Crear tabla agendamientos_pendientes
create table if not exists agendamientos_pendientes (
  id bigint generated always as identity primary key,
  entrada_id bigint, -- Referencia al Trámite (entrada) en el Panel PCBR
  cliente_id bigint, -- Referencia al Cliente
  requerimento text,
  dataNascimento text,
  uf text,
  ciudad text,
  posto text,
  estado text default 'pendiente', -- 'pendiente', 'procesando', 'error'
  creado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now()
);

-- 2. Habilitar RLS y crear políticas para agendamientos_pendientes
alter table agendamientos_pendientes enable row level security;

create policy "Permitir inserción a todos" on agendamientos_pendientes
  for insert to anon, authenticated
  with check (true);

create policy "Permitir lectura a todos" on agendamientos_pendientes
  for select to anon, authenticated
  using (true);

create policy "Permitir actualización a todos" on agendamientos_pendientes
  for update to anon, authenticated
  using (true);

-- 3. Añadir columna entrada_id a agendamentos_confirmados si no existe
do $$
begin
  if not exists (select 1 from information_schema.columns 
                 where table_name='agendamentos_confirmados' and column_name='entrada_id') then
    alter table agendamentos_confirmados add column entrada_id bigint;
  end if;
end $$;

-- 4. Asegurarse de que el Realtime está habilitado para estas tablas
-- (Esto permite que supabase.channel().on() funcione)
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table agendamientos_pendientes;
alter publication supabase_realtime add table agendamentos_confirmados;
