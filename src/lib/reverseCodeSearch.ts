/**
 * Reverse Code Search
 * 
 * Infers likely CPT/HCPCS codes from procedure descriptions using MPFS database.
 * Used as a fallback when no valid code is extracted from the document.
 */

import { supabase } from '@/integrations/supabase/client';
import { isValidReverseSearchQuery, REVERSE_SEARCH_STOPWORDS } from './cptCodeValidator';

export interface InferredCodeCandidate {
  hcpcs: string;
  description: string | null;
  score: number;
  matchReason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ReverseSearchResult {
  sourceText: string;
  candidates: InferredCodeCandidate[];
  primaryCandidate: InferredCodeCandidate | null;
  isValidQuery: boolean;
  queryValidationReason?: string;
  searchMethod: 'ilike' | 'token_match' | 'fallback_cpt_master';
}

// Minimum query length for reverse search
const MIN_QUERY_LENGTH = 8;

// Maximum candidates to return
const MAX_CANDIDATES = 5;

/**
 * Tokenize text for matching
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !REVERSE_SEARCH_STOPWORDS.has(t));
}

/**
 * Calculate a simple match score based on token overlap
 */
function calculateMatchScore(queryTokens: string[], candidateDescription: string): number {
  const candidateTokens = tokenize(candidateDescription);
  if (candidateTokens.length === 0) return 0;
  
  let matchCount = 0;
  for (const qt of queryTokens) {
    for (const ct of candidateTokens) {
      // Exact match or prefix match
      if (ct === qt || ct.startsWith(qt) || qt.startsWith(ct)) {
        matchCount++;
        break;
      }
    }
  }
  
  // Score = matches / max(queryTokens, candidateTokens)
  return matchCount / Math.max(queryTokens.length, candidateTokens.length);
}

/**
 * Determine confidence level based on score and uniqueness
 */
function determineConfidence(score: number, candidateCount: number): 'high' | 'medium' | 'low' {
  // High confidence: score >= 0.6 AND single strong match
  if (score >= 0.6 && candidateCount <= 2) return 'high';
  
  // Medium confidence: score >= 0.4 OR decent match with few candidates
  if (score >= 0.4 || (score >= 0.3 && candidateCount <= 3)) return 'medium';
  
  // Low confidence: everything else
  return 'low';
}

/**
 * Search MPFS descriptions for matching codes
 */
async function searchMpfsDescriptions(
  queryTokens: string[],
  limit: number = MAX_CANDIDATES
): Promise<InferredCodeCandidate[]> {
  const candidates: InferredCodeCandidate[] = [];
  
  // Try searching with first 2-3 most specific tokens
  const searchTokens = queryTokens.slice(0, 3);
  
  for (const token of searchTokens) {
    if (token.length < 4) continue; // Skip very short tokens
    
    const { data, error } = await supabase
      .from('mpfs_benchmarks')
      .select('hcpcs, description')
      .ilike('description', `%${token}%`)
      .eq('year', 2026)
      .eq('qp_status', 'nonQP')
      .limit(20);
    
    if (error) {
      console.error('[ReverseSearch] MPFS search error:', error);
      continue;
    }
    
    if (data) {
      for (const row of data) {
        // Check if we already have this code
        if (candidates.some(c => c.hcpcs === row.hcpcs)) continue;
        
        const score = calculateMatchScore(queryTokens, row.description || '');
        if (score >= 0.2) { // Minimum threshold
          candidates.push({
            hcpcs: row.hcpcs,
            description: row.description,
            score,
            matchReason: `Matched on "${token}" in MPFS`,
            confidence: 'low' // Will be recalculated later
          });
        }
      }
    }
  }
  
  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  
  // Recalculate confidence based on final ranking
  const topCandidates = candidates.slice(0, limit);
  for (const candidate of topCandidates) {
    candidate.confidence = determineConfidence(candidate.score, topCandidates.length);
  }
  
  return topCandidates;
}

/**
 * Search OPPS Addendum B for matching codes (hospital outpatient)
 */
async function searchOppsDescriptions(
  queryTokens: string[],
  limit: number = MAX_CANDIDATES
): Promise<InferredCodeCandidate[]> {
  const candidates: InferredCodeCandidate[] = [];
  const searchTokens = queryTokens.slice(0, 3);
  
  for (const token of searchTokens) {
    if (token.length < 4) continue;
    
    // Search short_desc and long_desc
    const { data, error } = await supabase
      .from('opps_addendum_b')
      .select('hcpcs, short_desc, long_desc, payment_rate')
      .or(`short_desc.ilike.%${token}%,long_desc.ilike.%${token}%`)
      .eq('year', 2025)
      .limit(15);
    
    if (error) {
      console.error('[ReverseSearch] OPPS search error:', error);
      continue;
    }
    
    if (data) {
      for (const row of data) {
        if (candidates.some(c => c.hcpcs === row.hcpcs)) continue;
        
        const descText = row.long_desc || row.short_desc || '';
        const score = calculateMatchScore(queryTokens, descText);
        if (score >= 0.2) {
          candidates.push({
            hcpcs: row.hcpcs,
            description: row.short_desc || row.long_desc,
            score,
            matchReason: `Matched on "${token}" in OPPS (outpatient)`,
            confidence: 'low'
          });
        }
      }
    }
  }
  
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit);
}

/**
 * Search DMEPOS fee schedule for matching codes (equipment/supplies)
 */
