/**
 * CPT Reverse Search Index
 * Maps procedure/treatment names to candidate CPT codes
 */

import { CptMasterEntry, loadCptMaster } from './cptMaster';

type IndexEntry = {
  entry: CptMasterEntry;
  searchable: string[];
};

let index: IndexEntry[] = [];
let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the CPT reverse search index
 */
export async function initCptReverseIndex(): Promise<void> {
  if (initialized) return;
  
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    const entries = await loadCptMaster();
    
    index = entries.map(entry => {
      const fields = [
        entry.shortLabel,
        entry.longDescription,
        entry.section ?? '',
        entry.category ?? '',
        ...(entry.synonyms ?? []),
      ]
        .join(' ')
        .toLowerCase();

      const tokens = fields.split(/[^a-z0-9]+/).filter(Boolean);
      return { entry, searchable: tokens };
    });

    initialized = true;
    console.log(`Initialized CPT reverse index with ${index.length} entries`);
  })();

  await initPromise;
}

export type CptReverseResult = {
  cpt: string;
  shortLabel: string;
  explanation: string;
  category: string;
  score: number;
  relevance: 'High' | 'Medium' | 'Low';
};

/**
 * Search for CPT codes by text query (procedure name, description, etc.)
 */
export function reverseSearchCptByText(query: string, maxResults = 5): CptReverseResult[] {
  const qTokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  
  if (!qTokens.length || !index.length) return [];

  const scores: Array<{ entry: CptMasterEntry; score: number }> = [];

  for (const item of index) {
    let matches = 0;
    for (const qt of qTokens) {
      // Check for exact token match
      if (item.searchable.includes(qt)) {
        matches++;
      } else {
        // Check for partial match (token starts with query token)
        const partialMatch = item.searchable.some(s => s.startsWith(qt) && qt.length >= 3);
        if (partialMatch) matches += 0.5;
      }
    }
    
    if (matches > 0) {
      const score = matches / qTokens.length;
      scores.push({ entry: item.entry, score });
    }
  }

  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, maxResults).map(s => {
    let relevance: 'High' | 'Medium' | 'Low';
    if (s.score >= 0.8) relevance = 'High';
    else if (s.score >= 0.5) relevance = 'Medium';
    else relevance = 'Low';

    return {
      cpt: s.entry.cpt,
      shortLabel: s.entry.shortLabel,
      explanation: s.entry.longDescription,
      category: s.entry.section ?? s.entry.category ?? 'Other',
      score: s.score,
      relevance,
    };
  });
}

/**
 * Get suggested CPT codes for a list of procedure descriptions
 */
export type SuggestedCptResult = {
  sourceDescription: string;
  candidates: CptReverseResult[];
};

export async function getSuggestedCptsForDescriptions(
  descriptions: string[]
): Promise<SuggestedCptResult[]> {
  await initCptReverseIndex();
  
  return descriptions.map(description => ({
    sourceDescription: description,
    candidates: reverseSearchCptByText(description, 3),
  }));
}
