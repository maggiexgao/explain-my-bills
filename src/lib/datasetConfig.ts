/**
 * Dataset Configuration & Registry
 * 
 * Single source of truth for all Medicare reference datasets.
 * Used for code counting, validation, and admin UI.
 * 
 * CRITICAL: HCPCS/CPT codes must ALWAYS be handled as strings.
 * Never use parseInt(), Number(), or + coercion on codes!
 */

export interface DatasetInfo {
  key: string;
  tableName: string;
  codeColumn: string | null;
  displayName: string;
  description: string;
  expectedCodeType: 'hcpcs' | 'zip' | 'locality' | 'state' | 'none';
  yearColumn?: string;
  expectedCodePattern?: RegExp;
  notes?: string;
  minExpectedRows: number;
  minExpectedDistinctCodes: number;
}

/**
 * Dataset configuration map - the authoritative registry
 * Each entry defines the structure and metadata for a dataset table
 */
export const DATASET_CONFIG: Record<string, DatasetInfo> = {
  mpfs_benchmarks: {
    key: 'mpfs',
    tableName: 'mpfs_benchmarks',
    codeColumn: 'hcpcs',
    displayName: 'MPFS',
    description: 'Medicare Physician Fee Schedule',
    expectedCodeType: 'hcpcs',
    yearColumn: 'year',
    expectedCodePattern: /^[A-Z0-9]{5}$/i,
    notes: 'MPFS has multiple rows per code (facility/non-facility, modifiers). Distinct codes < rows is expected.',
    minExpectedRows: 10000,
    minExpectedDistinctCodes: 8000
  },
  opps_addendum_b: {
    key: 'opps',
    tableName: 'opps_addendum_b',
    codeColumn: 'hcpcs',
    displayName: 'OPPS',
    description: 'Hospital Outpatient PPS',
    expectedCodeType: 'hcpcs',
    yearColumn: 'year',
    expectedCodePattern: /^[A-Z0-9]{5}$/i,
    notes: 'OPPS codes are mostly 1:1 with rows. Alphanumeric codes (C/G/J/Q) are common.',
    minExpectedRows: 5000,
    minExpectedDistinctCodes: 4000
  },
  clfs_fee_schedule: {
    key: 'clfs',
    tableName: 'clfs_fee_schedule',
    codeColumn: 'hcpcs',
    displayName: 'CLFS',
    description: 'Clinical Lab Fee Schedule',
    expectedCodeType: 'hcpcs',
    yearColumn: 'year',
    expectedCodePattern: /^[0-9]{5}$/,
    notes: 'Lab codes are typically 5-digit numeric (80000-89999 range).',
    minExpectedRows: 500,
    minExpectedDistinctCodes: 400
  },
  dmepos_fee_schedule: {
    key: 'dmepos',
    tableName: 'dmepos_fee_schedule',
    codeColumn: 'hcpcs',
    displayName: 'DMEPOS',
    description: 'Durable Medical Equipment',
    expectedCodeType: 'hcpcs',
    yearColumn: 'year',
    expectedCodePattern: /^[AEKLB][0-9]{4}$/i,
    notes: 'DMEPOS has multiple rows per code (state-level pricing). Many codes start with A/E/K/L.',
    minExpectedRows: 10000,
    minExpectedDistinctCodes: 500
  },
  dmepen_fee_schedule: {
    key: 'dmepen',
    tableName: 'dmepen_fee_schedule',
    codeColumn: 'hcpcs',
    displayName: 'DMEPEN',
    description: 'Enteral/Parenteral Nutrition',
    expectedCodeType: 'hcpcs',
    yearColumn: 'year',
    expectedCodePattern: /^B[0-9]{4}$/i,
    notes: 'DMEPEN codes start with B. Multiple rows per code for state-level pricing.',
    minExpectedRows: 100,
    minExpectedDistinctCodes: 20
  },
  gpci_localities: {
    key: 'gpci',
    tableName: 'gpci_localities',
    codeColumn: null, // No HCPCS codes - uses locality
    displayName: 'GPCI',
    description: 'Geographic Practice Cost Indices',
    expectedCodeType: 'locality',
    notes: 'Row count is the key metric. No HCPCS codes in this dataset.',
    minExpectedRows: 100,
    minExpectedDistinctCodes: 0
  },
  zip_to_locality: {
    key: 'zip',
    tableName: 'zip_to_locality',
    codeColumn: 'zip5',
    displayName: 'ZIP Crosswalk',
    description: 'ZIP to Locality Mapping',
    expectedCodeType: 'zip',
    expectedCodePattern: /^[0-9]{5}$/,
    notes: 'Maps ZIPs to Medicare localities. Distinct ZIPs should be close to row count.',
    minExpectedRows: 30000,
    minExpectedDistinctCodes: 25000
  },
  gpci_state_avg_2026: {
    key: 'gpci_state',
    tableName: 'gpci_state_avg_2026',
    codeColumn: 'state_abbr',
    displayName: 'GPCI State Avg',
    description: 'State-level GPCI Averages',
    expectedCodeType: 'state',
    notes: 'Derived table computed from gpci_localities. Should have ~51 rows (50 states + DC).',
    minExpectedRows: 45,
    minExpectedDistinctCodes: 45
  }
};

