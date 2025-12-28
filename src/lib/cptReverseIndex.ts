/**
 * CPT Reverse Index
 * Find CPT codes from procedure/treatment descriptions
 */

import { getAllCptMasterEntries, CptMasterEntry } from './cptMaster';

export interface CptCandidate {
  cpt: string;
  shortLabel: string;
  explanation: string;
  category: string;
  score: number;
  relevance: 'high' | 'medium' | 'low';
}

export interface SuggestedCpt {
  sourceDescription: string;
  candidates: CptCandidate[];
}

// Tokenized index for reverse search
interface TokenIndex {
  // token -> Set of CPT codes
  tokenToCpts: Map<string, Set<string>>;
  // CPT code -> entry
  cptToEntry: Map<string, CptMasterEntry>;
  // CPT code -> all tokens
  cptToTokens: Map<string, Set<string>>;
}

let reverseIndex: TokenIndex | null = null;

// Common medical synonyms for better matching
const SYNONYMS: Record<string, string[]> = {
  'xray': ['x-ray', 'radiograph', 'radiologic', 'radiological', 'plain film'],
  'x-ray': ['xray', 'radiograph', 'radiologic', 'radiological', 'plain film'],
  'ct': ['computed tomography', 'cat scan', 'ct scan'],
  'mri': ['magnetic resonance', 'mr imaging'],
  'ultrasound': ['sonogram', 'sonography', 'us', 'echo'],
  'echocardiogram': ['echo', 'cardiac ultrasound', 'heart ultrasound'],
  'ekg': ['ecg', 'electrocardiogram', 'electrocardiograph'],
  'ecg': ['ekg', 'electrocardiogram', 'electrocardiograph'],
  'blood': ['venous', 'serum', 'plasma', 'hematologic'],
  'urine': ['urinalysis', 'urinary', 'ua'],
  'shot': ['injection', 'immunization', 'vaccine', 'vaccination'],
  'vaccine': ['vaccination', 'immunization', 'shot'],
  'physical': ['pt', 'physiotherapy', 'physical therapy'],
  'therapy': ['treatment', 'therapeutic'],
  'checkup': ['wellness', 'preventive', 'annual', 'exam', 'physical'],
  'colonoscopy': ['colon scope', 'lower gi'],
  'endoscopy': ['scope', 'egd', 'upper gi'],
  'biopsy': ['tissue sample', 'pathology'],
  'complete': ['comprehensive', 'full'],
  'office': ['clinic', 'outpatient'],
  'er': ['emergency', 'ed', 'emergency room', 'emergency department'],
  'emergency': ['er', 'ed', 'urgent'],
  'flu': ['influenza'],
  'influenza': ['flu'],
  'diabetes': ['diabetic', 'a1c', 'glucose', 'blood sugar'],
  'thyroid': ['tsh', 't4', 't3'],
  'cholesterol': ['lipid', 'lipids'],
  'kidney': ['renal'],
  'liver': ['hepatic', 'hepatitis'],
  'heart': ['cardiac', 'cardiovascular'],
  'chest': ['thorax', 'thoracic', 'pulmonary', 'lung'],
  'spine': ['spinal', 'vertebral', 'back'],
  'knee': ['leg', 'lower extremity'],
  'shoulder': ['arm', 'upper extremity'],
  'wrist': ['hand', 'carpal'],
  'ankle': ['foot'],
  'abdomen': ['abdominal', 'belly', 'stomach'],
  'pelvis': ['pelvic', 'hip'],
  'head': ['brain', 'cranial', 'skull'],
  'neck': ['cervical'],
};

/**
 * Tokenize text into normalized tokens
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2);
}

/**
 * Expand tokens with synonyms
 */
function expandWithSynonyms(tokens: string[]): string[] {
  const expanded = new Set<string>(tokens);
  
  for (const token of tokens) {
    const synonyms = SYNONYMS[token];
    if (synonyms) {
      for (const syn of synonyms) {
        // Add individual words from multi-word synonyms
        tokenize(syn).forEach(t => expanded.add(t));
      }
    }
  }
  
  return Array.from(expanded);
}