async function searchDmeposDescriptions(
  queryTokens: string[],
  limit: number = MAX_CANDIDATES
): Promise<InferredCodeCandidate[]> {
  const candidates: InferredCodeCandidate[] = [];
  const searchTokens = queryTokens.slice(0, 3);
  
  for (const token of searchTokens) {
    if (token.length < 4) continue;
    
    const { data, error } = await supabase
      .from('dmepos_fee_schedule')
      .select('hcpcs, short_desc, fee')
      .ilike('short_desc', `%${token}%`)
      .eq('year', 2026)
      .limit(15);
    
    if (error) {
      console.error('[ReverseSearch] DMEPOS search error:', error);
      continue;
    }
    
    if (data) {
      for (const row of data) {
        if (candidates.some(c => c.hcpcs === row.hcpcs)) continue;
        
        const score = calculateMatchScore(queryTokens, row.short_desc || '');
        if (score >= 0.2) {
          candidates.push({
            hcpcs: row.hcpcs,
            description: row.short_desc,
            score,
            matchReason: `Matched on "${token}" in DMEPOS`,
            confidence: 'low'
          });
        }
      }
    }
  }
  
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit);
}

/**
 * Fallback: search the local CPT master list (loaded from memory)
 */
async function searchCptMaster(queryTokens: string[]): Promise<InferredCodeCandidate[]> {
  // Import dynamically to avoid circular dependencies
  const { reverseSearchCptByText } = await import('./cptReverseIndex');
  
  const queryText = queryTokens.join(' ');
  const results = reverseSearchCptByText(queryText, MAX_CANDIDATES);
  
  return results.map(r => ({
    hcpcs: r.cpt,
    description: r.explanation,
    score: r.score,
    matchReason: 'Matched in local CPT master list',
    confidence: r.relevance
  }));
}

/**
 * Perform reverse search to find CPT/HCPCS codes from description text
 * 
 * Searches across MPFS, OPPS, DMEPOS, and local CPT master for best matches.
 * 
 * @param queryText - The procedure description text
 * @param options - Optional config for which datasets to search
 * @returns ReverseSearchResult with candidates and metadata
 */
export async function reverseSearchCodes(
  queryText: string,
  options?: { includeOpps?: boolean; includeDmepos?: boolean }
): Promise<ReverseSearchResult> {
  const { includeOpps = true, includeDmepos = true } = options || {};
  
  // Step 1: Validate the query
  const validation = isValidReverseSearchQuery(queryText, 2);
  
  if (!validation.isValid || queryText.length < MIN_QUERY_LENGTH) {
    return {
      sourceText: queryText,
      candidates: [],
      primaryCandidate: null,
      isValidQuery: false,
      queryValidationReason: validation.reason || `Query too short (min ${MIN_QUERY_LENGTH} chars)`,
      searchMethod: 'ilike'
    };
  }
  
  const queryTokens = validation.meaningfulTokens;
  let allCandidates: InferredCodeCandidate[] = [];
  let searchMethod: 'ilike' | 'token_match' | 'fallback_cpt_master' = 'ilike';
  
  // Step 2: Search all datasets in parallel
  const searchPromises: Promise<InferredCodeCandidate[]>[] = [
    searchMpfsDescriptions(queryTokens)
  ];
  
  if (includeOpps) {
    searchPromises.push(searchOppsDescriptions(queryTokens));
  }
  
  if (includeDmepos) {
    searchPromises.push(searchDmeposDescriptions(queryTokens));
  }
  
  try {
    const results = await Promise.all(searchPromises);
    allCandidates = results.flat();
    
    // De-duplicate by HCPCS, keeping highest score
    const uniqueCandidates = new Map<string, InferredCodeCandidate>();
    for (const c of allCandidates) {
      const existing = uniqueCandidates.get(c.hcpcs);
      if (!existing || c.score > existing.score) {
        uniqueCandidates.set(c.hcpcs, c);
      }
    }
    allCandidates = Array.from(uniqueCandidates.values());
  } catch (error) {
    console.error('[ReverseSearch] Multi-dataset search error:', error);
  }
  
  // Step 3: If no results, try local CPT master list
  if (allCandidates.length === 0) {
    allCandidates = await searchCptMaster(queryTokens);
    searchMethod = 'fallback_cpt_master';
  }
  
  // Step 4: Sort by score and recalculate confidence
  allCandidates.sort((a, b) => b.score - a.score);
  const topCandidates = allCandidates.slice(0, MAX_CANDIDATES);
  
  for (const candidate of topCandidates) {
    candidate.confidence = determineConfidence(candidate.score, topCandidates.length);
  }
  
  // Step 5: Select primary candidate (highest score with reasonable confidence)
  let primaryCandidate: InferredCodeCandidate | null = null;
  
  if (topCandidates.length > 0) {
    // Prefer high/medium confidence, otherwise take best score
    const highConfidence = topCandidates.filter(c => c.confidence === 'high');
    const mediumConfidence = topCandidates.filter(c => c.confidence === 'medium');
    
    if (highConfidence.length > 0) {
      primaryCandidate = highConfidence[0];
    } else if (mediumConfidence.length > 0) {
      primaryCandidate = mediumConfidence[0];
    } else {
      primaryCandidate = topCandidates[0];
    }
  }
  
  return {
    sourceText: queryText,
    candidates: topCandidates,
    primaryCandidate,
    isValidQuery: true,
    searchMethod
  };
}

/**
 * Batch reverse search for multiple descriptions
 */
export async function batchReverseSearch(
  descriptions: string[]
): Promise<ReverseSearchResult[]> {
  const results: ReverseSearchResult[] = [];
  
  for (const desc of descriptions) {
    if (desc && desc.trim().length >= MIN_QUERY_LENGTH) {
      const result = await reverseSearchCodes(desc);
      results.push(result);
    }
  }
  
  return results;
}