/**
 * Get all dataset configs as an array
 */
export function getAllDatasets(): DatasetInfo[] {
  return Object.values(DATASET_CONFIG);
}

/**
 * Get dataset info by table name or key
 */
export function getDatasetInfo(tableNameOrKey: string): DatasetInfo | null {
  // Direct match
  if (DATASET_CONFIG[tableNameOrKey]) {
    return DATASET_CONFIG[tableNameOrKey];
  }
  // Match by key
  return Object.values(DATASET_CONFIG).find(d => d.key === tableNameOrKey) || null;
}

/**
 * Normalize an HCPCS/CPT code value to canonical format
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
  
  const normalized = code.trim().toUpperCase();
  
  // Valid patterns:
  // - 5 digits (CPT): 99284, 80053
  // - 1 letter + 4 digits (HCPCS II): E0114, J1885, A0428, G0378
  // - 4 digits + 1 letter (PLA): 0001U
  // - Special: G codes, S codes, etc.
  return /^[A-Z0-9]{5}$/i.test(normalized);
}

/**
 * Stats computed for a dataset
 */
export interface DatasetStats {
  tableName: string;
  displayName: string;
  rowCount: number;
  distinctCodeCount: number;
  codeColumnUsed: string | null;
  estimatedCodeCount: boolean; // true if count is estimated (sampled), false if exact
  nullOrEmptyCodeRate: number; // percentage (0-100)
  alphaCodeRate: number; // percentage of codes containing letters (0-100)
  sampleCodes: string[];
  topCodePrefixes: Record<string, number>; // prefix -> count
  validationStatus: 'pass' | 'warn' | 'fail';
  validationMessages: string[];
}

/**
 * Count unique codes from an array of records with detailed stats
 * Uses proper string handling to preserve alphanumeric codes
 */
