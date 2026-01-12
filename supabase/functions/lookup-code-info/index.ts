/**
 * Lookup Code Info Edge Function
 * 
 * Fetches HCPCS code descriptions from NLM ClinicalTables API.
 * Caches results in Supabase to avoid repeated external calls.
 * 
 * Only fetches for HCPCS Level II codes (letter + 4 digits like A1234, S9480, V2700).
 * Does NOT fetch for CPT codes (5 digits) - those require AMA license.
 * 
 * Privacy: Only sends code strings, never patient/bill data.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.88.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= Types =============

interface CodeInfoRequest {
  codes: string[];
}

interface CodeInfoResult {
  code: string;
  description: string | null;
  shortDescription: string | null;
  source: string;
  retrievedAt: string;
  fromCache: boolean;
}

interface NlmSearchResponse {
  // NLM returns [count, codes, extra, [descriptions]]
  // e.g., [1, ["A0428"], null, [["Transportation, ALS (Advanced Life Support), ground"]]]
  0: number;
  1: string[];
  2: unknown;
  3: string[][];
}

// ============= Constants =============

const NLM_API_BASE = 'https://clinicaltables.nlm.nih.gov/api/hcpcs/v3/search';
const CACHE_TTL_DAYS = 30;
const MAX_CODES_PER_REQUEST = 25;
const CONCURRENT_REQUESTS = 2;

// ============= Helper Functions =============

/**
 * Check if a code is HCPCS Level II (letter + 4 digits)
 */
function isHcpcsLevelII(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return /^[A-V]\d{4}$/.test(normalized);
}

/**
 * Check if a code is CPT (5 numeric digits)
 */
function isCptCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return /^\d{5}$/.test(normalized);
}

/**
 * Fetch code info from NLM ClinicalTables API
 */
async function fetchFromNlm(code: string): Promise<{ description: string | null; raw: unknown }> {
  try {
    const url = `${NLM_API_BASE}?terms=${encodeURIComponent(code)}&maxList=10`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.warn(`NLM API returned ${response.status} for code ${code}`);
      return { description: null, raw: null };
    }
    
    const data = await response.json();
    
    // Parse the response - NLM returns [count, codes, extra, [descriptions]]
    if (!Array.isArray(data) || data.length < 4) {
      console.warn(`Unexpected NLM response format for code ${code}:`, data);
      return { description: null, raw: data };
    }
    
    const count = data[0] as number;
    const codes = data[1] as string[];
    const descriptions = data[3] as string[][];
    
    if (count === 0 || !codes || codes.length === 0) {
      return { description: null, raw: data };
    }
    
    // Find exact match (case-insensitive)
    const normalizedSearch = code.toUpperCase();
    const exactMatchIndex = codes.findIndex(c => c.toUpperCase() === normalizedSearch);
    
    if (exactMatchIndex !== -1 && descriptions[exactMatchIndex]) {
      // Description is in the first element of the inner array
      const desc = descriptions[exactMatchIndex][0];
      return { description: desc || null, raw: data };
    }
    
    // If no exact match, try first result as fallback
    if (descriptions[0] && descriptions[0][0]) {
      return { description: descriptions[0][0], raw: data };
    }
    
    return { description: null, raw: data };
  } catch (error) {
    console.error(`Error fetching from NLM for code ${code}:`, error);
    return { description: null, raw: null };
  }
}

/**
 * Process codes with concurrency limit
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const p = processor(item).then(result => {
      results.push(result);
    });
    executing.push(p);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let i = executing.length - 1; i >= 0; i--) {
        if ((executing[i] as any).settled) {
          executing.splice(i, 1);
        }
      }
    }
  }
  
  await Promise.all(executing);
  return results;
}

// ============= Main Handler =============

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { codes }: CodeInfoRequest = await req.json();
    
    // Validate input
    if (!codes || !Array.isArray(codes)) {
      return new Response(
        JSON.stringify({ error: 'codes must be an array of strings' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (codes.length > MAX_CODES_PER_REQUEST) {
      return new Response(
        JSON.stringify({ error: `Maximum ${MAX_CODES_PER_REQUEST} codes per request` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Normalize and dedupe codes
    const uniqueCodes = [...new Set(codes.map(c => c.trim().toUpperCase()))];
    
    // Separate codes by type
    const hcpcsLevelII: string[] = [];
    const cptCodes: string[] = [];
    const unknownCodes: string[] = [];
    
    for (const code of uniqueCodes) {
      if (isHcpcsLevelII(code)) {
        hcpcsLevelII.push(code);
      } else if (isCptCode(code)) {
        cptCodes.push(code);
      } else {
        unknownCodes.push(code);
      }
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const results: CodeInfoResult[] = [];
    const notFound: string[] = [];
    
    // Check cache for HCPCS Level II codes
    const cacheThreshold = new Date();
    cacheThreshold.setDate(cacheThreshold.getDate() - CACHE_TTL_DAYS);
    
    const { data: cachedData } = await supabase
      .from('hcpcs_code_info_cache')
      .select('*')
      .in('code', hcpcsLevelII)
      .gte('retrieved_at', cacheThreshold.toISOString());
    
    const cachedCodes = new Set<string>();
    if (cachedData) {
      for (const row of cachedData) {
        cachedCodes.add(row.code);
        results.push({
          code: row.code,
          description: row.description,
          shortDescription: row.short_description,
          source: row.source,
          retrievedAt: row.retrieved_at,
          fromCache: true,
        });
      }
    }
    
    // Fetch uncached HCPCS Level II codes from NLM
    const uncachedHcpcs = hcpcsLevelII.filter(c => !cachedCodes.has(c));
    
    console.log(`Lookup: ${hcpcsLevelII.length} HCPCS Level II, ${uncachedHcpcs.length} need fetch, ${cachedCodes.size} cached`);
    
    // Process uncached codes with concurrency limit
    const fetchPromises = uncachedHcpcs.map(async (code) => {
      const { description, raw } = await fetchFromNlm(code);
      
      // Cache the result (even if null, to avoid repeated lookups)
      const now = new Date().toISOString();
      await supabase
        .from('hcpcs_code_info_cache')
        .upsert({
          code,
          description,
          short_description: description?.substring(0, 60) || null,
          source: 'NLM ClinicalTables (CMS HCPCS)',
          retrieved_at: now,
          raw,
        }, { onConflict: 'code' });
      
      if (description) {
        results.push({
          code,
          description,
          shortDescription: description.substring(0, 60),
          source: 'NLM ClinicalTables (CMS HCPCS)',
          retrievedAt: now,
          fromCache: false,
        });
      } else {
        notFound.push(code);
      }
    });
    
    // Process with concurrency limit
    for (let i = 0; i < fetchPromises.length; i += CONCURRENT_REQUESTS) {
      await Promise.all(fetchPromises.slice(i, i + CONCURRENT_REQUESTS));
    }
    
    // Add CPT codes with explanation (we don't fetch externally)
    for (const code of cptCodes) {
      results.push({
        code,
        description: null,
        shortDescription: null,
        source: 'CPT (not fetched externally)',
        retrievedAt: new Date().toISOString(),
        fromCache: false,
      });
      notFound.push(code);
    }
    
    // Add unknown codes
    for (const code of unknownCodes) {
      notFound.push(code);
    }
    
    return new Response(
      JSON.stringify({
        results,
        notFound,
        stats: {
          requested: uniqueCodes.length,
          found: results.filter(r => r.description !== null).length,
          notFound: notFound.length,
          fromCache: results.filter(r => r.fromCache).length,
          fetched: uncachedHcpcs.length,
        },
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('lookup-code-info error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
