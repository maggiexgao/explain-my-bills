/**
 * Pre-scan location extraction from uploaded documents
 * 
 * Fast extraction of ZIP/state from bill documents for auto-populating form fields.
 */

import { supabase } from '@/integrations/supabase/client';

export type LocationSource = 'user' | 'detected' | 'none';

export interface PreScanLocationResult {
  zip5?: string;
  stateAbbr?: string;
  confidence: 'high' | 'medium' | 'low';
  evidence?: string;
  stateSource?: 'text_pattern' | 'zip_lookup' | 'direct';
  ran: boolean;
  error?: string;
}

// Valid US state abbreviations
const US_STATE_ABBRS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

// Keywords that boost ZIP confidence
const ADDRESS_KEYWORDS = [
  'address', 'zip', 'billing', 'statement', 'patient', 'provider',
  'hospital', 'clinic', 'medical', 'service', 'po box', 'street', 'ave', 'blvd'
];

// Keywords that reduce ZIP confidence (phone/fax context)
const PHONE_CONTEXT_KEYWORDS = ['phone', 'fax', 'tel', 'call'];

/**
 * Extract ZIP candidates from text
 */
function extractZipCandidates(text: string): { zip: string; context: string; score: number }[] {
  const candidates: { zip: string; context: string; score: number }[] = [];
  
  // Match 5-digit ZIPs, optionally with +4
  const zipRegex = /\b(\d{5})(?:-\d{4})?\b/g;
  let match;
  
  while ((match = zipRegex.exec(text)) !== null) {
    const zip = match[1];
    const startIdx = Math.max(0, match.index - 120);
    const endIdx = Math.min(text.length, match.index + 20);
    const context = text.slice(startIdx, endIdx).toLowerCase();
    
    let score = 0;
    
    // Boost for address-related keywords nearby
    for (const kw of ADDRESS_KEYWORDS) {
      if (context.includes(kw)) {
        score += 3;
        break;
      }
    }
    
    // Boost if state abbreviation nearby
    const statePattern = /\b([A-Z]{2})\s+\d{5}/;
    const nearbyState = text.slice(Math.max(0, match.index - 20), match.index).match(statePattern);
    if (nearbyState && US_STATE_ABBRS.includes(nearbyState[1])) {
      score += 2;
    }
    
    // Reduce score if in phone/fax context
    for (const kw of PHONE_CONTEXT_KEYWORDS) {
      if (context.includes(kw)) {
        score -= 2;
        break;
      }
    }
    
    // Validate ZIP range (basic check - US ZIPs range from 00501 to 99950)
    const zipNum = parseInt(zip, 10);
    if (zipNum >= 501 && zipNum <= 99950) {
      candidates.push({ zip, context, score });
    }
  }
  
  // Sort by score descending
  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Extract state from text patterns like "City, ST 12345"
 */
function extractStateFromTextPattern(text: string): string | null {
  // Pattern: CITY, ST 12345 or CITY ST 12345
  const cityStateZipPattern = /[A-Za-z]+[,\s]+([A-Z]{2})\s+\d{5}/g;
  let match;
  
  while ((match = cityStateZipPattern.exec(text)) !== null) {
    const stateAbbr = match[1].toUpperCase();
    if (US_STATE_ABBRS.includes(stateAbbr)) {
      return stateAbbr;
    }
  }
  
  return null;
}

/**
 * Look up state from ZIP using Supabase table
 */
async function lookupStateFromZip(zip5: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('zip_to_locality')
      .select('state_abbr')
      .eq('zip5', zip5)
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.warn('[preScanLocation] ZIP lookup error:', error);
      return null;
    }
    
    return data?.state_abbr || null;
  } catch (err) {
    console.warn('[preScanLocation] ZIP lookup exception:', err);
    return null;
  }
}

/**
 * Fallback: derive state from ZIP prefix (less accurate but works without DB)
 */
