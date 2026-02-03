
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspect() {
  // We can't directly query schema info via JS client easily without Rpc or specific permissions usually.
  // But we can try to select one row and see the types/structure or error.
  
  console.log("--- SHIFTS ---");
  const { data: shifts, error: shiftsError } = await supabase.from('shifts').select('*').limit(1);
  if (shiftsError) console.error(shiftsError);
  else console.log(shifts[0]);

  console.log("--- ATTENDANCE ---");
  const { data: att, error: attError } = await supabase.from('attendance').select('*').limit(1);
  if (attError) console.error(attError);
  else console.log(att[0]);
}

inspect();
