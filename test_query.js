import { supabase } from './src/shared/config/supabaseClient.js';

const miId = '11111111-1111-1111-1111-111111111111';
const otroUsuarioId = '22222222-2222-2222-2222-222222222222';

async function test() {
  const query1 = supabase
    .from('chat_privado')
    .select('*')
    .or(`and(emisor_id.eq.${miId},receptor_id.eq.${otroUsuarioId}),and(emisor_id.eq.${otroUsuarioId},receptor_id.eq.${miId})`);
  
  console.log('Query 1 result:');
  console.log((await query1).error || (await query1).data);
  
  const query2 = supabase
    .from('chat_privado')
    .select('*')
    .or(`emisor_id.eq.${miId},emisor_id.eq.${otroUsuarioId}`)
    .or(`receptor_id.eq.${miId},receptor_id.eq.${otroUsuarioId}`);
  
  console.log('Query 2 result:');
  console.log((await query2).error || (await query2).data);
}

test();
