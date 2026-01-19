import { supabase } from '@/integrations/supabase/client';

const ER_OPPS_RATES = [
  { year: 2025, hcpcs: '99281', payment_rate: 88.05, status_indicator: 'J2', apc: '5021', short_desc: 'Emergency dept visit' },
  { year: 2025, hcpcs: '99282', payment_rate: 158.36, status_indicator: 'J2', apc: '5022', short_desc: 'Emergency dept visit' },
  { year: 2025, hcpcs: '99283', payment_rate: 276.89, status_indicator: 'J2', apc: '5023', short_desc: 'Emergency dept visit' },
  { year: 2025, hcpcs: '99284', payment_rate: 425.82, status_indicator: 'J2', apc: '5024', short_desc: 'Emergency dept visit' },
  { year: 2025, hcpcs: '99285', payment_rate: 613.10, status_indicator: 'J2', apc: '5025', short_desc: 'Emergency dept visit' },
];

export async function seedOppsDataIfNeeded() {
  // Check if ER codes exist
  const { data: existing } = await supabase
    .from('opps_addendum_b')
    .select('hcpcs')
    .in('hcpcs', ['99281', '99282', '99283', '99284', '99285'])
    .limit(1);

  if (!existing || existing.length === 0) {
    console.log('[OPPS Seed] Seeding ER visit OPPS rates...');
    const { error } = await supabase
      .from('opps_addendum_b')
      .upsert(ER_OPPS_RATES.map(r => ({ ...r, source_file: 'auto_seed' })));
    
    if (error) {
      console.error('[OPPS Seed] Error:', error);
    } else {
      console.log('[OPPS Seed] Successfully seeded ER OPPS rates');
    }
  } else {
    console.log('[OPPS Seed] ER OPPS rates already exist');
  }
}
