/**
 * Bill Address Extractor
 * 
 * Lightweight pre-scan to detect ZIP codes and state abbreviations
 * from uploaded medical bills before full analysis.
 */

// All US state abbreviations
export const US_STATE_ABBRS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

// Address-related keywords to prioritize
const ADDRESS_KEYWORDS = [
  'patient', 'member', 'insured', 'billing address', 'payable to',
  'provider', 'facility', 'hospital', 'clinic', 'service location',
  'mailing address', 'address', 'ship to', 'mail to'
];

// Priority order for address types (patient > facility > other)
const ADDRESS_PRIORITY: Record<string, number> = {
  'patient': 10,
  'member': 10,
  'insured': 9,
  'billing address': 7,
  'facility': 5,
  'provider': 5,
  'hospital': 5,
  'clinic': 5,
  'payable to': 3,
  'service location': 3
};

export interface AddressDetectionResult {
  detected_zip: string | null;
  detected_state: string | null;
  confidence_score: number;
  source_snippet: string | null;
  address_type: string | null;
  all_candidates: {
    zip: string;
    state: string | null;
    score: number;
    context: string;
  }[];
}

/**
 * Extract ZIP code and state from raw text extracted from a bill
 */
export function extractAddressFromText(text: string): AddressDetectionResult {
  if (!text || typeof text !== 'string') {
    return {
      detected_zip: null,
      detected_state: null,
      confidence_score: 0,
      source_snippet: null,
      address_type: null,
      all_candidates: []
    };
  }

  const normalizedText = text.toUpperCase();
  const lines = normalizedText.split(/[\n\r]+/);
  
  const candidates: AddressDetectionResult['all_candidates'] = [];
  
  // ZIP regex: 5-digit or 9-digit (ZIP+4)
  const zipRegex = /\b(\d{5})(?:-\d{4})?\b/g;
  
  // State regex: 2-letter state abbreviation with word boundaries
  const stateRegexStr = `\\b(${US_STATE_ABBRS.join('|')})\\b`;
  const stateRegex = new RegExp(stateRegexStr, 'g');
  
  // Process each line looking for address patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Look for ZIP codes in this line and surrounding context
    const contextStart = Math.max(0, i - 2);
    const contextEnd = Math.min(lines.length, i + 3);
    const context = lines.slice(contextStart, contextEnd).join(' ');
    
    const zipMatches = line.match(zipRegex);
    if (!zipMatches) continue;
    
    for (const zipMatch of zipMatches) {
      const zip = zipMatch.substring(0, 5); // Get 5-digit part
      
      // Validate it's a reasonable US ZIP (not starting with 00)
      if (zip.startsWith('00')) continue;
      
      // Look for state in the same line or nearby
      let detectedState: string | null = null;
      const stateMatch = line.match(stateRegex);
      if (stateMatch && stateMatch.length > 0) {
        detectedState = stateMatch[0];
      } else {
        // Check surrounding lines for state
        const surroundingText = context;
        const surroundingStateMatch = surroundingText.match(stateRegex);
        if (surroundingStateMatch && surroundingStateMatch.length > 0) {
          detectedState = surroundingStateMatch[0];
        }
      }
      
      // Calculate score based on address keywords
      let score = 0.5; // Base score for finding a ZIP
      let addressType: string | null = null;
      
      for (const keyword of ADDRESS_KEYWORDS) {
        if (context.toLowerCase().includes(keyword)) {
          const keywordScore = ADDRESS_PRIORITY[keyword] || 1;
          if (keywordScore > score) {
            score = 0.5 + (keywordScore / 20); // Normalize to 0.5-1.0
            addressType = keyword;
          }
        }
      }
      
      // Boost score if we also found a state
      if (detectedState) {
        score = Math.min(1.0, score + 0.2);
      }
      
      // Check if this looks like a valid address format (City, ST ZIP)
      const addressPattern = /[A-Z]+,?\s+[A-Z]{2}\s+\d{5}/;
      if (addressPattern.test(line)) {
        score = Math.min(1.0, score + 0.15);
      }
      
      candidates.push({
        zip,
        state: detectedState,
        score,
        context: line.substring(0, 100) // Truncate for display
      });
    }
  }
  
  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  
  // Return best candidate
  const best = candidates[0];
  
  if (!best) {
    return {
      detected_zip: null,
      detected_state: null,
      confidence_score: 0,
      source_snippet: null,
      address_type: null,
      all_candidates: []
    };
  }
  
  return {
    detected_zip: best.zip,
    detected_state: best.state,
    confidence_score: best.score,
    source_snippet: best.context,
    address_type: Object.entries(ADDRESS_PRIORITY).find(([k]) => 
      best.context.toLowerCase().includes(k)
    )?.[0] || null,
    all_candidates: candidates.slice(0, 5) // Top 5 candidates
  };
}