/**
 * Initialize the reverse index
 */
export function initCptReverseIndex(): void {
  if (reverseIndex) return;
  
  const entries = getAllCptMasterEntries();
  const tokenToCpts = new Map<string, Set<string>>();
  const cptToEntry = new Map<string, CptMasterEntry>();
  const cptToTokens = new Map<string, Set<string>>();
  
  for (const entry of entries) {
    cptToEntry.set(entry.cpt, entry);
    
    // Collect tokens from all relevant fields
    const allText = [
      entry.shortLabel,
      entry.longDescription,
      entry.section,
      entry.category,
    ].join(' ');
    
    const baseTokens = tokenize(allText);
    const expandedTokens = expandWithSynonyms(baseTokens);
    
    cptToTokens.set(entry.cpt, new Set(expandedTokens));
    
    // Index each token
    for (const token of expandedTokens) {
      if (!tokenToCpts.has(token)) {
        tokenToCpts.set(token, new Set());
      }
      tokenToCpts.get(token)!.add(entry.cpt);
    }
  }
  
  reverseIndex = { tokenToCpts, cptToEntry, cptToTokens };
}

/**
 * Search for CPT codes by description text
 */
export function reverseSearchCptByText(
  query: string,
  maxResults: number = 5
): CptCandidate[] {
  initCptReverseIndex();
  
  if (!reverseIndex) return [];
  
  const queryTokens = tokenize(query);
  const expandedQueryTokens = expandWithSynonyms(queryTokens);
  
  if (expandedQueryTokens.length === 0) return [];
  
  // Count matches for each CPT code
  const cptScores = new Map<string, number>();
  
  for (const token of expandedQueryTokens) {
    const matchingCpts = reverseIndex.tokenToCpts.get(token);
    if (matchingCpts) {
      for (const cpt of matchingCpts) {
        cptScores.set(cpt, (cptScores.get(cpt) || 0) + 1);
      }
    }
  }
  
  // Convert to candidates with scores
  const candidates: CptCandidate[] = [];
  
  for (const [cpt, matchCount] of cptScores.entries()) {
    const entry = reverseIndex.cptToEntry.get(cpt);
    if (!entry) continue;
    
    const cptTokens = reverseIndex.cptToTokens.get(cpt);
    const cptTokenCount = cptTokens?.size || 1;
    
    // Score = (matches / query tokens) * (matches / cpt tokens)
    // This rewards both coverage of query AND specificity
    const queryScore = matchCount / expandedQueryTokens.length;
    const specificityScore = matchCount / cptTokenCount;
    const score = (queryScore + specificityScore) / 2;
    
    // Determine relevance level
    let relevance: 'high' | 'medium' | 'low';
    if (score >= 0.4 || matchCount >= 3) {
      relevance = 'high';
    } else if (score >= 0.2 || matchCount >= 2) {
      relevance = 'medium';
    } else {
      relevance = 'low';
    }
    
    candidates.push({
      cpt: entry.cpt,
      shortLabel: entry.shortLabel,
      explanation: entry.longDescription,
      category: entry.category,
      score,
      relevance,
    });
  }
  
  // Sort by score descending and take top results
  candidates.sort((a, b) => b.score - a.score);
  
  return candidates.slice(0, maxResults);
}

/**
 * Find suggested CPT codes for multiple descriptions
 */
export function findSuggestedCptsForDescriptions(
  descriptions: string[],
  maxCandidatesPerDescription: number = 3
): SuggestedCpt[] {
  return descriptions
    .filter(desc => desc && desc.trim().length > 0)
    .map(desc => ({
      sourceDescription: desc,
      candidates: reverseSearchCptByText(desc, maxCandidatesPerDescription),
    }))
    .filter(suggestion => suggestion.candidates.length > 0);
}

/**
 * Check if a CPT code exists in our master list
 */
export function isCptCodeKnown(cpt: string): boolean {
  initCptReverseIndex();
  return reverseIndex?.cptToEntry.has(cpt) ?? false;
}
