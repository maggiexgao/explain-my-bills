import { supabase } from '@/integrations/supabase/client';

export async function seedOppsDataIfNeeded() {
  console.log('[OPPS Seed] Starting seed check...');
  
  // First, check if data already exists
  const { data: existing, error: checkError } = await supabase
    .from('opps_addendum_b')
    .select('hcpcs, payment_rate')
    .eq('hcpcs', '99284')
    .eq('year', 2025);

  console.log('[OPPS Seed] Check for 99284:', existing, 'Error:', checkError);

  // If 99284 exists with correct rate, we're good
  if (existing && existing.length > 0 && existing[0].payment_rate === 425.82) {
    console.log('[OPPS Seed] ER rates already correctly seeded');
    return;
  }

  // Call edge function to seed data (has service role permissions)
  console.log('[OPPS Seed] Calling edge function to seed data...');
  
  try {
    const response = await supabase.functions.invoke('seed-opps-data');
    
    if (response.error) {
      console.error('[OPPS Seed] Edge function error:', response.error);
    } else {
      console.log('[OPPS Seed] Edge function result:', response.data);
    }
  } catch (error) {
    console.error('[OPPS Seed] Failed to call edge function:', error);
  }

  // Verify the seed worked
  const { data: verify } = await supabase
    .from('opps_addendum_b')
    .select('hcpcs, payment_rate')
    .in('hcpcs', ['99281', '99282', '99283', '99284', '99285'])
    .eq('year', 2025);
  
  console.log('[OPPS Seed] Verification - ER codes in database:', verify);
}