function deriveStateFromZipPrefix(zip5: string): string | null {
  const prefix = parseInt(zip5.substring(0, 3), 10);
  
  // ZIP prefix ranges for states (approximate)
  const prefixRanges: [number, number, string][] = [
    [0, 4, 'PR'], // Puerto Rico
    [5, 5, 'NY'], // NY
    [6, 9, 'PR'], // Puerto Rico/Virgin Islands
    [10, 14, 'MA'],
    [15, 19, 'MA'], // MA overlap
    [20, 20, 'DC'],
    [21, 21, 'MD'],
    [22, 24, 'VA'],
    [25, 26, 'WV'],
    [27, 28, 'NC'],
    [29, 29, 'SC'],
    [30, 31, 'GA'],
    [32, 34, 'FL'],
    [35, 36, 'AL'],
    [37, 38, 'TN'],
    [39, 39, 'MS'],
    [40, 42, 'KY'],
    [43, 45, 'OH'],
    [46, 47, 'IN'],
    [48, 49, 'MI'],
    [50, 52, 'IA'],
    [53, 54, 'WI'],
    [55, 56, 'MN'],
    [57, 57, 'SD'],
    [58, 58, 'ND'],
    [59, 59, 'MT'],
    [60, 62, 'IL'],
    [63, 65, 'MO'],
    [66, 67, 'KS'],
    [68, 69, 'NE'],
    [70, 71, 'LA'],
    [72, 72, 'AR'],
    [73, 74, 'OK'],
    [75, 79, 'TX'],
    [80, 81, 'CO'],
    [82, 83, 'WY'],
    [84, 84, 'UT'],
    [85, 86, 'AZ'],
    [87, 88, 'NM'],
    [89, 89, 'NV'],
    [90, 96, 'CA'],
    [97, 97, 'OR'],
    [98, 99, 'WA'],
  ];
  
  for (const [min, max, state] of prefixRanges) {
    if (prefix >= min && prefix <= max) {
      return state;
    }
  }
  
  return null;
}

/**
 * Main pre-scan function
 * Extracts ZIP and state from text content
 */
export async function preScanLocation(
  text: string
): Promise<PreScanLocationResult> {
  if (!text || text.trim().length < 10) {
    return {
      ran: true,
      confidence: 'low',
      error: 'No text content to scan'
    };
  }

  try {
    // 1. Extract ZIP candidates
    const zipCandidates = extractZipCandidates(text);
    const bestZip = zipCandidates.length > 0 ? zipCandidates[0] : null;
    
    // 2. Try to extract state from text pattern
    let stateAbbr = extractStateFromTextPattern(text);
    let stateSource: 'text_pattern' | 'zip_lookup' | 'direct' | undefined;
    
    if (stateAbbr) {
      stateSource = 'text_pattern';
    }
    
    // 3. If no state from text but we have ZIP, look up state
    if (!stateAbbr && bestZip) {
      stateAbbr = await lookupStateFromZip(bestZip.zip);
      if (stateAbbr) {
        stateSource = 'zip_lookup';
      } else {
        // Fallback to prefix-based derivation
        stateAbbr = deriveStateFromZipPrefix(bestZip.zip) || undefined;
        if (stateAbbr) {
          stateSource = 'zip_lookup'; // Still from ZIP, just different method
        }
      }
    }
    
    // 4. Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    if (bestZip && stateAbbr && stateSource === 'text_pattern') {
      // Both found in text together
      confidence = 'high';
    } else if (bestZip && stateAbbr) {
      // ZIP found, state derived
      confidence = 'medium';
    } else if (bestZip || stateAbbr) {
      confidence = 'low';
    }
    
    // 5. Build evidence snippet
    let evidence: string | undefined;
    if (bestZip) {
      evidence = bestZip.context.substring(0, 80);
    }
    
    return {
      zip5: bestZip?.zip,
      stateAbbr,
      confidence,
      evidence,
      stateSource,
      ran: true
    };
  } catch (err) {
    console.error('[preScanLocation] Error:', err);
    return {
      ran: true,
      confidence: 'low',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

/**
 * Extract text from the document filename for pre-scan
 * (Client-side fallback when OCR isn't available)
 */
export function extractTextFromFilename(filename: string): string {
  // Try to extract any ZIP from filename
  const zipMatch = filename.match(/\b(\d{5})\b/);
  if (zipMatch) {
    return `ZIP: ${zipMatch[1]}`;
  }
  return '';
}
