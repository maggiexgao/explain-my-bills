/**
 * External Code Info Service
 * 
 * Client-side helper for looking up HCPCS code descriptions
 * from the lookup-code-info edge function.
 * 
 * Features:
 * - Batch lookup for efficiency
 * - Only fetches HCPCS Level II codes (letter + 4 digits)
 * - Returns cached results when available
 * - Provides clear source attribution
 */

import { supabase } from '@/integrations/supabase/client';

// ============= Types =============

export interface CodeInfoResult {
  code: string;
  description: string | null;
  shortDescription: string | null;
  source: string;
  retrievedAt: string;
  fromCache: boolean;
}

export interface LookupResponse {
  results: CodeInfoResult[];
  notFound: string[];
  stats: {
    requested: number;
    found: number;
    notFound: number;
    fromCache: number;
    fetched: number;
  };
}

export interface UnmatchedCodeInfo {
  code: string;
  description: string | null;
  source: string;
  pricingAvailable: false;
  pricingNote: string;
}

// ============= Constants =============

const MAX_CODES_PER_REQUEST = 25;

// ============= Helper Functions =============

/**
 * Check if a code is HCPCS Level II format (letter + 4 digits)
 */
export function isHcpcsLevelII(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return /^[A-V]\d{4}$/.test(normalized);
}

/**
 * Check if a code is CPT format (5 numeric digits)
 */
export function isCptCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return /^\d{5}$/.test(normalized);
}

// ============= Main Functions =============

/**
 * Lookup code descriptions for a list of codes.
 * Only fetches HCPCS Level II codes from external API.
 * CPT codes are returned with an explanation that external lookup is not available.
 */
export async function lookupCodeInfo(codes: string[]): Promise<LookupResponse> {
  if (!codes || codes.length === 0) {
    return {
      results: [],
      notFound: [],
      stats: { requested: 0, found: 0, notFound: 0, fromCache: 0, fetched: 0 },
    };
  }
  
  // Normalize and dedupe
  const uniqueCodes = [...new Set(codes.map(c => c.trim().toUpperCase()))];
  
  // Split into batches
  const batches: string[][] = [];
  for (let i = 0; i < uniqueCodes.length; i += MAX_CODES_PER_REQUEST) {
    batches.push(uniqueCodes.slice(i, i + MAX_CODES_PER_REQUEST));
  }
  
  // Process batches
  const allResults: CodeInfoResult[] = [];
  const allNotFound: string[] = [];
  let totalFromCache = 0;
  let totalFetched = 0;
  
  for (const batch of batches) {
    try {
      const { data, error } = await supabase.functions.invoke('lookup-code-info', {
        body: { codes: batch },
      });
      
      if (error) {
        console.error('lookup-code-info error:', error);
        // Add all as not found
        allNotFound.push(...batch);
        continue;
      }
      
      const response = data as LookupResponse;
      allResults.push(...response.results);
      allNotFound.push(...response.notFound);
      totalFromCache += response.stats.fromCache;
      totalFetched += response.stats.fetched;
    } catch (err) {
      console.error('lookup-code-info exception:', err);
      allNotFound.push(...batch);
    }
  }
  
  return {
    results: allResults,
    notFound: allNotFound,
    stats: {
      requested: uniqueCodes.length,
      found: allResults.filter(r => r.description !== null).length,
      notFound: allNotFound.length,
      fromCache: totalFromCache,
      fetched: totalFetched,
    },
  };
}

/**
 * Get enhanced info for unmatched codes (codes not found in Medicare datasets).
 * Fetches descriptions for HCPCS Level II codes, provides explanation for CPT codes.
 */
export async function getUnmatchedCodeInfo(
  unmatchedCodes: string[]
): Promise<UnmatchedCodeInfo[]> {
  if (!unmatchedCodes || unmatchedCodes.length === 0) {
    return [];
  }
  
  const results: UnmatchedCodeInfo[] = [];
  
  // Separate by code type
  const hcpcsLevelII = unmatchedCodes.filter(isHcpcsLevelII);
  const cptCodes = unmatchedCodes.filter(isCptCode);
  const otherCodes = unmatchedCodes.filter(c => !isHcpcsLevelII(c) && !isCptCode(c));
  
  // Fetch HCPCS Level II descriptions
  if (hcpcsLevelII.length > 0) {
    const lookupResults = await lookupCodeInfo(hcpcsLevelII);
    
    for (const result of lookupResults.results) {
      results.push({
        code: result.code,
        description: result.description,
        source: result.description ? 'NLM ClinicalTables (CMS HCPCS)' : 'Description not found',
        pricingAvailable: false,
        pricingNote: getPricingNote(result.code),
      });
    }
    
    // Add not found codes
    for (const code of lookupResults.notFound.filter(isHcpcsLevelII)) {
      if (!results.some(r => r.code === code)) {
        results.push({
          code,
          description: null,
          source: 'NLM ClinicalTables (not found)',
          pricingAvailable: false,
          pricingNote: getPricingNote(code),
        });
      }
    }
  }
  
  // Add CPT codes with explanation (no external lookup)
  for (const code of cptCodes) {
    results.push({
      code,
      description: null,
      source: 'CPT descriptions not fetched externally',
      pricingAvailable: false,
      pricingNote: 'Not found in our Medicare datasets. CPT descriptions are not fetched externally.',
    });
  }
  
  // Add other codes
  for (const code of otherCodes) {
    results.push({
      code,
      description: null,
      source: 'Unknown code format',
      pricingAvailable: false,
      pricingNote: 'Code format not recognized. May be a facility-specific or temporary code.',
    });
  }
  
  return results;
}

/**
 * Get pricing note based on code prefix
 */
function getPricingNote(code: string): string {
  const prefix = code.charAt(0).toUpperCase();
  
  switch (prefix) {
    case 'S':
      return 'S-codes are private payer codes, not covered under Medicare. Pricing varies by payer.';
    case 'T':
      return 'T-codes are state Medicaid agency codes, not covered under Medicare.';
    case 'V':
      return 'V-codes are typically vision/hearing services. May be covered under specific Medicare benefits.';
    case 'A':
      return 'A-codes are transportation, supplies, and miscellaneous services. Some may have DMEPOS pricing.';
    case 'E':
      return 'E-codes are Durable Medical Equipment. May be covered under DMEPOS fee schedule.';
    case 'J':
      return 'J-codes are injectable drugs. Pricing is based on Average Sales Price (ASP).';
    case 'K':
      return 'K-codes are temporary DME regional carrier codes.';
    case 'L':
      return 'L-codes are orthotics and prosthetics. May have DMEPOS pricing.';
    case 'G':
      return 'G-codes are temporary procedure codes. May have MPFS or OPPS pricing.';
    case 'Q':
      return 'Q-codes are miscellaneous temporary codes.';
    case 'C':
      return 'C-codes are temporary hospital outpatient codes. May be packaged under OPPS.';
    default:
      return 'Not found in our Medicare datasets. Medicare pricing not available.';
  }
}
