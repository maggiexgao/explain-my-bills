/**
 * Record Analysis Gaps Edge Function
 * 
 * Records telemetry about analysis runs for admin gap diagnostics.
 * Called after document analysis to track:
 * - Missing codes (codes extracted but not priced)
 * - Totals extraction failures
 * - Geo fallback usage
 * 
 * No PHI is stored - only codes, counts, and aggregates.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GapEventPayload {
  billHash?: string; // Hash only, no PHI
  geoConfidence?: 'high' | 'medium' | 'low';
  zipPresent?: boolean;
  usedStateFallback?: boolean;
  totalsDetectedType?: 'totalCharges' | 'patientBalance' | 'amountDue' | 'none';
  totalsConfidence?: 'high' | 'medium' | 'low';
  pricedItemCount?: number;
  extractedCodeCount?: number;
  missingCodeCount?: number;
  missingCodes?: Array<{
    code: string;
    codeSystemGuess?: string;
    contextType?: 'professional' | 'facility' | 'unknown';
  }>;
  totalsFailureReason?: string;
  docType?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json() as GapEventPayload;
    
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[record-analysis-gaps] Configuration error: Database credentials missing");
      return new Response(
        JSON.stringify({ ok: false, error: "Service temporarily unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // 1. Record the gap event
    const { error: eventError } = await supabase
      .from('analysis_gap_events')
      .insert({
        bill_hash: payload.billHash,
        geo_confidence: payload.geoConfidence,
        zip_present: payload.zipPresent ?? false,
        used_state_fallback: payload.usedStateFallback ?? false,
        totals_detected_type: payload.totalsDetectedType,
        totals_confidence: payload.totalsConfidence,
        priced_item_count: payload.pricedItemCount ?? 0,
        extracted_code_count: payload.extractedCodeCount ?? 0,
        missing_code_count: payload.missingCodeCount ?? 0
      });
    
    if (eventError) {
      console.error('Error recording gap event:', eventError);
    }
    
    // 2. Upsert missing codes (increment counts)
    if (payload.missingCodes && payload.missingCodes.length > 0) {
      for (const mc of payload.missingCodes) {
        const contextType = mc.contextType || 'unknown';
        
        // Try to upsert - increment count if exists
        const { data: existing } = await supabase
          .from('analysis_missing_codes')
          .select('count')
          .eq('code', mc.code.toUpperCase())
          .eq('context_type', contextType)
          .maybeSingle();
        
        if (existing) {
          await supabase
            .from('analysis_missing_codes')
            .update({
              count: (existing.count || 0) + 1,
              last_seen_at: new Date().toISOString()
            })
            .eq('code', mc.code.toUpperCase())
            .eq('context_type', contextType);
        } else {
          await supabase
            .from('analysis_missing_codes')
            .insert({
              code: mc.code.toUpperCase(),
              code_system_guess: mc.codeSystemGuess || 'unknown',
              context_type: contextType,
              count: 1
            });
        }
      }
    }
    
    // 3. Record totals failure if applicable
    if (payload.totalsFailureReason && payload.docType) {
      const { data: existingFailure } = await supabase
        .from('analysis_totals_failures')
        .select('count')
        .eq('doc_type', payload.docType)
        .eq('failure_reason', payload.totalsFailureReason)
        .maybeSingle();
      
      if (existingFailure) {
        await supabase
          .from('analysis_totals_failures')
          .update({
            count: (existingFailure.count || 0) + 1,
            last_seen_at: new Date().toISOString()
          })
          .eq('doc_type', payload.docType)
          .eq('failure_reason', payload.totalsFailureReason);
      } else {
        await supabase
          .from('analysis_totals_failures')
          .insert({
            doc_type: payload.docType,
            failure_reason: payload.totalsFailureReason,
            count: 1
          });
      }
    }
    
    return new Response(
      JSON.stringify({ ok: true }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
    
  } catch (error) {
    console.error('record-analysis-gaps error:', error);
    
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
