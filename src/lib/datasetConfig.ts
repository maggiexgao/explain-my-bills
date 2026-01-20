/**
 * Dataset Configuration
 * 
 * Canonical configuration for all Medicare reference datasets.
 * Used for code counting, validation, and admin UI.
 */

export interface DatasetInfo {
  tableName: string;
  codeColumn: string | null;
  displayName: string;
  description: string;
  yearColumn?: string;
  expectedCodePattern?: RegExp;
}

/**
 * Dataset configuration map
 * Each entry defines the structure and metadata for a dataset table
 */
export const DATASET_CONFIG: Record<string, DatasetInfo> = {
  mpfs_benchmarks: {
    tableName: 'mpfs_benchmarks',
    codeColumn: 'hcpcs',
    displayName: 'MPFS',
    description: 'Medicare Physician Fee Schedule',
    yearColumn: 'year',
    expectedCodePattern: /^[A-Z0-9]{5}$/i
  },
  opps_addendum_b: {
    tableName: 'opps_addendum_b',
    codeColumn: 'hcpcs',
    displayName: 'OPPS',
    description: 'Hospital Outpatient PPS',
    yearColumn: 'year',
    expectedCodePattern: /^[A-Z0-9]{5}$/i
  },
  clfs_fee_schedule: {
    tableName: 'clfs_fee_schedule',
    codeColumn: 'hcpcs',
    displayName: 'CLFS',
    description: 'Clinical Lab Fee Schedule',
    yearColumn: 'year',
    expectedCodePattern: /^[0-9]{5}$/
  },
  dmepos_fee_schedule: {
    tableName: 'dmepos_fee_schedule',
    codeColumn: 'hcpcs',
    displayName: 'DMEPOS',
    description: 'Durable Medical Equipment',
    yearColumn: 'year',
    expectedCodePattern: /^[AEKLB][0-9]{4}$/i
  },
  dmepen_fee_schedule: {
    tableName: 'dmepen_fee_schedule',
    codeColumn: 'hcpcs',
    displayName: 'DMEPEN',
    description: 'Enteral/Parenteral Nutrition',
    yearColumn: 'year',
    expectedCodePattern: /^B[0-9]{4}$/i
  },
  gpci_localities: {
    tableName: 'gpci_localities',
    codeColumn: null, // No code column, uses locality
    displayName: 'GPCI',
    description: 'Geographic Practice Cost Indices'
  },
  zip_to_locality: {
    tableName: 'zip_to_locality',
    codeColumn: null, // Uses ZIP codes, not HCPCS
    displayName: 'ZIP Crosswalk',
    description: 'ZIP to Locality Mapping'
  }
};

/**
 * Normalize an HCPCS code value to canonical format
 * CRITICAL: Never use parseInt/Number on HCPCS codes!
 * 
 * Valid HCPCS formats:
 * - 5 digits: 99284, 80053
 * - Letter + 4 digits: E0114, J1885, A0428, G0378
 * - Special codes: 0001U (PLA codes)
 */
export function normalizeHcpcs(value: unknown): string {
  if (value === null || value === undefined) return '';
  
  // Always convert to string first - NEVER use Number() or parseInt()!
  const str = String(value).trim().toUpperCase();
  
  // Remove common artifacts
  return str
    .replace(/^CPT[\s:.\-]*/i, '')
    .replace(/^HCPCS[\s:.\-]*/i, '')
    .replace(/^#/, '')
    .trim();
}

/**
 * Check if a value looks like a valid HCPCS code
 * Uses string matching, never numeric parsing
 */
export function isValidHcpcsFormat(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  
  const normalized = normalizeHcpcs(code);
  
  // Valid patterns:
  // - 5 digits (CPT): 99284, 80053
  // - 1 letter + 4 digits (HCPCS II): E0114, J1885, A0428, G0378
  // - 4 digits + 1 letter (PLA): 0001U
  // - Special: G codes, S codes, etc.
  return /^[A-Z0-9]{5}$/i.test(normalized);
}

/**
 * Count unique codes from an array of records
 * Uses proper string handling to preserve alphanumeric codes
 */
export function countUniqueCodes(records: unknown[], codeColumn: string): {
  count: number;
  sampleCodes: string[];
  prefixBreakdown: Record<string, number>;
} {
  const uniqueCodes = new Set<string>();
  const prefixBreakdown: Record<string, number> = {};
  
  for (const record of records) {
    if (record && typeof record === 'object' && codeColumn in record) {
      const rawValue = (record as Record<string, unknown>)[codeColumn];
      const code = normalizeHcpcs(rawValue);
      
      if (code && code.length >= 4 && isValidHcpcsFormat(code)) {
        uniqueCodes.add(code);
        
        // Track prefix for breakdown
        const prefix = code.charAt(0);
        prefixBreakdown[prefix] = (prefixBreakdown[prefix] || 0) + 1;
      }
    }
  }
  
  const codesArray = Array.from(uniqueCodes).sort();
  
  return {
    count: uniqueCodes.size,
    sampleCodes: codesArray.slice(0, 15),
    prefixBreakdown
  };
}

/**
 * Get dataset info by table name
 */
export function getDatasetInfo(tableName: string): DatasetInfo | null {
  return DATASET_CONFIG[tableName] || null;
}
