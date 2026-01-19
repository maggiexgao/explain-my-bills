import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ER_OPPS_RATES = [
  { year: 2025, hcpcs: '99281', payment_rate: 88.05, status_indicator: 'J2', apc: '5021', short_desc: 'Emergency dept visit', source_file: 'seed' },
  { year: 2025, hcpcs: '99282', payment_rate: 158.36, status_indicator: 'J2', apc: '5022', short_desc: 'Emergency dept visit', source_file: 'seed' },
  { year: 2025, hcpcs: '99283', payment_rate: 276.89, status_indicator: 'J2', apc: '5023', short_desc: 'Emergency dept visit', source_file: 'seed' },
  { year: 2025, hcpcs: '99284', payment_rate: 425.82, status_indicator: 'J2', apc: '5024', short_desc: 'Emergency dept visit', source_file: 'seed' },
  { year: 2025, hcpcs: '99285', payment_rate: 613.10, status_indicator: 'J2', apc: '5025', short_desc: 'Emergency dept visit', source_file: 'seed' },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("[OPPS Seed] Starting seed check...");

    // Check if 99284 exists with correct rate
    const { data: existing, error: checkError } = await supabase
      .from('opps_addendum_b')
      .select('hcpcs, payment_rate')
      .eq('hcpcs', '99284')
      .eq('year', 2025);

    console.log("[OPPS Seed] Check for 99284:", existing, "Error:", checkError);

    if (existing && existing.length > 0 && existing[0].payment_rate === 425.82) {
      console.log("[OPPS Seed] ER rates already correctly seeded");
      return new Response(
        JSON.stringify({ success: true, message: "ER rates already seeded", existed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert all ER codes
    console.log("[OPPS Seed] Seeding ER OPPS rates...");
    const results = [];

    for (const rate of ER_OPPS_RATES) {
      // Try to delete existing first, then insert fresh
      await supabase
        .from('opps_addendum_b')
        .delete()
        .eq('hcpcs', rate.hcpcs)
        .eq('year', rate.year);

      const { error } = await supabase
        .from('opps_addendum_b')
        .insert(rate);

      if (error) {
        console.error(`[OPPS Seed] Error inserting ${rate.hcpcs}:`, error.message);
        results.push({ code: rate.hcpcs, success: false, error: error.message });
      } else {
        console.log(`[OPPS Seed] Inserted ${rate.hcpcs}: $${rate.payment_rate}`);
        results.push({ code: rate.hcpcs, success: true, rate: rate.payment_rate });
      }
    }

    // Verify
    const { data: verify } = await supabase
      .from('opps_addendum_b')
      .select('hcpcs, payment_rate')
      .in('hcpcs', ['99281', '99282', '99283', '99284', '99285'])
      .eq('year', 2025);

    console.log("[OPPS Seed] Verification:", verify);

    return new Response(
      JSON.stringify({ success: true, results, verification: verify }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[OPPS Seed] Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
