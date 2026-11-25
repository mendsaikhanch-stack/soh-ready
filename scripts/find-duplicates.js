
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findDuplicates(sokhId) {
  const { data: residents, error } = await supabase
    .from('residents')
    .select('id, apartment, building, phone, name, auth_user_id, debt, created_at')
    .eq('sokh_id', sokhId);

  if (error) {
    console.error('Error fetching residents:', error);
    return;
  }

  const groups = {};
  residents.forEach(r => {
    const key = `${r.building || ''}-${r.apartment}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  const duplicates = Object.entries(groups).filter(([key, list]) => list.length > 1);

  console.log(`Found ${duplicates.length} duplicate units for SOKH ${sokhId}`);
  
  for (const [key, list] of duplicates) {
    console.log(`Unit: ${key}`);
    list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); // Latest first
    list.forEach((r, i) => {
      console.log(`  ${i === 0 ? '[KEEP]' : '[TRASH]'} ID: ${r.id}, Name: ${r.name}, Phone: ${r.phone}, Auth: ${r.auth_user_id ? 'YES' : 'NO'}, Debt: ${r.debt}, Created: ${r.created_at}`);
    });
  }
}

const sokhId = 498; // ICTown
findDuplicates(sokhId);