export function analyzeCodeColumn(
  records: unknown[], 
  codeColumn: string,
  config?: DatasetInfo
): {
  distinctCount: number;
  sampleCodes: string[];
  prefixBreakdown: Record<string, number>;
  nullOrEmptyCount: number;
  alphaCodeCount: number;
  totalChecked: number;
} {
  const uniqueCodes = new Set<string>();
  const prefixBreakdown: Record<string, number> = {};
  let nullOrEmptyCount = 0;
  let alphaCodeCount = 0;
  
  for (const record of records) {
    if (record && typeof record === 'object' && codeColumn in record) {
      const rawValue = (record as Record<string, unknown>)[codeColumn];
      
      // Check for null/empty
      if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
        nullOrEmptyCount++;
        continue;
      }
      
      // Normalize - ALWAYS treat as string!
      const code = String(rawValue).trim().toUpperCase();
      
      // Accept any non-empty string as a code (don't be too strict)
      if (code.length >= 1) {
        uniqueCodes.add(code);
        
        // Track prefix for breakdown
        const prefix = code.charAt(0);
        prefixBreakdown[prefix] = (prefixBreakdown[prefix] || 0) + 1;
        
        // Check if code contains letters
        if (/[A-Z]/i.test(code)) {
          alphaCodeCount++;
        }
      }
    }
  }
  
  const codesArray = Array.from(uniqueCodes).sort();
  
  return {
    distinctCount: uniqueCodes.size,
    sampleCodes: codesArray.slice(0, 15),
    prefixBreakdown,
    nullOrEmptyCount,
    alphaCodeCount,
    totalChecked: records.length
  };
}

/**
 * Validate a dataset against its expected configuration
 */
export function validateDatasetStats(
  stats: {
    rowCount: number;
    distinctCodes: number;
    nullOrEmptyRate: number;
    alphaCodeRate: number;
  },
  config: DatasetInfo
): { status: 'pass' | 'warn' | 'fail'; messages: string[] } {
  const messages: string[] = [];
  let status: 'pass' | 'warn' | 'fail' = 'pass';
  
  // Check minimum row count
  if (stats.rowCount < config.minExpectedRows) {
    if (stats.rowCount === 0) {
      status = 'fail';
      messages.push(`Empty - no data imported`);
    } else {
      status = 'fail';
      messages.push(`Only ${stats.rowCount.toLocaleString()} rows (expected ≥${config.minExpectedRows.toLocaleString()})`);
    }
  }
  
  // Check distinct code count (only for datasets with codes)
  if (config.codeColumn && config.minExpectedDistinctCodes > 0) {
    if (stats.distinctCodes < config.minExpectedDistinctCodes) {
      if (stats.distinctCodes < 50 && stats.rowCount > 5000) {
        status = 'fail';
        messages.push(`Only ${stats.distinctCodes} distinct codes from ${stats.rowCount.toLocaleString()} rows - likely data corruption or coercion`);
      } else if (stats.distinctCodes < config.minExpectedDistinctCodes * 0.5) {
        status = status === 'fail' ? 'fail' : 'warn';
        messages.push(`Low distinct code count: ${stats.distinctCodes} (expected ≥${config.minExpectedDistinctCodes})`);
      }
    }
  }
  
  // Check null/empty rate
  if (config.codeColumn && stats.nullOrEmptyRate > 5) {
    status = status === 'fail' ? 'fail' : 'warn';
    messages.push(`${stats.nullOrEmptyRate.toFixed(1)}% of rows have empty ${config.codeColumn}`);
  }
  
  // Check alpha code rate for HCPCS datasets
  if (config.expectedCodeType === 'hcpcs') {
    // DMEPOS/DMEPEN/OPPS should have mostly alphanumeric codes
    if (['dmepos_fee_schedule', 'dmepen_fee_schedule'].includes(config.tableName)) {
      if (stats.alphaCodeRate < 50 && stats.rowCount > 100) {
        status = status === 'fail' ? 'fail' : 'warn';
        messages.push(`Only ${stats.alphaCodeRate.toFixed(1)}% codes have letters - expected mostly A/E/K/L/B codes`);
      }
    }
    // OPPS should have some alpha codes (C/G/J/Q codes)
    if (config.tableName === 'opps_addendum_b') {
      if (stats.alphaCodeRate < 20 && stats.rowCount > 1000) {
        status = status === 'fail' ? 'fail' : 'warn';
        messages.push(`Only ${stats.alphaCodeRate.toFixed(1)}% codes have letters - expected mix of numeric and alpha`);
      }
    }
  }
  
  if (messages.length === 0) {
    messages.push('All checks passed');
  }
  
  return { status, messages };
}
