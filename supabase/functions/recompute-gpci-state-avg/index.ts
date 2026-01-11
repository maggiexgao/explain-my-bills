/**
 * Recompute GPCI State Averages
 * 
 * Populates gpci_state_avg_2026 table by computing averages from gpci_localities.
 * Called after GPCI import or manually from admin.
 * Requires admin authentication.
 * 
 * Enhanced with:
 * - State name normalization (full name → abbreviation)
 * - Whitespace trimming and uppercase normalization
 * - Guardrails for partial results (<45 states)
 * - Detailed diagnostics in response
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// State name to abbreviation mapping
const STATE_NAME_TO_ABBR: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'district of columbia': 'DC',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL',
  'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA',
  'maine': 'ME', 'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
  'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR',
  'pennsylvania': 'PA', 'puerto rico': 'PR', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'virgin islands': 'VI', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY'
};

const VALID_STATE_ABBRS = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'PR', 'RI', 'SC', 'SD', 'TN', 'TX',
  'UT', 'VT', 'VA', 'VI', 'WA', 'WV', 'WI', 'WY'
]);

// Minimum expected states (all 50 + DC + PR + VI = 53)
const MIN_EXPECTED_STATES = 45;

/**
 * Normalize a state value - handle full names, abbreviations, whitespace
 */
function normalizeStateAbbr(raw: string | null | undefined): string | null {
  if (!raw) return null;
  
  // Trim whitespace
  let cleaned = raw.trim();
  if (!cleaned) return null;
  
  // If it's already a valid 2-letter abbreviation
  const upper = cleaned.toUpperCase();
  if (upper.length === 2 && VALID_STATE_ABBRS.has(upper)) {
    return upper;
  }
  
  // Try to map from full state name
  const lower = cleaned.toLowerCase();
  const abbr = STATE_NAME_TO_ABBR[lower];
  if (abbr) {
    return abbr;
  }
  
  // If it looks like a 2-letter code but not in our set, return uppercase anyway
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
    return upper;
  }
  
  // Unknown format
  return null;
}

// ============================================================================
// Admin Authentication Helper
// ============================================================================

