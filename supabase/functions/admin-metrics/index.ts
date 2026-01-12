/**
 * Admin Metrics Edge Function
 * 
 * Provides dataset status, counts, and diagnostic info for admin dashboard.
 * Uses service role to bypass RLS, authenticates via JWT + email allowlist.
 * 
 * This prevents "Access Denied" issues caused by RLS on data tables.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Admin email allowlist - fallback when user_roles is empty
const ADMIN_EMAILS_FALLBACK: string[] = [
  // Add fallback admin emails here if needed
];

/**
 * Verify admin authorization
 * 1. Check JWT token validity
 * 2. Check user_roles table for admin role
 * 3. Fallback to email allowlist
 */
async function verifyAdmin(req: Request): Promise<{ authorized: boolean; userId?: string; email?: string; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing authorization header' };
  }
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return { authorized: false, error: 'Service configuration error' };
  }
  
  // Create client with user's auth token to validate it
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  
  try {
    // Validate JWT and get user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      return { authorized: false, error: 'Invalid or expired token' };
    }
    
    const userId = user.id;
    const email = user.email?.toLowerCase();
    
    // Use service role to check user_roles (bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    
    // If role found, user is admin
    if (!roleError && roleData) {
      return { authorized: true, userId, email };
    }
    
    // Fallback: check ADMIN_EMAILS env var
    const adminEmailsEnv = Deno.env.get("ADMIN_EMAILS");
    const adminEmails = adminEmailsEnv 
      ? adminEmailsEnv.split(',').map(e => e.trim().toLowerCase())
      : ADMIN_EMAILS_FALLBACK;
    
    if (email && adminEmails.includes(email)) {
      console.log(`[admin-metrics] Admin authorized via email allowlist: ${email}`);
      return { authorized: true, userId, email };
    }
    
    // If user_roles table is empty or errored, log but still check email
    if (roleError) {
      console.warn('[admin-metrics] Role check error:', roleError.message);
    }
    
    return { authorized: false, userId, email, error: 'Admin role required' };
    
  } catch (e) {
    console.error('[admin-metrics] Auth error:', e);
    return { authorized: false, error: 'Authentication failed' };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Verify admin authorization
  const auth = await verifyAdmin(req);
  
  if (!auth.authorized) {
    return new Response(
      JSON.stringify({ ok: false, error: auth.error }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  // Use service role client for all queries (bypasses RLS)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Gather all dataset metrics in parallel
    const [
      mpfsResult,
      gpciResult,
      gpciStateAvgResult,
      zipResult,
      oppsResult,
      dmeposResult,
      dmepenResult,
      clfsResult,
      gapEventsResult,
      auditRunsResult
    ] = await Promise.all([
      adminClient.from('mpfs_benchmarks').select('id', { count: 'exact', head: true }),
      adminClient.from('gpci_localities').select('id', { count: 'exact', head: true }),
      adminClient.from('gpci_state_avg_2026').select('state_abbr', { count: 'exact', head: true }),
      adminClient.from('zip_to_locality').select('id', { count: 'exact', head: true }),
      adminClient.from('opps_addendum_b').select('id', { count: 'exact', head: true }),
      adminClient.from('dmepos_fee_schedule').select('id', { count: 'exact', head: true }),
      adminClient.from('dmepen_fee_schedule').select('id', { count: 'exact', head: true }),
      adminClient.from('clfs_fee_schedule').select('id', { count: 'exact', head: true }),
      adminClient.from('analysis_gap_events').select('id', { count: 'exact', head: true }),
      adminClient.from('strategy_audit_runs').select('id, created_at, status, summary_pass, summary_warn, summary_fail', { count: 'exact' }).order('created_at', { ascending: false }).limit(5)
    ]);
    
    // Build response with all metrics
    const metrics = {
      datasets: {
        mpfs: { count: mpfsResult.count ?? 0, error: mpfsResult.error?.message },
        gpci_localities: { count: gpciResult.count ?? 0, error: gpciResult.error?.message },
        gpci_state_avg: { count: gpciStateAvgResult.count ?? 0, error: gpciStateAvgResult.error?.message },
        zip_crosswalk: { count: zipResult.count ?? 0, error: zipResult.error?.message },
        opps: { count: oppsResult.count ?? 0, error: oppsResult.error?.message },
        dmepos: { count: dmeposResult.count ?? 0, error: dmeposResult.error?.message },
        dmepen: { count: dmepenResult.count ?? 0, error: dmepenResult.error?.message },
        clfs: { count: clfsResult.count ?? 0, error: clfsResult.error?.message }
      },
      analytics: {
        gap_events: { count: gapEventsResult.count ?? 0, error: gapEventsResult.error?.message },
        audit_runs: {
          count: auditRunsResult.count ?? 0,
          recent: auditRunsResult.data ?? [],
          error: auditRunsResult.error?.message
        }
      },
      thresholds: {
        mpfs: { min: 10000 },
        gpci_localities: { min: 1000 },
        gpci_state_avg: { min: 45 },
        zip_crosswalk: { min: 30000 },
        opps: { min: 8000 },
        dmepos: { min: 10000 },
        dmepen: { min: 100 },
        clfs: { min: 500 }
      },
      authorizedUser: {
        userId: auth.userId,
        email: auth.email
      },
      generatedAt: new Date().toISOString()
    };
    
    return new Response(
      JSON.stringify({ ok: true, metrics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (e) {
    console.error('[admin-metrics] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: 'Failed to gather metrics' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
