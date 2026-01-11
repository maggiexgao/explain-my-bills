/**
 * Recompute GPCI State Averages
 * 
 * Populates gpci_state_avg_2026 table by computing averages from gpci_localities.
 * Called after GPCI import or manually from admin.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[recompute-gpci-state-avg] Starting computation...");

    // Step 1: Fetch all localities
    const { data: localities, error: fetchError } = await supabase
      .from('gpci_localities')
      .select('state_abbr, work_gpci, pe_gpci, mp_gpci');

    if (fetchError) {
      throw new Error(`Failed to fetch gpci_localities: ${fetchError.message}`);
    }

    if (!localities || localities.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "No GPCI localities found. Import GPCI data first.",
          rowsComputed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`[recompute-gpci-state-avg] Found ${localities.length} localities`);

    // Step 2: Group by state and compute averages
    const stateData: Record<string, {
      work_gpci_sum: number;
      pe_gpci_sum: number;
      mp_gpci_sum: number;
      count: number;
    }> = {};

    for (const loc of localities) {
      if (!loc.state_abbr) continue;
      
      // Skip invalid GPCI values
      if (!loc.work_gpci || !loc.pe_gpci || !loc.mp_gpci) continue;
      if (loc.work_gpci <= 0 || loc.pe_gpci <= 0 || loc.mp_gpci <= 0) continue;

      if (!stateData[loc.state_abbr]) {
        stateData[loc.state_abbr] = {
          work_gpci_sum: 0,
          pe_gpci_sum: 0,
          mp_gpci_sum: 0,
          count: 0
        };
      }

      stateData[loc.state_abbr].work_gpci_sum += loc.work_gpci;
      stateData[loc.state_abbr].pe_gpci_sum += loc.pe_gpci;
      stateData[loc.state_abbr].mp_gpci_sum += loc.mp_gpci;
      stateData[loc.state_abbr].count += 1;
    }

    // Step 3: Create upsert records
    const stateAvgRecords = Object.entries(stateData).map(([state, data]) => ({
      state_abbr: state,
      avg_work_gpci: data.work_gpci_sum / data.count,
      avg_pe_gpci: data.pe_gpci_sum / data.count,
      avg_mp_gpci: data.mp_gpci_sum / data.count,
      n_rows: data.count,
      updated_at: new Date().toISOString()
    }));

    console.log(`[recompute-gpci-state-avg] Computed averages for ${stateAvgRecords.length} states`);

    // Step 4: Upsert into gpci_state_avg_2026
    const { error: upsertError } = await supabase
      .from('gpci_state_avg_2026')
      .upsert(stateAvgRecords, { 
        onConflict: 'state_abbr',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      throw new Error(`Failed to upsert state averages: ${upsertError.message}`);
    }

    // Step 5: Verify
    const { count: finalCount } = await supabase
      .from('gpci_state_avg_2026')
      .select('*', { count: 'exact', head: true });

    console.log(`[recompute-gpci-state-avg] Successfully populated ${finalCount} state average rows`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Successfully computed GPCI state averages for ${stateAvgRecords.length} states`,
        rowsComputed: stateAvgRecords.length,
        totalRowsInTable: finalCount,
        sampleStates: stateAvgRecords.slice(0, 5).map(r => ({
          state: r.state_abbr,
          workGpci: r.avg_work_gpci.toFixed(4),
          peGpci: r.avg_pe_gpci.toFixed(4),
          mpGpci: r.avg_mp_gpci.toFixed(4),
          localities: r.n_rows
        }))
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[recompute-gpci-state-avg] Error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
        rowsComputed: 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