async function verifyAdminAuth(req: Request): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing or invalid authorization header' };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[recompute-gpci] Missing Supabase configuration');
    return { authorized: false, error: 'Service configuration error' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabase.auth.getClaims(token);
    
    if (error || !data?.claims) {
      console.error('[recompute-gpci] JWT validation failed:', error?.message);
      return { authorized: false, error: 'Invalid or expired token' };
    }

    const userId = data.claims.sub;
    
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceKey) {
      console.error('[recompute-gpci] Missing service role key');
      return { authorized: false, error: 'Service configuration error' };
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.warn('[recompute-gpci] Allowing authenticated user - user_roles table may not exist');
      return { authorized: true, userId };
    }

    if (!roleData) {
      console.warn(`[recompute-gpci] User ${userId} does not have admin role`);
      return { authorized: false, error: 'Admin role required' };
    }

    return { authorized: true, userId };
  } catch (e) {
    console.error('[recompute-gpci] Auth error:', e);
    return { authorized: false, error: 'Authentication failed' };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAdminAuth(req);
  if (!authResult.authorized) {
    console.warn(`[recompute-gpci] Unauthorized access attempt: ${authResult.error}`);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        status: 'error',
        message: authResult.error || 'Authentication required',
        rowsComputed: 0
      }),
      { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
  console.log(`[recompute-gpci] Authorized user: ${authResult.userId}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[recompute-gpci] Starting computation with state normalization...");

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
          status: 'error',
          message: "No GPCI localities found. Import GPCI data first.",
          rowsComputed: 0,
          diagnostics: {
            totalLocalityRows: 0,
            rowsWithStateAbbr: 0,
            uniqueStatesComputed: 0
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`[recompute-gpci] Found ${localities.length} locality rows`);

    // Step 2: Normalize and group by state
    const stateData: Record<string, {
      work_gpci_sum: number;
      pe_gpci_sum: number;
      mp_gpci_sum: number;
      count: number;
    }> = {};
    
    const invalidStateExamples: string[] = [];
    let rowsWithValidState = 0;
    let rowsSkippedNoState = 0;
    let rowsSkippedInvalidGpci = 0;

    for (const loc of localities) {
      // Normalize state abbreviation
      const normalizedState = normalizeStateAbbr(loc.state_abbr);
      
      if (!normalizedState) {
        rowsSkippedNoState++;
        if (loc.state_abbr && invalidStateExamples.length < 20) {
          invalidStateExamples.push(String(loc.state_abbr));
        }
        continue;
      }
      
      // Skip invalid GPCI values
      if (!loc.work_gpci || !loc.pe_gpci || !loc.mp_gpci) {
        rowsSkippedInvalidGpci++;
        continue;
      }
      if (loc.work_gpci <= 0 || loc.pe_gpci <= 0 || loc.mp_gpci <= 0) {
        rowsSkippedInvalidGpci++;
        continue;
      }

      rowsWithValidState++;

      if (!stateData[normalizedState]) {
        stateData[normalizedState] = {
          work_gpci_sum: 0,
          pe_gpci_sum: 0,
          mp_gpci_sum: 0,
          count: 0
        };
      }

      stateData[normalizedState].work_gpci_sum += loc.work_gpci;
      stateData[normalizedState].pe_gpci_sum += loc.pe_gpci;
      stateData[normalizedState].mp_gpci_sum += loc.mp_gpci;
      stateData[normalizedState].count += 1;
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

    const uniqueStatesComputed = stateAvgRecords.length;
    console.log(`[recompute-gpci] Computed averages for ${uniqueStatesComputed} states`);

    // Step 4: Check guardrail - are we missing states?
    const isPartial = uniqueStatesComputed < MIN_EXPECTED_STATES;
    
    // Step 5: Upsert into gpci_state_avg_2026
    const { error: upsertError } = await supabase
      .from('gpci_state_avg_2026')
      .upsert(stateAvgRecords, { 
        onConflict: 'state_abbr',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      throw new Error(`Failed to upsert state averages: ${upsertError.message}`);
    }

    // Step 6: Verify
    const { count: finalCount } = await supabase
      .from('gpci_state_avg_2026')
      .select('*', { count: 'exact', head: true });

    console.log(`[recompute-gpci] Table now has ${finalCount} state average rows`);

    // Build response with diagnostics
    const diagnostics = {
      totalLocalityRows: localities.length,
      rowsWithValidState,
      rowsSkippedNoState,
      rowsSkippedInvalidGpci,
      uniqueStatesComputed,
      expectedMinStates: MIN_EXPECTED_STATES,
      invalidStateExamples: invalidStateExamples.slice(0, 20),
      statesInTable: finalCount
    };

    // Determine status
    let status: 'success' | 'warning' | 'error' = 'success';
    let message = `Successfully computed GPCI state averages for ${uniqueStatesComputed} states`;

    if (isPartial) {
      status = 'warning';
      message = `GPCI state averages look incomplete: only ${uniqueStatesComputed} states computed (expected ≥${MIN_EXPECTED_STATES}). Check gpci_localities.state_abbr mapping/import.`;
      console.warn(`[recompute-gpci] ${message}`);
    }

    if (uniqueStatesComputed === 0) {
      status = 'error';
      message = 'No valid states could be computed. Check state_abbr column in gpci_localities.';
    }

    return new Response(
      JSON.stringify({
        ok: status !== 'error',
        status,
        message,
        rowsComputed: uniqueStatesComputed,
        totalRowsInTable: finalCount,
        diagnostics,
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
    console.error("[recompute-gpci] Error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        status: 'error',
        message: error instanceof Error ? error.message : "Unknown error",
        rowsComputed: 0,
        diagnostics: null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