/**
 * Derive state from ZIP code prefix if not detected directly
 * 
 * ZIP code prefixes generally map to states/regions:
 * https://en.wikipedia.org/wiki/ZIP_Code#Primary_state_prefixes
 */
export function deriveStateFromZip(zip: string): string | null {
  if (!zip || zip.length < 3) return null;
  
  const prefix = parseInt(zip.substring(0, 3), 10);
  
  // ZIP prefix to state mapping (simplified for common prefixes)
  if (prefix >= 100 && prefix <= 149) return 'NY';
  if (prefix >= 150 && prefix <= 196) return 'PA';
  if (prefix >= 197 && prefix <= 199) return 'DE';
  if (prefix >= 200 && prefix <= 205) return 'DC';
  if (prefix >= 206 && prefix <= 219) return 'MD';
  if (prefix >= 220 && prefix <= 246) return 'VA';
  if (prefix >= 247 && prefix <= 268) return 'WV';
  if (prefix >= 270 && prefix <= 289) return 'NC';
  if (prefix >= 290 && prefix <= 299) return 'SC';
  if (prefix >= 300 && prefix <= 319) return 'GA';
  if (prefix >= 320 && prefix <= 339) return 'FL';
  if (prefix >= 350 && prefix <= 369) return 'AL';
  if (prefix >= 370 && prefix <= 385) return 'TN';
  if (prefix >= 386 && prefix <= 397) return 'MS';
  if (prefix >= 400 && prefix <= 418) return 'KY';
  if (prefix >= 430 && prefix <= 458) return 'OH';
  if (prefix >= 460 && prefix <= 479) return 'IN';
  if (prefix >= 480 && prefix <= 499) return 'MI';
  if (prefix >= 500 && prefix <= 528) return 'IA';
  if (prefix >= 530 && prefix <= 549) return 'WI';
  if (prefix >= 550 && prefix <= 567) return 'MN';
  if (prefix >= 570 && prefix <= 577) return 'SD';
  if (prefix >= 580 && prefix <= 588) return 'ND';
  if (prefix >= 590 && prefix <= 599) return 'MT';
  if (prefix >= 600 && prefix <= 629) return 'IL';
  if (prefix >= 630 && prefix <= 658) return 'MO';
  if (prefix >= 660 && prefix <= 679) return 'KS';
  if (prefix >= 680 && prefix <= 693) return 'NE';
  if (prefix >= 700 && prefix <= 714) return 'LA';
  if (prefix >= 716 && prefix <= 729) return 'AR';
  if (prefix >= 730 && prefix <= 749) return 'OK';
  if (prefix >= 750 && prefix <= 799) return 'TX';
  if (prefix >= 800 && prefix <= 816) return 'CO';
  if (prefix >= 820 && prefix <= 831) return 'WY';
  if (prefix >= 832 && prefix <= 838) return 'ID';
  if (prefix >= 840 && prefix <= 847) return 'UT';
  if (prefix >= 850 && prefix <= 865) return 'AZ';
  if (prefix >= 870 && prefix <= 884) return 'NM';
  if (prefix >= 889 && prefix <= 898) return 'NV';
  if (prefix >= 900 && prefix <= 961) return 'CA';
  if (prefix >= 967 && prefix <= 968) return 'HI';
  if (prefix >= 970 && prefix <= 979) return 'OR';
  if (prefix >= 980 && prefix <= 994) return 'WA';
  if (prefix >= 995 && prefix <= 999) return 'AK';
  
  return null;
}

/**
 * Enhanced address extraction that also derives state from ZIP if needed
 */
export function extractAddressWithFallback(text: string): AddressDetectionResult {
  const result = extractAddressFromText(text);
  
  // If we found ZIP but not state, try to derive it
  if (result.detected_zip && !result.detected_state) {
    const derivedState = deriveStateFromZip(result.detected_zip);
    if (derivedState) {
      result.detected_state = derivedState;
      result.confidence_score = Math.max(0.4, result.confidence_score - 0.1); // Slightly lower confidence for derived
    }
  }
  
  return result;
}
