import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://rcqkmaxkuxllcyjzqbvn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcWttYXhrdXhsbGN5anpxYnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MzU3NzQsImV4cCI6MjA5NjIxMTc3NH0.3JlpvnK5OqjMWGAP3jl97VXknCi98Bks70owBe1jOz8');

async function checkData() {
  const { data: orgs, error: _orgErr } = await supabase.from('organizaciones').select('*');
  console.log("Organizaciones:");
  console.log(orgs);

  const { data: users, error: _userErr } = await supabase.from('usuarios').select('*');
  console.log("\nUsers:");
  console.log(users);
  
  const { data: clientes, error: _cliErr } = await supabase.from('clientes').select('id, nombre, organization_id');
  console.log("\nClientes:");
  console.log(clientes);
  
  const { data: pipelines, error: _pipeErr } = await supabase.from('pipelines').select('id, nombre, organization_id');
  console.log("\nPipelines:");
  console.log(pipelines);
}

checkData();
