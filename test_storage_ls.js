import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kxtshulqjkkgcrxhegiv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4dHNodWxxamtrZ2NyeGhlZ2l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTAwNjAsImV4cCI6MjA5Nzc4NjA2MH0.SYG63cetoknI6lO1X9DHo3afvOlVsSmiLrxBx5yyVlo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Error listing buckets:', error);
  } else {
    console.log('Buckets:', data.map(b => b.name));
  }
}

checkStorage();
