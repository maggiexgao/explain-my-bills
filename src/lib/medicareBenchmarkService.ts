/**
 * Medicare Benchmark Service
 * 
 * Calculates Medicare reference prices for medical bill line items
 * following CMS MPFS methodology with GPCI geographic adjustments.
 * 
 * Key principles:
 * - Medicare is a REFERENCE ANCHOR, not "what you should pay"
 * - All calculations are transparent and auditable
 * - Edge cases degrade gracefully with clear documentation
 * 
 * STEP 2: Proper match states (priced, exists_not_priced, missing_from_dataset)
 * STEP 3: ZIP→Locality crosswalk via geoResolver (zip_to_locality + state fallback)
 * STEP 4: Locality-adjusted RVU + GPCI + CF computation
 */

import { supabase } from '@/integrations/supabase/client';
import { normalizeAndValidateCode, ValidatedCode, RejectedToken } from './cptCodeValidator';
import { resolveGeo, GeoResolution, GeoMethod, GpciIndices } from './geoResolver';
import { formatBillVsReferenceSentence } from './formatComparisonText';

// ============= Types =============

export type ConfidenceLevel = 'local_adjusted' | 'state_estimate' | 'national_estimate';
export type BenchmarkStatus = 'ok' | 'no_codes' | 'no_matches' | 'partial';
export type MatchStatus = 'matched' | 'missing' | 'exists_not_priced';

// Fee source indicates how the Medicare fee was determined
export type FeeSource = 
  | 'direct_fee'          // Used pre-calculated fee from MPFS
  | 'rvu_calc_national'   // Computed from RVUs without GPCI
  | 'rvu_calc_local'      // Computed from RVUs with GPCI adjustment
  | 'opps_rate'           // OPPS hospital outpatient rate from database
  | 'opps_fallback'       // OPPS rate from hardcoded fallback table
  | 'clfs_rate'           // Clinical Lab Fee Schedule rate
  | 'asp_drug'            // Average Sales Price for drug J-codes
  | 'revenue_code'        // Hospital revenue code (billing category)
  | 's_code'              // Private payer S-code
  | null;                 // Fee could not be determined

// Reason why a code exists but has no price
export type NotPricedReason = 
  | 'fees_missing'                    // Fee columns are NULL
  | 'rvus_zero_or_missing'           // RVUs are all zero or NULL
  | 'conversion_factor_missing'       // No CF available
  | 'status_indicator_nonpayable'     // MPFS status indicates not payable
  | null;

export interface NormalizedCode {
  hcpcs: string;
  modifier: string;
  raw: string;
}

export interface BenchmarkLineItem {
  hcpcs: string;
  description?: string;
  billedAmount: number | null; // Allow null for "not detected"
  units: number;
  dateOfService?: string;
  modifier?: string;
  isFacility?: boolean;
  rawCode?: string; // Original extracted code before normalization
}

export interface MpfsQueryAttempt {
  hcpcs: string;
  modifier: string;
  year: number;
  qp_status: string;
  source: string;
  result_count: number;
  row_exists: boolean;
  has_fee: boolean;
  has_rvu: boolean;
  status_code?: string | null;
}

export interface BenchmarkLineResult {
  hcpcs: string;
  modifier: string;
  description: string | null;
  billedAmount: number | null; // null if not detected
  units: number;
  medicareReferencePerUnit: number | null;
  medicareReferenceTotal: number | null;
  multiple: number | null;
  status: 'fair' | 'high' | 'very_high' | 'unknown';
  matchStatus: MatchStatus;
  benchmarkYearUsed: number | null;
  requestedYear: number | null;
  notes: string[];
  isEmergency?: boolean;
  isBundled?: boolean;
  modifierFallbackUsed?: boolean;
  gpciAdjusted?: boolean;
  exclusionReason?: string;
  
  // Step 2: Enhanced debug info
  feeSource: FeeSource;
  notPricedReason: NotPricedReason;
}

export interface BenchmarkMetadata {
  localityUsed: ConfidenceLevel;
  localityName: string | null;
  localityCode: string | null;
  benchmarkYearUsed: number;
  requestedYears: number[];
  usedYearFallback: boolean;
  fallbackReason: string | null;
  zip: string | null;
  state: string | null;
  notes: string[];
}

export interface GeoDebugInfo {
  zipInput: string | null;
  zipValid: boolean;
  stateInput: string | null;
  localityFound: boolean;
  localityNum: string | null;
  localityName: string | null;
  fallbackUsed: 'none' | 'state_estimate' | 'national_estimate' | 'zip_unmapped';
  method: GeoMethod;
  workGpci: number | null;
  peGpci: number | null;
  mpGpci: number | null;
  messageToUser: string;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
}

export interface DebugInfo {
  rawCodesExtracted: string[];
  normalizedCodes: NormalizedCode[];
  validatedCodes: ValidatedCode[];
  rejectedTokens: RejectedToken[];
  codesMatched: string[];
  codesMissing: string[];
  codesExistsNotPriced: string[];
  latestMpfsYear: number;
  queriesAttempted: MpfsQueryAttempt[];
  gpciLookup: {
    attempted: boolean;
    zipUsed: string | null;
    stateUsed: string | null;
    localityFound: boolean;
    localityName: string | null;
    localityCode: string | null;
    workGpci: number | null;
    peGpci: number | null;
    mpGpci: number | null;
    method: GeoMethod;
  };
  geoDebug: GeoDebugInfo;
  geoResolution: GeoResolution | null;
}

export interface MedicareBenchmarkOutput {
  // Status indicator
  status: BenchmarkStatus;
  
  // Bill-level totals
  totals: {
    billedTotal: number | null; // null if not detected
    billedTotalDetected: boolean; // false if all items have null billedAmount
    medicareReferenceTotal: number | null;
    multipleOfMedicare: number | null;
    difference: number | null;
  };
  
  // === NEW: Matched-items comparison (prevents scope mismatch) ===
  matchedItemsComparison: {
    matchedBilledTotal: number | null; // Sum of billed amounts ONLY for matched items
    matchedMedicareTotal: number | null; // Sum of Medicare reference for matched items
    matchedItemsMultiple: number | null; // matchedBilled / matchedMedicare
    matchedItemsCount: number; // How many items are in this comparison
    totalItemsCount: number; // Total items attempted
    coveragePercent: number | null; // matchedItemsCount / totalItemsCount
    scopeWarning: string | null; // Warning if scope mismatch detected
    isValidComparison: boolean; // True only if both totals exist and scope matches
  };
  
  // Metadata about the benchmark calculation
  metadata: BenchmarkMetadata;
  
  // Line-by-line breakdown
  lineItems: BenchmarkLineResult[];
  
  // Debug information
  debug: DebugInfo;
  
  // Calculated timestamp
  calculatedAt: string;
  
  // Legacy compatibility fields
  totalBilled: number;
  totalMedicareReference: number | null;
  multipleOfMedicare: number | null;
  confidence: ConfidenceLevel;
  localityName: string | null;
  state: string | null;
  codesNotFound: string[];
  codesExcluded: string[];
  dataYear: number;
}

// ============= Internal Types =============

interface MpfsBenchmarkRow {
  hcpcs: string;
  modifier: string;
  description: string | null;
  status: string | null;
  work_rvu: number | null;
  nonfac_pe_rvu: number | null;
  fac_pe_rvu: number | null;
  mp_rvu: number | null;
  nonfac_fee: number | null;
  fac_fee: number | null;
  conversion_factor: number | null;
  year: number;
  global_days: string | null;
}

interface GpciLocalityRow {
  locality_num: string;
  state_abbr: string;
  locality_name: string;
  zip_code: string | null;
  work_gpci: number;
  pe_gpci: number;
  mp_gpci: number;
}

interface ZipToLocalityRow {
  zip5: string;
  state_abbr: string | null;
  locality_num: string;
  carrier_num: string | null;
  county_name: string | null;
  effective_year: number | null;
}

// ============= Constants =============

// Default conversion factor (CY 2026)
const DEFAULT_CONVERSION_FACTOR = 34.6062;

// Status thresholds (percent of Medicare)
const FAIR_THRESHOLD = 200;    // <= 200% = fair
const HIGH_THRESHOLD = 300;    // <= 300% = high, > 300% = very_high

// Global surgery indicators that affect bundling
const BUNDLED_GLOBAL_DAYS = ['010', '090'];

// Status codes that indicate non-payable codes
const NON_PAYABLE_STATUS_CODES = ['B', 'I', 'N', 'R', 'X'];

// Cache for latest MPFS year (per request)
let cachedLatestMpfsYear: number | null = null;

// ============= In-Memory Rate Cache =============
// Caches Medicare rate lookups within a session to reduce database round trips

interface CachedRate {
  rate: number | null;
  source: FeeSource;
  description: string | null;
  notPricedReason?: NotPricedReason;
}

const rateCache = new Map<string, CachedRate>();

function getCachedRate(code: string, careSetting: string): CachedRate | undefined {
  const key = `${code.toUpperCase()}-${careSetting}`;
  return rateCache.get(key);
}

function setCachedRate(code: string, careSetting: string, cached: CachedRate): void {
  const key = `${code.toUpperCase()}-${careSetting}`;
  rateCache.set(key, cached);
}

/**
 * Clear rate cache - call at start of new analysis
 */
export function clearRateCache(): void {
  rateCache.clear();
  console.log('[RateCache] Cache cleared');
}

// ============= Batch Fetch Functions =============
// Pre-fetch all codes in a single query to reduce database round trips

interface BatchedMpfsResult {
  [hcpcs: string]: MpfsBenchmarkRow | null;
}

/**
 * Batch fetch MPFS benchmarks for multiple codes
 * Reduces database round trips from N to 1
 */
async function batchFetchMpfsBenchmarks(
  codes: string[],
  year: number
): Promise<BatchedMpfsResult> {
  if (codes.length === 0) return {};
  
  const normalizedCodes = [...new Set(codes.map(c => c.trim().toUpperCase()))];
  console.log(`[MPFS Batch] Fetching ${normalizedCodes.length} codes for year ${year}`);
  
  const { data, error } = await supabase
    .from('mpfs_benchmarks')
    .select('*')
    .in('hcpcs', normalizedCodes)
    .eq('year', year)
    .eq('qp_status', 'nonQP')
    .eq('modifier', '');
  
  if (error) {
    console.error('[MPFS Batch] Error:', error.message);
    return {};
  }
  
  const result: BatchedMpfsResult = {};
  for (const row of (data || [])) {
    result[row.hcpcs] = row as MpfsBenchmarkRow;
  }
  
  console.log(`[MPFS Batch] Found ${Object.keys(result).length} of ${normalizedCodes.length} codes`);
  return result;
}

interface BatchedOppsResult {
  [hcpcs: string]: { payment_rate: number; short_desc: string | null; source: 'opps_db' | 'opps_fallback' } | null;
}

/**
 * Batch fetch OPPS rates for multiple codes
 */
async function batchFetchOppsRates(codes: string[]): Promise<BatchedOppsResult> {
  if (codes.length === 0) return {};
  
  const normalizedCodes = [...new Set(codes.map(c => c.trim().toUpperCase()))];
  console.log(`[OPPS Batch] Fetching ${normalizedCodes.length} codes`);
  
  const { data, error } = await supabase
    .from('opps_addendum_b')
    .select('hcpcs, payment_rate, short_desc')
    .in('hcpcs', normalizedCodes)
    .eq('year', OPPS_YEAR);
  
  const result: BatchedOppsResult = {};
  
  // First, populate from database
  if (!error && data) {
    for (const row of data) {
      if (row.payment_rate && row.payment_rate > 0) {
        result[row.hcpcs] = { 
          payment_rate: row.payment_rate, 
          short_desc: row.short_desc,
          source: 'opps_db'
        };
      }
    }
  }
  
  // Then, fill in from fallback for codes not found
  for (const code of normalizedCodes) {
    if (!result[code] && OPPS_FALLBACK_RATES[code]) {
      const fallback = OPPS_FALLBACK_RATES[code];
      result[code] = {
        payment_rate: fallback.payment_rate,
        short_desc: fallback.short_desc || null,
        source: 'opps_fallback'
      };
    }
  }
  
  console.log(`[OPPS Batch] Found ${Object.keys(result).length} of ${normalizedCodes.length} codes`);
  return result;
}

interface BatchedClfsResult {
  [hcpcs: string]: { rate: number; desc: string | null } | null;
}

/**
 * Batch fetch CLFS rates for multiple lab codes
 */
async function batchFetchClfsRates(codes: string[]): Promise<BatchedClfsResult> {
  if (codes.length === 0) return {};
  
  const normalizedCodes = [...new Set(codes.map(c => c.trim().toUpperCase()))];
  console.log(`[CLFS Batch] Fetching ${normalizedCodes.length} lab codes`);
  
  const { data, error } = await supabase
    .from('clfs_fee_schedule')
    .select('hcpcs, payment_amount, short_desc')
    .in('hcpcs', normalizedCodes)
    .order('year', { ascending: false });
  
  const result: BatchedClfsResult = {};
  
  // Populate from database (take first/latest year for each code)
  if (!error && data) {
    for (const row of data) {
      if (!result[row.hcpcs] && row.payment_amount && row.payment_amount > 0) {
        result[row.hcpcs] = { 
          rate: row.payment_amount, 
          desc: row.short_desc 
        };
      }
    }
  }
  
  // Fill in from fallback
  for (const code of normalizedCodes) {
    if (!result[code] && CLFS_FALLBACK_RATES[code]) {
      result[code] = CLFS_FALLBACK_RATES[code];
    }
  }
  
  console.log(`[CLFS Batch] Found ${Object.keys(result).length} of ${normalizedCodes.length} codes`);
  return result;
}

// Hardcoded OPPS rates for common hospital codes - fallback if database lookup fails
const OPPS_FALLBACK_RATES: Record<string, { payment_rate: number; status_indicator: string; apc: string; short_desc?: string }> = {
  // ER visit codes
  '99281': { payment_rate: 88.05, status_indicator: 'J2', apc: '5021', short_desc: 'ER visit level 1' },
  '99282': { payment_rate: 158.36, status_indicator: 'J2', apc: '5022', short_desc: 'ER visit level 2' },
  '99283': { payment_rate: 276.89, status_indicator: 'J2', apc: '5023', short_desc: 'ER visit level 3' },
  '99284': { payment_rate: 425.82, status_indicator: 'J2', apc: '5024', short_desc: 'ER visit level 4' },
  '99285': { payment_rate: 613.10, status_indicator: 'J2', apc: '5025', short_desc: 'ER visit level 5' },
  // IV therapy codes
  '96360': { payment_rate: 142.00, status_indicator: 'T', apc: '5691', short_desc: 'IV infusion hydration initial' },
  '96361': { payment_rate: 45.00, status_indicator: 'N', apc: '5691', short_desc: 'IV infusion hydration addl' },
  '96365': { payment_rate: 172.00, status_indicator: 'T', apc: '5692', short_desc: 'IV infusion therapy initial' },
  '96366': { payment_rate: 35.00, status_indicator: 'N', apc: '5692', short_desc: 'IV infusion therapy addl' },
  '96374': { payment_rate: 85.00, status_indicator: 'S', apc: '5693', short_desc: 'IV push single drug' },
  '96375': { payment_rate: 28.00, status_indicator: 'N', apc: '5693', short_desc: 'IV push addl drug' },
  // Critical care
  '99291': { payment_rate: 684.00, status_indicator: 'S', apc: '5046', short_desc: 'Critical care first hour' },
  '99292': { payment_rate: 110.00, status_indicator: 'S', apc: '5046', short_desc: 'Critical care addl 30 min' },
  // Observation
  'G0378': { payment_rate: 45.00, status_indicator: 'N', apc: '8011', short_desc: 'Hospital observation per hr' },
  'G0379': { payment_rate: 0.00, status_indicator: 'N', apc: '8011', short_desc: 'Direct admit to observation' },
};

// Common drug ASP (Average Sales Price) fallback rates with typical dose multipliers
// Medicare pays ASP + 6% - hospital markups are typically 3-5× the ASP rate
const DRUG_ASP_FALLBACK: Record<string, { asp: number; desc: string; unit: string; typicalDose: number }> = {
  'J2405': { asp: 0.12, desc: 'Ondansetron', unit: 'per 1mg', typicalDose: 4 },      // 4mg dose common
  'J2550': { asp: 0.33, desc: 'Promethazine', unit: 'per 50mg', typicalDose: 1 },    // 25-50mg
  'J1100': { asp: 0.15, desc: 'Dexamethasone', unit: 'per 1mg', typicalDose: 4 },    // 4mg dose
  'J2270': { asp: 0.17, desc: 'Morphine', unit: 'per 10mg', typicalDose: 1 },        // 4-10mg
  'J1885': { asp: 2.50, desc: 'Ketorolac', unit: 'per 15mg', typicalDose: 2 },       // 30mg
  'J3010': { asp: 0.02, desc: 'Fentanyl', unit: 'per 0.1mg', typicalDose: 1 },       // 50-100mcg
  'J2175': { asp: 1.50, desc: 'Meperidine', unit: 'per 100mg', typicalDose: 1 },     // 50-100mg
  'J0170': { asp: 5.00, desc: 'Epinephrine', unit: 'per 1mg', typicalDose: 1 },
  'J1200': { asp: 0.50, desc: 'Diphenhydramine', unit: 'per 50mg', typicalDose: 1 }, // 25-50mg
  'J2765': { asp: 1.00, desc: 'Metoclopramide', unit: 'per 10mg', typicalDose: 1 },
  'J0690': { asp: 0.10, desc: 'Cefazolin', unit: 'per 500mg', typicalDose: 2 },      // 1g dose
  'J1040': { asp: 0.25, desc: 'Methylprednisolone', unit: 'per 40mg', typicalDose: 3 }, // 125mg
  'J0129': { asp: 5.00, desc: 'Abatacept', unit: 'per 10mg', typicalDose: 75 },
  'J3490': { asp: 0.00, desc: 'Unspecified drug', unit: 'N/A', typicalDose: 1 },     // Misc drugs
};

// OPPS year constant
const OPPS_YEAR = 2025;

// ============= Revenue Code Handling =============

const REVENUE_CODE_DESCRIPTIONS: Record<string, string> = {
  '0250': 'Pharmacy (general)',
  '0252': 'Pharmacy - Generic drugs',
  '0253': 'Pharmacy - Non-generic drugs',
  '0254': 'Pharmacy - Drugs requiring specific ID',
  '0255': 'Pharmacy - Biologicals',
  '0258': 'Pharmacy - IV solutions',
  '0260': 'IV Therapy (general)',
  '0261': 'IV Therapy - Infusion pump',
  '0262': 'IV Therapy - IV pump supplies',
  '0263': 'IV Therapy - Supplies',
  '0264': 'IV Therapy - Admixture',
  '0270': 'Medical/Surgical Supplies (general)',
  '0271': 'Medical/Surgical - Non-sterile supply',
  '0272': 'Medical/Surgical - Sterile supply',
  '0274': 'Medical/Surgical - Prosthetic devices',
  '0278': 'Medical/Surgical - Other implants',
  '0300': 'Lab (general)',
  '0301': 'Lab - Chemistry',
  '0302': 'Lab - Immunology',
  '0305': 'Lab - Hematology',
  '0306': 'Lab - Blood bank',
  '0320': 'Radiology - Diagnostic',
  '0324': 'Radiology - Diagnostic - Nuclear medicine',
  '0350': 'CT Scan (general)',
  '0351': 'CT Scan - Head',
  '0352': 'CT Scan - Body',
  '0360': 'OR Services (general)',
  '0370': 'Anesthesia (general)',
  '0450': 'Emergency Room (general)',
  '0451': 'Emergency Room - EMTALA',
  '0456': 'Emergency Room - Urgent care',
  '0459': 'Emergency Room - Other',
  '0510': 'Clinic (general)',
  '0636': 'Drugs requiring specific ID',
  '0710': 'Recovery Room',
  '0730': 'EKG/ECG',
  '0761': 'Treatment Room - Observation',
  '0762': 'Treatment Room - Other',
};

// ============= Code Normalization =============

/**
 * Normalize a raw CPT/HCPCS code string into structured format
 * 
 * Rules:
 * - Trim whitespace, uppercase
 * - Remove "CPT", "HCPCS", "CODE:" prefixes
 * - Remove punctuation except hyphen
 * - Split on whitespace or hyphen for modifier
 * - Preserve leading zeros (code must remain TEXT)
 * - Allow alphanumeric codes like 0001F, G0123, J1885, 99285, 58662
 */
export function normalizeCode(rawCode: string): NormalizedCode {
  if (!rawCode || typeof rawCode !== 'string') {
    return { hcpcs: '', modifier: '', raw: rawCode || '' };
  }
  
  const raw = rawCode;
  let cleaned = rawCode.trim().toUpperCase();
  
  // Remove common prefixes
  cleaned = cleaned
    .replace(/^CPT[\s:]*/, '')
    .replace(/^HCPCS[\s:]*/, '')
    .replace(/^CODE[\s:]*/, '')
    .replace(/^PROCEDURE[\s:]*/, '');
  
  // Remove punctuation except hyphen and space
  cleaned = cleaned.replace(/[^\w\s-]/g, '');
  
  // Trim again after removing prefixes
  cleaned = cleaned.trim();
  
  // Split on hyphen or space to extract modifier
  let hcpcs = '';
  let modifier = '';
  
  // First check for hyphen separator (common: "58662-59")
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-').map(p => p.trim()).filter(p => p.length > 0);
    if (parts.length >= 1) {
      hcpcs = parts[0];
      // Second part is modifier if it's 2 chars alphanumeric
      if (parts.length >= 2 && /^[A-Z0-9]{2}$/.test(parts[1])) {
        modifier = parts[1];
      }
    }
  } else {
    // Split on whitespace
    const parts = cleaned.split(/\s+/).filter(p => p.length > 0);
    if (parts.length >= 1) {
      hcpcs = parts[0];
      // Second token could be modifier if it looks like one (2 chars alphanumeric)
      if (parts.length >= 2 && /^[A-Z0-9]{2}$/.test(parts[1])) {
        modifier = parts[1];
      }
    }
  }
  
  // Validate HCPCS code format (alphanumeric, typically 5 chars but can be 4-5)
  const isValidHcpcs = /^[A-Z0-9]{4,5}$/.test(hcpcs);
  
  if (!isValidHcpcs) {
    // Try to extract any 5-char alphanumeric sequence
    const match = cleaned.match(/\b([A-Z0-9]{5})\b/);
    if (match) {
      hcpcs = match[1];
    } else {
      // Try 4-char codes
      const match4 = cleaned.match(/\b([A-Z0-9]{4})\b/);
      if (match4) {
        hcpcs = match4[1];
      }
    }
  }
  
  return { hcpcs, modifier, raw };
}

/**
 * Check if a normalized code is valid and billable
 */
export function isValidBillableCode(normalized: NormalizedCode): boolean {
  if (!normalized.hcpcs || normalized.hcpcs.length < 4) {
    return false;
  }
  return /^[A-Z0-9]{4,5}$/.test(normalized.hcpcs);
}

// ============= Data Fetching =============

/**
 * Get the latest MPFS year available in the database
 */
async function getLatestMpfsYear(): Promise<number> {
  if (cachedLatestMpfsYear !== null) {
    return cachedLatestMpfsYear;
  }
  
  const { data, error } = await supabase
    .from('mpfs_benchmarks')
    .select('year')
    .eq('qp_status', 'nonQP')
    .eq('source', 'CMS MPFS')
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error || !data) {
    console.warn('Could not fetch latest MPFS year, defaulting to 2026:', error);
    return 2026;
  }
  
  cachedLatestMpfsYear = data.year;
  return data.year;
}

/**
 * Clear the cached MPFS year (call at start of new analysis)
 */
export function clearMpfsYearCache(): void {
  cachedLatestMpfsYear = null;
}

// ============= STEP 3: ZIP→Locality Resolution (now uses geoResolver) =============

/**
 * Map GeoMethod to ConfidenceLevel
 */
function geoMethodToConfidence(method: GeoMethod): ConfidenceLevel {
  switch (method) {
    case 'zip_exact':
      return 'local_adjusted';
    case 'zip_to_state_avg':
    case 'state_avg':
      return 'state_estimate';
    case 'national_default':
      return 'national_estimate';
  }
}

/**
 * Create a synthetic GpciLocalityRow from resolved GPCI indices
 */
function createGpciFromResolution(resolution: GeoResolution): GpciLocalityRow | null {
  if (resolution.method === 'national_default') {
    return null;
  }
  
  return {
    locality_num: resolution.localityNum || 'STATE_AVG',
    state_abbr: resolution.resolvedState || '',
    locality_name: resolution.localityName || '',
    zip_code: resolution.resolvedZip,
    work_gpci: resolution.gpci.work,
    pe_gpci: resolution.gpci.pe,
    mp_gpci: resolution.gpci.mp
  };
}

/**
 * Fetch MPFS benchmark data with enhanced result info
 */
async function fetchMpfsBenchmark(
  hcpcs: string,
  year: number,
  modifier: string
): Promise<{ row: MpfsBenchmarkRow | null; modifierFallback: boolean; queryAttempt: MpfsQueryAttempt }> {
  const normalizedCode = hcpcs.trim().toUpperCase();
  const normalizedModifier = modifier ? modifier.trim().toUpperCase() : '';
  
  const queryAttempt: MpfsQueryAttempt = {
    hcpcs: normalizedCode,
    modifier: normalizedModifier || '',
    year,
    qp_status: 'nonQP',
    source: 'CMS MPFS',
    result_count: 0,
    row_exists: false,
    has_fee: false,
    has_rvu: false,
    status_code: null
  };
  
  // Try exact modifier match first
  if (normalizedModifier) {
    const { data, count } = await supabase
      .from('mpfs_benchmarks')
      .select('*', { count: 'exact' })
      .eq('hcpcs', normalizedCode)
      .eq('year', year)
      .eq('qp_status', 'nonQP')
      .eq('modifier', normalizedModifier)
      .limit(1)
      .maybeSingle();
    
    if (data) {
      const row = data as MpfsBenchmarkRow;
      queryAttempt.result_count = count || 1;
      queryAttempt.row_exists = true;
      queryAttempt.status_code = row.status;
      queryAttempt.has_fee = (row.nonfac_fee !== null && row.nonfac_fee > 0) || 
                             (row.fac_fee !== null && row.fac_fee > 0);
      queryAttempt.has_rvu = (row.work_rvu !== null && row.work_rvu > 0) ||
                             (row.nonfac_pe_rvu !== null && row.nonfac_pe_rvu > 0) ||
                             (row.fac_pe_rvu !== null && row.fac_pe_rvu > 0) ||
                             (row.mp_rvu !== null && row.mp_rvu > 0);
      return { row, modifierFallback: false, queryAttempt };
    }
  }
  
  // Try without modifier (base code)
  const { data, count } = await supabase
    .from('mpfs_benchmarks')
    .select('*', { count: 'exact' })
    .eq('hcpcs', normalizedCode)
    .eq('year', year)
    .eq('qp_status', 'nonQP')
    .eq('modifier', '')
    .limit(1)
    .maybeSingle();
  
  if (data) {
    const row = data as MpfsBenchmarkRow;
    queryAttempt.modifier = '';
    queryAttempt.result_count = count || 1;
    queryAttempt.row_exists = true;
    queryAttempt.status_code = row.status;
    queryAttempt.has_fee = (row.nonfac_fee !== null && row.nonfac_fee > 0) || 
                           (row.fac_fee !== null && row.fac_fee > 0);
    queryAttempt.has_rvu = (row.work_rvu !== null && row.work_rvu > 0) ||
                           (row.nonfac_pe_rvu !== null && row.nonfac_pe_rvu > 0) ||
                           (row.fac_pe_rvu !== null && row.fac_pe_rvu > 0) ||
                           (row.mp_rvu !== null && row.mp_rvu > 0);
    return { 
      row, 
      modifierFallback: normalizedModifier ? true : false,
      queryAttempt 
    };
  }
  
  return { row: null, modifierFallback: false, queryAttempt };
}

/**
 * Fetch MPFS benchmark data with year fallback
 */
async function fetchMpfsBenchmarkWithFallback(
  hcpcs: string,
  requestedYear: number,
  latestYear: number,
  modifier?: string
): Promise<{ 
  row: MpfsBenchmarkRow | null; 
  yearUsed: number; 
  usedFallback: boolean; 
  modifierFallback: boolean;
  queries: MpfsQueryAttempt[];
}> {
  const normalizedCode = hcpcs.trim().toUpperCase();
  const normalizedModifier = modifier ? modifier.trim().toUpperCase() : '';
  const queries: MpfsQueryAttempt[] = [];
  
  // Try requested year first
  let result = await fetchMpfsBenchmark(normalizedCode, requestedYear, normalizedModifier);
  queries.push(result.queryAttempt);
  
  if (result.row) {
    return { 
      row: result.row, 
      yearUsed: requestedYear, 
      usedFallback: false, 
      modifierFallback: result.modifierFallback,
      queries
    };
  }
  
  // If requested year not found and it's different from latest, try latest year
  if (requestedYear !== latestYear) {
    result = await fetchMpfsBenchmark(normalizedCode, latestYear, normalizedModifier);
    queries.push(result.queryAttempt);
    
    if (result.row) {
      return { 
        row: result.row, 
        yearUsed: latestYear, 
        usedFallback: true,
        modifierFallback: result.modifierFallback,
        queries
      };
    }
  }
  
  return { 
    row: null, 
    yearUsed: latestYear, 
    usedFallback: requestedYear !== latestYear, 
    modifierFallback: false,
    queries
  };
}

// ============= OPPS Lookup for Facility Settings =============

interface OppsRow {
  hcpcs: string;
  apc: string | null;
  status_indicator: string | null;
  payment_rate: number | null;
  relative_weight: number | null;
  short_desc: string | null;
  year: number;
}

/**
 * Lookup OPPS (Hospital Outpatient PPS) rate for a code
 * Used for facility-based settings (hospital, ER, ambulatory surgery centers)
 */
async function lookupOppsRate(hcpcs: string): Promise<{ 
  rate: number | null; 
  source: 'opps_db' | 'opps_fallback' | null;
  description: string | null;
}> {
  const normalizedCode = hcpcs.trim().toUpperCase();
  console.log(`[OPPS Lookup] === Starting lookup for ${normalizedCode} ===`);
  
  // Step 1: Try database lookup
  try {
    const { data, error } = await supabase
      .from('opps_addendum_b')
      .select('*')
      .eq('hcpcs', normalizedCode)
      .eq('year', OPPS_YEAR)
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error(`[OPPS Lookup] Database error:`, error.message);
    }
    
    if (data && data.payment_rate !== null && data.payment_rate > 0) {
      console.log(`[OPPS Lookup] SUCCESS from database: ${normalizedCode} = $${data.payment_rate}`);
      return { 
        rate: data.payment_rate, 
        source: 'opps_db',
        description: data.short_desc || null
      };
    } else {
      console.log(`[OPPS Lookup] Database returned no valid data for ${normalizedCode}`);
    }
  } catch (err) {
    console.error(`[OPPS Lookup] Exception during database lookup:`, err);
  }
  
  // Step 2: Try hardcoded fallback for common hospital codes
  if (OPPS_FALLBACK_RATES[normalizedCode]) {
    const fallback = OPPS_FALLBACK_RATES[normalizedCode];
    console.log(`[OPPS Lookup] SUCCESS from FALLBACK: ${normalizedCode} = $${fallback.payment_rate}`);
    return { 
      rate: fallback.payment_rate, 
      source: 'opps_fallback',
      description: fallback.short_desc || 'Hospital outpatient service'
    };
  }
  
  console.log(`[OPPS Lookup] FAILED: No data found for ${normalizedCode}`);
  return { rate: null, source: null, description: null };
}

// ============= CLFS Lookup for Lab Codes =============

// CLFS lab code ranges - includes numeric lab codes, PLA codes, and specific G/P codes
const CLFS_CODE_PATTERNS = [
  /^8[0-9]{4}$/,           // 80000-89999 - Standard lab codes
  /^0[0-9]{3}U$/,          // 0001U-0999U - PLA codes
  /^G010[3-4]$/,           // G0103-G0104 - PSA screening
  /^G012[3-4]$/,           // G0123-G0124 - Pap smear
  /^G014[1-8]$/,           // G0141-G0148 - Pap smear related
  /^P[2-9][0-9]{3}$/,      // P2028-P9615 - Pathology codes
];

// CLFS Fallback rates for common lab codes (2026 rates)
// Used when CLFS database table is empty or lookup fails
const CLFS_FALLBACK_RATES: Record<string, { rate: number; desc: string }> = {
  '80053': { rate: 14.49, desc: 'Comprehensive metabolic panel' },
  '80048': { rate: 11.26, desc: 'Basic metabolic panel (8 components)' },
  '80050': { rate: 22.00, desc: 'General health panel' },
  '80061': { rate: 18.44, desc: 'Lipid panel' },
  '80076': { rate: 12.00, desc: 'Hepatic function panel' },
  '85025': { rate: 10.66, desc: 'Complete blood count (CBC) with diff' },
  '85027': { rate: 7.77, desc: 'Complete blood count (CBC)' },
  '81001': { rate: 4.02, desc: 'Urinalysis with microscopy' },
  '81003': { rate: 4.02, desc: 'Urinalysis automated' },
  '81025': { rate: 8.61, desc: 'Urine pregnancy test' },
  '82962': { rate: 3.00, desc: 'Glucose blood test' },
  '82947': { rate: 5.16, desc: 'Glucose quantitative' },
  '84443': { rate: 23.05, desc: 'TSH (thyroid stimulating hormone)' },
  '84439': { rate: 7.00, desc: 'Free thyroxine' },
  '83036': { rate: 13.33, desc: 'Hemoglobin A1c' },
  '82306': { rate: 38.00, desc: 'Vitamin D 25-Hydroxy' },
  '82728': { rate: 17.00, desc: 'Ferritin' },
  '82550': { rate: 8.00, desc: 'CK (creatine kinase)' },
  '82565': { rate: 6.00, desc: 'Creatinine' },
  '84132': { rate: 5.00, desc: 'Potassium' },
  '84295': { rate: 5.00, desc: 'Sodium' },
  '82270': { rate: 4.50, desc: 'Fecal occult blood test' },
  '87880': { rate: 16.00, desc: 'Strep test (rapid)' },
  '87804': { rate: 16.00, desc: 'Flu test (rapid)' },
  '87426': { rate: 51.33, desc: 'COVID-19 test (rapid)' },
  '36415': { rate: 3.00, desc: 'Venipuncture (blood draw)' },
};

/**
 * Check if a code is a Clinical Lab Fee Schedule code
 */
function isClfsCode(hcpcs: string): boolean {
  if (!hcpcs) return false;
  const normalized = hcpcs.trim().toUpperCase();
  return CLFS_CODE_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Check if a code is a J-code (drug/injection)
 */
function isJCode(hcpcs: string): boolean {
  if (!hcpcs) return false;
  return hcpcs.trim().toUpperCase().startsWith('J');
}

/**
 * Check if a code is a hospital revenue code (4 digits starting with 0)
 */
export function isRevenueCode(code: string): boolean {
  if (!code) return false;
  return /^0\d{3}$/.test(code.trim());
}

/**
 * Check if a code is an S-code (private payer code)
 */
export function isSCode(code: string): boolean {
  if (!code) return false;
  return code.trim().toUpperCase().startsWith('S');
}

/**
 * Get description for a revenue code
 */
function getRevenueCodeDescription(code: string): string {
  const normalized = code.trim();
  return REVENUE_CODE_DESCRIPTIONS[normalized] || 'Hospital billing category';
}

/**
 * Lookup drug ASP (Average Sales Price) for a J-code
 * Medicare pays ASP + 6% for separately payable drugs
 */
function lookupDrugAsp(hcpcs: string, units: number = 1): { 
  aspPerUnit: number | null; 
  totalAsp: number | null;
  description: string | null;
  unit: string | null;
  typicalDose: number;
} {
  const normalizedCode = hcpcs.trim().toUpperCase();
  console.log(`[Drug ASP] Looking up: ${normalizedCode}`);
  
  const aspData = DRUG_ASP_FALLBACK[normalizedCode];
  if (aspData && aspData.asp > 0) {
    const totalAsp = aspData.asp * aspData.typicalDose;
    console.log(`[Drug ASP] Found: ${normalizedCode} = $${aspData.asp} ${aspData.unit} × ${aspData.typicalDose} = $${totalAsp.toFixed(2)} (${aspData.desc})`);
    return {
      aspPerUnit: aspData.asp,
      totalAsp,
      description: aspData.desc,
      unit: aspData.unit,
      typicalDose: aspData.typicalDose
    };
  }
  
  console.log(`[Drug ASP] Not found: ${normalizedCode}`);
  return { aspPerUnit: null, totalAsp: null, description: null, unit: null, typicalDose: 1 };
}

/**
 * Lookup CLFS (Clinical Lab Fee Schedule) rate for a lab code
 * Checks database first, falls back to hardcoded rates if not found
 */
async function lookupClfsRate(hcpcs: string): Promise<{ rate: number | null; source: 'clfs_rate' | null; description: string | null }> {
  const normalizedCode = hcpcs.trim().toUpperCase();
  console.log(`[CLFS Lookup] === Starting lookup for ${normalizedCode} ===`);
  
  // Step 1: Try database lookup
  try {
    const { data, error } = await supabase
      .from('clfs_fee_schedule')
      .select('*')
      .eq('hcpcs', normalizedCode)
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error(`[CLFS Lookup] Database error:`, error.message);
    } else if (data && data.payment_amount !== null && data.payment_amount > 0) {
      console.log(`[CLFS Lookup] SUCCESS from database: ${normalizedCode} = $${data.payment_amount}`);
      return { 
        rate: data.payment_amount, 
        source: 'clfs_rate',
        description: data.short_desc || data.long_desc || null
      };
    } else {
      console.log(`[CLFS Lookup] No data in database for ${normalizedCode}`);
    }
  } catch (err) {
    console.error(`[CLFS Lookup] Exception during database lookup:`, err);
  }
  
  // Step 2: Try hardcoded fallback rates for common lab codes
  const fallback = CLFS_FALLBACK_RATES[normalizedCode];
  if (fallback) {
    console.log(`[CLFS Lookup] SUCCESS from FALLBACK: ${normalizedCode} = $${fallback.rate} (${fallback.desc})`);
    return { 
      rate: fallback.rate, 
      source: 'clfs_rate',
      description: fallback.desc
    };
  }
  
  console.log(`[CLFS Lookup] FAILED: No data found for ${normalizedCode}`);
  return { rate: null, source: null, description: null };
}

// ============= Better Explanations for Unmatched Codes =============

/**
 * Generate explanation for why a code couldn't be benchmarked
 */
function getUnmatchedCodeExplanation(hcpcs: string, matchStatus: MatchStatus, notPricedReason: NotPricedReason, isFacility: boolean): string {
  const code = hcpcs?.toUpperCase() || '';
  
  // J-codes (drugs) - check if we have ASP data
  if (code.startsWith('J')) {
    const aspData = DRUG_ASP_FALLBACK[code];
    if (aspData) {
      return `Drug code (${aspData.desc}) - Medicare ASP reference: ~$${aspData.asp.toFixed(2)} ${aspData.unit}. Hospital markup typically 3-5× this rate.`;
    }
    return 'Drug code - Medicare pays ASP + 6%. Hospital markup on drugs typically ranges 200-500% of Medicare rates.';
  }
  
  // S-codes (private payer)
  if (code.startsWith('S')) {
    return 'Private payer code - no Medicare benchmark available. These codes are used only by commercial insurers.';
  }
  
  // C-codes (hospital outpatient specific)
  if (code.startsWith('C')) {
    return 'Hospital outpatient code - used exclusively for facility billing. May be packaged into other services.';
  }
  
  // Bundled/packaged under OPPS
  if (isFacility && (notPricedReason === 'status_indicator_nonpayable' || matchStatus === 'exists_not_priced')) {
    return 'Packaged into facility fee under hospital billing - typically included in another charge.';
  }
  
  // Revenue codes (4 digits)
  if (/^\d{4}$/.test(code)) {
    return 'Revenue code - hospital billing category, not a service code. Used for facility tracking.';
  }
  
  // Default for missing
  if (matchStatus === 'missing') {
    return 'This code is not in our Medicare reference dataset. It may be facility-specific or newly created.';
  }
  
  // Default for exists but not priced
  if (matchStatus === 'exists_not_priced') {
    if (notPricedReason === 'rvus_zero_or_missing') {
      return 'Medicare does not assign a national rate to this code - it may be carrier-priced or bundled with other services.';
    }
    return 'This code exists in Medicare tables but doesn\'t have a payable reference rate.';
  }
  
  return 'No Medicare benchmark available for this code.';
}

// ============= STEP 4: Fee Calculation =============

/**
 * STEP 4: Calculate Medicare fee using RVUs and GPCI
 * 
 * Formula: Fee = [(Work RVU × Work GPCI) + (PE RVU × PE GPCI) + (MP RVU × MP GPCI)] × CF
 * 
 * Priority:
 * 1. If GPCI available: compute locality-adjusted fee from RVUs (rvu_calc_local)
 * 2. If no GPCI but RVUs available: compute national fee from RVUs (rvu_calc_national)
 * 3. Fall back to direct fee column only in national_estimate mode (direct_fee)
 */
function calculateMedicareFee(
  benchmark: MpfsBenchmarkRow,
  gpci: GpciLocalityRow | null,
  isFacility: boolean = false,
  confidence: ConfidenceLevel
): { 
  fee: number | null; 
  feeSource: FeeSource; 
  notPricedReason: NotPricedReason;
  gpciApplied: boolean;
} {
  // Check for non-payable status codes
  if (benchmark.status && NON_PAYABLE_STATUS_CODES.includes(benchmark.status.toUpperCase())) {
    return { 
      fee: null, 
      feeSource: null, 
      notPricedReason: 'status_indicator_nonpayable',
      gpciApplied: false
    };
  }
  
  // Get RVUs
  const workRvu = benchmark.work_rvu ?? 0;
  const mpRvu = benchmark.mp_rvu ?? 0;
  const peRvu = isFacility 
    ? (benchmark.fac_pe_rvu ?? 0) 
    : (benchmark.nonfac_pe_rvu ?? 0);
  
  const hasWorkRvu = workRvu > 0;
  const hasPeRvu = peRvu > 0;
  const hasMpRvu = mpRvu > 0;
  const hasAnyRvu = hasWorkRvu || hasPeRvu || hasMpRvu;
  
  // Get conversion factor
  const cf = benchmark.conversion_factor ?? DEFAULT_CONVERSION_FACTOR;
  if (!cf) {
    return { 
      fee: null, 
      feeSource: null, 
      notPricedReason: 'conversion_factor_missing',
      gpciApplied: false
    };
  }
  
  // If we have RVUs, prefer RVU calculation
  if (hasAnyRvu) {
    if (gpci && (confidence === 'local_adjusted' || confidence === 'state_estimate')) {
      // STEP 4: Locality-adjusted calculation
      const adjustedFee = (
        (workRvu * gpci.work_gpci) +
        (peRvu * gpci.pe_gpci) +
        (mpRvu * gpci.mp_gpci)
      ) * cf;
      
      return { 
        fee: Math.round(adjustedFee * 100) / 100, 
        feeSource: 'rvu_calc_local',
        notPricedReason: null,
        gpciApplied: true
      };
    }
    
    // National RVU calculation (no GPCI)
    const nationalFee = (workRvu + peRvu + mpRvu) * cf;
    return { 
      fee: Math.round(nationalFee * 100) / 100, 
      feeSource: 'rvu_calc_national',
      notPricedReason: null,
      gpciApplied: false
    };
  }
  
  // No RVUs - try direct fee as fallback (only in national mode)
  const directFee = isFacility ? benchmark.fac_fee : benchmark.nonfac_fee;
  
  if (directFee !== null && typeof directFee === 'number' && directFee > 0) {
    return { 
      fee: Math.round(directFee * 100) / 100, 
      feeSource: 'direct_fee',
      notPricedReason: null,
      gpciApplied: false
    };
  }
  
  // Check if fees are missing
  const hasFee = (benchmark.nonfac_fee !== null && benchmark.nonfac_fee > 0) || 
                 (benchmark.fac_fee !== null && benchmark.fac_fee > 0);
  
  if (!hasFee && !hasAnyRvu) {
    return { 
      fee: null, 
      feeSource: null, 
      notPricedReason: 'rvus_zero_or_missing',
      gpciApplied: false
    };
  }
  
  return { 
    fee: null, 
    feeSource: null, 
    notPricedReason: 'fees_missing',
    gpciApplied: false
  };
}

/**
 * Determine pricing status based on percent of Medicare
 */
function determineStatus(percentOfMedicare: number): 'fair' | 'high' | 'very_high' {
  if (percentOfMedicare <= FAIR_THRESHOLD) return 'fair';
  if (percentOfMedicare <= HIGH_THRESHOLD) return 'high';
  return 'very_high';
}

/**
 * Check if a code has global surgery bundling
 */
function checkBundling(benchmark: MpfsBenchmarkRow): boolean {
  return BUNDLED_GLOBAL_DAYS.includes(benchmark.global_days || '');
}

/**
 * Extract service year from date string
 */
function extractYearFromDate(dateOfService?: string): number | null {
  if (!dateOfService) return null;
  
  try {
    const date = new Date(dateOfService);
    const year = date.getFullYear();
    if (year >= 1990 && year <= 2030) {
      return year;
    }
  } catch {
    const yearMatch = dateOfService.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      return parseInt(yearMatch[0], 10);
    }
  }
  
  return null;
}

// ============= Main Service Function =============

/**
 * Calculate Medicare benchmarks for a list of bill line items
 */
export async function calculateMedicareBenchmarks(
  lineItems: BenchmarkLineItem[],
  state: string,
  zipCode?: string
): Promise<MedicareBenchmarkOutput> {
  console.log('========== MEDICARE BENCHMARK SERVICE START ==========');
  console.log('[Benchmark] lineItems count:', lineItems.length);
  console.log('[Benchmark] lineItems:', lineItems.map(i => `${i.hcpcs} (isFacility: ${i.isFacility})`).join(', '));
  console.log('[Benchmark] state:', state, 'zipCode:', zipCode);
  
  // Clear caches at start of new calculation
  clearMpfsYearCache();
  clearRateCache();
  
  const results: BenchmarkLineResult[] = [];
  const rawCodesExtracted: string[] = [];
  const normalizedCodes: NormalizedCode[] = [];
  const validatedCodes: ValidatedCode[] = [];
  const rejectedTokens: RejectedToken[] = [];
  const codesMatched: string[] = [];
  const codesMissing: string[] = [];
  const codesExistsNotPriced: string[] = [];
  const queriesAttempted: MpfsQueryAttempt[] = [];
  const requestedYears: number[] = [];
  const metadataNotes: string[] = [];
  
  let totalBilled = 0;
  let billedTotalDetected = false;
  let totalMedicareReference = 0;
  let hasAnyBenchmark = false;
  let usedYearFallback = false;
  let fallbackReason: string | null = null;
  
  // Get the latest MPFS year available
  const latestMpfsYear = await getLatestMpfsYear();
  
  // STEP 3: Resolve locality using new geoResolver
  const geoResolution = await resolveGeo(zipCode, state);
  const gpci = createGpciFromResolution(geoResolution);
  const confidence = geoMethodToConfidence(geoResolution.method);
  const localityName = geoResolution.localityName;
  const localityCode = geoResolution.localityNum;
  
  // Validate ZIP format
  const normalizedZip = zipCode ? zipCode.trim().substring(0, 5) : null;
  const zipValid = normalizedZip ? /^\d{5}$/.test(normalizedZip) : false;
  
  // Determine fallback used
  let fallbackUsed: 'none' | 'state_estimate' | 'national_estimate' | 'zip_unmapped' = 'none';
  if (geoResolution.method === 'zip_exact') {
    fallbackUsed = 'none';
  } else if (geoResolution.method === 'zip_to_state_avg') {
    fallbackUsed = 'zip_unmapped';
  } else if (geoResolution.method === 'state_avg') {
    fallbackUsed = 'state_estimate';
  } else {
    fallbackUsed = 'national_estimate';
  }

  // GPCI lookup debug info
  const gpciLookup = {
    attempted: !!(zipCode || state),
    zipUsed: zipCode || null,
    stateUsed: state || null,
    localityFound: gpci !== null,
    localityName: localityName,
    localityCode: localityCode,
    workGpci: geoResolution.gpci.work,
    peGpci: geoResolution.gpci.pe,
    mpGpci: geoResolution.gpci.mp,
    method: geoResolution.method
  };

  const geoDebug: GeoDebugInfo = {
    zipInput: zipCode || null,
    zipValid,
    stateInput: state || null,
    localityFound: gpci !== null,
    localityNum: localityCode,
    localityName,
    fallbackUsed,
    method: geoResolution.method,
    workGpci: geoResolution.gpci.work,
    peGpci: geoResolution.gpci.pe,
    mpGpci: geoResolution.gpci.mp,
    messageToUser: geoResolution.userMessage,
    confidence: geoResolution.confidence,
    notes: geoResolution.notes
  };

  // ============= BATCH PRE-FETCH ALL CODES =============
  // Collect all codes first, then batch fetch to reduce database round trips
  console.log('[Benchmark] Pre-fetching all codes in batch...');
  
  // Separate codes by type for batch fetching
  const allCodes: string[] = [];
  const facilityCodes: string[] = [];
  const labCodes: string[] = [];
  const officeCodes: string[] = [];
  
  for (const item of lineItems) {
    const rawCode = item.rawCode || item.hcpcs;
    const validated = normalizeAndValidateCode(rawCode);
    if (validated.kind !== 'invalid' && validated.code) {
      const code = validated.code;
      allCodes.push(code);
      
      if (item.isFacility) {
        facilityCodes.push(code);
      }
      if (isClfsCode(code)) {
        labCodes.push(code);
      }
      if (!item.isFacility) {
        officeCodes.push(code);
      }
    }
  }
  
  // Batch fetch all data in parallel
  const [batchedMpfs, batchedOpps, batchedClfs] = await Promise.all([
    batchFetchMpfsBenchmarks([...new Set(allCodes)], latestMpfsYear),
    batchFetchOppsRates([...new Set(facilityCodes)]),
    batchFetchClfsRates([...new Set(labCodes)])
  ]);
  
  console.log(`[Benchmark] Batch pre-fetch complete. MPFS: ${Object.keys(batchedMpfs).length}, OPPS: ${Object.keys(batchedOpps).length}, CLFS: ${Object.keys(batchedClfs).length}`);

  // Process each line item
  for (const item of lineItems) {
    // Track billed amount (allow null)
    if (item.billedAmount !== null && item.billedAmount !== undefined && item.billedAmount > 0) {
      totalBilled += item.billedAmount;
      billedTotalDetected = true;
    }
    
    // Track raw code
    const rawCode = item.rawCode || item.hcpcs;
    rawCodesExtracted.push(rawCode);
    
    // Use strict validation with the new validator
    const validated = normalizeAndValidateCode(rawCode);
    validatedCodes.push(validated);
    
    // Normalize the code (legacy, for compatibility)
    const normalized = normalizeCode(rawCode);
    normalizedCodes.push(normalized);
    
    // Skip if code is not valid after strict validation
    if (validated.kind === 'invalid' || !validated.code) {
      // Track rejected token
      rejectedTokens.push({
        token: rawCode,
        reason: validated.reason || 'Unknown validation failure'
      });
      
      codesMissing.push(rawCode);
      results.push({
        hcpcs: normalized.hcpcs || rawCode,
        modifier: normalized.modifier,
        description: item.description || null,
        billedAmount: item.billedAmount,
        units: item.units,
        medicareReferencePerUnit: null,
        medicareReferenceTotal: null,
        multiple: null,
        status: 'unknown',
        matchStatus: 'missing',
        benchmarkYearUsed: null,
        requestedYear: null,
        notes: [`Invalid or unrecognized code format: "${rawCode}" (${validated.reason || 'not a valid CPT/HCPCS code'})`],
        exclusionReason: 'no_valid_code',
        feeSource: null,
        notPricedReason: null
      });
      continue;
    }
    
    // Use validated code and modifier
    normalized.hcpcs = validated.code;
    if (validated.modifier) {
      normalized.modifier = validated.modifier;
    }
    
    // Determine the year to request
    const serviceYear = extractYearFromDate(item.dateOfService);
    const yearToRequest = serviceYear || latestMpfsYear;
    
    if (!requestedYears.includes(yearToRequest)) {
      requestedYears.push(yearToRequest);
    }
    
    // Check if this is a facility-based item
    const isFacility = item.isFacility === true;
    console.log(`[Benchmark] Processing ${normalized.hcpcs}, isFacility: ${isFacility}`);
    
    // === SPECIAL CODE HANDLING (before standard lookup) ===
    
    // Handle S-codes (private payer codes - no Medicare equivalent)
    if (isSCode(normalized.hcpcs)) {
      console.log(`[Benchmark] S-code detected: ${normalized.hcpcs}`);
      codesMissing.push(normalized.hcpcs);
      results.push({
        hcpcs: normalized.hcpcs,
        modifier: normalized.modifier,
        description: item.description || 'Private payer code',
        billedAmount: item.billedAmount,
        units: item.units,
        medicareReferencePerUnit: null,
        medicareReferenceTotal: null,
        multiple: null,
        status: 'unknown',
        matchStatus: 'missing',
        benchmarkYearUsed: null,
        requestedYear: yearToRequest,
        notes: ['S-codes are private payer codes without Medicare equivalents. This code represents a specific supply or service defined by your insurer.'],
        exclusionReason: 's_code_no_medicare',
        feeSource: 's_code',
        notPricedReason: null
      });
      continue;
    }
    
    // Handle revenue codes (hospital billing categories - 4 digits starting with 0)
    if (isRevenueCode(normalized.hcpcs)) {
      console.log(`[Benchmark] Revenue code detected: ${normalized.hcpcs}`);
      const revDesc = getRevenueCodeDescription(normalized.hcpcs);
      codesMissing.push(normalized.hcpcs);
      results.push({
        hcpcs: normalized.hcpcs,
        modifier: normalized.modifier,
        description: item.description || revDesc,
        billedAmount: item.billedAmount,
        units: item.units,
        medicareReferencePerUnit: null,
        medicareReferenceTotal: null,
        multiple: null,
        status: 'unknown',
        matchStatus: 'missing',
        benchmarkYearUsed: null,
        requestedYear: yearToRequest,
        notes: [`Revenue code ${normalized.hcpcs} (${revDesc}) is a billing category. Ask for an itemized bill with CPT codes for specific comparison.`],
        exclusionReason: 'revenue_code',
        feeSource: 'revenue_code',
        notPricedReason: null
      });
      continue;
    }
    
    // Handle J-codes (drugs) - use ASP fallback if available
    if (isJCode(normalized.hcpcs)) {
      console.log(`[Benchmark] J-code (drug) detected: ${normalized.hcpcs}`);
      const aspLookup = lookupDrugAsp(normalized.hcpcs, item.units);
      
      if (aspLookup.aspPerUnit !== null && aspLookup.totalAsp !== null) {
        // Found ASP data for this drug
        const medicarePays = aspLookup.totalAsp * 1.06; // Medicare pays ASP + 6%
        const units = item.units > 0 ? item.units : 1;
        
        // Calculate markup if billed amount is available
        const markup = (item.billedAmount !== null && item.billedAmount > 0 && medicarePays > 0)
          ? Math.round((item.billedAmount / medicarePays) * 10) / 10
          : null;
        
        codesMatched.push(normalized.hcpcs);
        hasAnyBenchmark = true;
        totalMedicareReference += medicarePays;
        
        const notes = [
          `Drug: ${aspLookup.description}`,
          `Medicare ASP reference: $${aspLookup.aspPerUnit.toFixed(2)} ${aspLookup.unit}`,
          `Medicare pays ASP + 6% = $${medicarePays.toFixed(2)}`
        ];
        if (markup !== null) {
          notes.push(`Hospital markup: ${markup}× Medicare rate`);
          if (markup > 5) {
            notes.push('⚠️ Drug markup above 500% of Medicare rate is common in hospital settings');
          }
        }
        
        results.push({
          hcpcs: normalized.hcpcs,
          modifier: normalized.modifier,
          description: aspLookup.description || item.description || 'Injectable drug',
          billedAmount: item.billedAmount,
          units,
          medicareReferencePerUnit: aspLookup.aspPerUnit * 1.06,
          medicareReferenceTotal: medicarePays,
          multiple: markup,
          status: markup !== null && markup > 3 ? 'very_high' : markup !== null && markup > 2 ? 'high' : 'fair',
          matchStatus: 'matched',
          benchmarkYearUsed: 2026,
          requestedYear: yearToRequest,
          notes,
          gpciAdjusted: false,
          feeSource: 'asp_drug',
          notPricedReason: null
        });
        continue;
      }
      
      // No ASP data - still record as drug with explanation
      codesMissing.push(normalized.hcpcs);
      results.push({
        hcpcs: normalized.hcpcs,
        modifier: normalized.modifier,
        description: item.description || 'Injectable drug',
        billedAmount: item.billedAmount,
        units: item.units,
        medicareReferencePerUnit: null,
        medicareReferenceTotal: null,
        multiple: null,
        status: 'unknown',
        matchStatus: 'missing',
        benchmarkYearUsed: null,
        requestedYear: yearToRequest,
        notes: ['Drug code - Medicare pays ASP + 6%. Hospital markup on drugs typically ranges 200-500% of Medicare rates.'],
        exclusionReason: 'drug_no_asp',
        feeSource: 'asp_drug',
        notPricedReason: null
      });
      continue;
    }
    
    // === OPPS LOOKUP FOR FACILITY SETTINGS ===
    // For facility-based items (hospital, ER, ASC), try OPPS first
    if (isFacility) {
      console.log(`[Benchmark] >>> Taking FACILITY path for ${normalized.hcpcs} (will try OPPS first)`);
      
      // Check cache first
      const cached = getCachedRate(normalized.hcpcs, 'facility');
      if (cached && cached.rate !== null && cached.rate > 0) {
        console.log(`[Benchmark] CACHE HIT: Using cached OPPS rate $${cached.rate} for ${normalized.hcpcs}`);
        codesMatched.push(normalized.hcpcs);
        
        const units = item.units > 0 ? item.units : 1;
        const totalReference = cached.rate * units;
        
        const multiple = (item.billedAmount !== null && item.billedAmount > 0) 
          ? item.billedAmount / totalReference 
          : null;
        const percentOfMedicare = multiple !== null ? Math.round(multiple * 100) : null;
        const status = percentOfMedicare !== null ? determineStatus(percentOfMedicare) : 'unknown';
        
        hasAnyBenchmark = true;
        totalMedicareReference += totalReference;
        
        results.push({
          hcpcs: normalized.hcpcs,
          modifier: normalized.modifier,
          description: cached.description || item.description || null,
          billedAmount: item.billedAmount,
          units,
          medicareReferencePerUnit: cached.rate,
          medicareReferenceTotal: totalReference,
          multiple: multiple !== null ? Math.round(multiple * 100) / 100 : null,
          status,
          matchStatus: 'matched',
          benchmarkYearUsed: OPPS_YEAR,
          requestedYear: yearToRequest,
          notes: [`Using OPPS hospital outpatient rate ($${cached.rate.toFixed(2)})`],
          gpciAdjusted: false,
          feeSource: cached.source,
          notPricedReason: null
        });
        
        continue;
      }
      
      // Use batch-fetched data instead of individual query
      const batchedOppsResult = batchedOpps[normalized.hcpcs];
      const oppsResult = batchedOppsResult 
        ? { rate: batchedOppsResult.payment_rate, source: batchedOppsResult.source, description: batchedOppsResult.short_desc }
        : await lookupOppsRate(normalized.hcpcs); // Fallback to individual lookup if not in batch
      
      if (oppsResult.rate !== null && oppsResult.rate > 0) {
        // SUCCESS: Found OPPS rate - cache it
        setCachedRate(normalized.hcpcs, 'facility', {
          rate: oppsResult.rate,
          source: oppsResult.source === 'opps_fallback' ? 'opps_fallback' : 'opps_rate',
          description: oppsResult.description
        });
        
        console.log(`[Benchmark] SUCCESS: Using OPPS rate $${oppsResult.rate} for ${normalized.hcpcs}`);
        
        codesMatched.push(normalized.hcpcs);
        
        const units = item.units > 0 ? item.units : 1;
        const totalReference = oppsResult.rate * units;
        
        const multiple = (item.billedAmount !== null && item.billedAmount > 0) 
          ? item.billedAmount / totalReference 
          : null;
        const percentOfMedicare = multiple !== null ? Math.round(multiple * 100) : null;
        const status = percentOfMedicare !== null ? determineStatus(percentOfMedicare) : 'unknown';
        
        hasAnyBenchmark = true;
        totalMedicareReference += totalReference;
        
        const notes: string[] = [`Using OPPS hospital outpatient rate ($${oppsResult.rate.toFixed(2)})`];
        if (oppsResult.source === 'opps_fallback') {
          notes.push('Rate from hardcoded ER fallback table');
        }
        
        results.push({
          hcpcs: normalized.hcpcs,
          modifier: normalized.modifier,
          description: oppsResult.description || item.description || null,
          billedAmount: item.billedAmount,
          units,
          medicareReferencePerUnit: oppsResult.rate,
          medicareReferenceTotal: totalReference,
          multiple: multiple !== null ? Math.round(multiple * 100) / 100 : null,
          status,
          matchStatus: 'matched',
          benchmarkYearUsed: OPPS_YEAR,
          requestedYear: yearToRequest,
          notes,
          gpciAdjusted: false,
          feeSource: oppsResult.source === 'opps_fallback' ? 'opps_fallback' : 'opps_rate',
          notPricedReason: null
        });
        
        continue; // Move to next item
      }
      
      console.log(`[Benchmark] OPPS not found for ${normalized.hcpcs}, falling back to MPFS`);
    } else {
      console.log(`[Benchmark] >>> Taking OFFICE path for ${normalized.hcpcs} (will use MPFS)`);
    }
    
    // === CLFS LOOKUP FOR LAB CODES (80000-89999) ===
    // Check Clinical Lab Fee Schedule before MPFS for lab codes
    if (isClfsCode(normalized.hcpcs)) {
      console.log(`[Benchmark] Code ${normalized.hcpcs} is a lab code - trying CLFS first`);
      
      // Check cache first
      const cached = getCachedRate(normalized.hcpcs, 'lab');
      if (cached && cached.rate !== null && cached.rate > 0) {
        console.log(`[Benchmark] CACHE HIT: Using cached CLFS rate $${cached.rate} for ${normalized.hcpcs}`);
        codesMatched.push(normalized.hcpcs);
        
        const units = item.units > 0 ? item.units : 1;
        const totalReference = cached.rate * units;
        
        const multiple = (item.billedAmount !== null && item.billedAmount > 0) 
          ? item.billedAmount / totalReference 
          : null;
        const percentOfMedicare = multiple !== null ? Math.round(multiple * 100) : null;
        const status = percentOfMedicare !== null ? determineStatus(percentOfMedicare) : 'unknown';
        
        hasAnyBenchmark = true;
        totalMedicareReference += totalReference;
        
        results.push({
          hcpcs: normalized.hcpcs,
          modifier: normalized.modifier,
          description: cached.description || item.description || null,
          billedAmount: item.billedAmount,
          units,
          medicareReferencePerUnit: cached.rate,
          medicareReferenceTotal: totalReference,
          multiple: multiple !== null ? Math.round(multiple * 100) / 100 : null,
          status,
          matchStatus: 'matched',
          benchmarkYearUsed: 2026,
          requestedYear: yearToRequest,
          notes: [`Using Clinical Lab Fee Schedule rate ($${cached.rate.toFixed(2)})`],
          gpciAdjusted: false,
          feeSource: 'clfs_rate',
          notPricedReason: null
        });
        
        continue;
      }
      
      // Use batch-fetched data instead of individual query
      const batchedClfsResult = batchedClfs[normalized.hcpcs];
      const clfsResult = batchedClfsResult 
        ? { rate: batchedClfsResult.rate, source: 'clfs_rate' as const, description: batchedClfsResult.desc }
        : await lookupClfsRate(normalized.hcpcs); // Fallback to individual lookup if not in batch
      
      if (clfsResult.rate !== null && clfsResult.rate > 0) {
        // Cache the result
        setCachedRate(normalized.hcpcs, 'lab', {
          rate: clfsResult.rate,
          source: 'clfs_rate',
          description: clfsResult.description
        });
        console.log(`[Benchmark] SUCCESS: Using CLFS rate $${clfsResult.rate} for ${normalized.hcpcs}`);
        
        codesMatched.push(normalized.hcpcs);
        
        const units = item.units > 0 ? item.units : 1;
        const totalReference = clfsResult.rate * units;
        
        const multiple = (item.billedAmount !== null && item.billedAmount > 0) 
          ? item.billedAmount / totalReference 
          : null;
        const percentOfMedicare = multiple !== null ? Math.round(multiple * 100) : null;
        const status = percentOfMedicare !== null ? determineStatus(percentOfMedicare) : 'unknown';
        
        hasAnyBenchmark = true;
        totalMedicareReference += totalReference;
        
        const notes: string[] = [`Using Clinical Lab Fee Schedule rate ($${clfsResult.rate.toFixed(2)})`];
        
        results.push({
          hcpcs: normalized.hcpcs,
          modifier: normalized.modifier,
          description: clfsResult.description || item.description || null,
          billedAmount: item.billedAmount,
          units,
          medicareReferencePerUnit: clfsResult.rate,
          medicareReferenceTotal: totalReference,
          multiple: multiple !== null ? Math.round(multiple * 100) / 100 : null,
          status,
          matchStatus: 'matched',
          benchmarkYearUsed: 2026,
          requestedYear: yearToRequest,
          notes,
          gpciAdjusted: false,
          feeSource: 'clfs_rate',
          notPricedReason: null
        });
        
        continue; // Move to next item
      }
      
      console.log(`[Benchmark] CLFS not found for ${normalized.hcpcs}, falling back to MPFS`);
    }
    
    // === MPFS LOOKUP (office setting, or facility fallback) ===
    // Check cache first for MPFS
    const careSetting = isFacility ? 'mpfs_facility' : 'mpfs_office';
    const cachedMpfs = getCachedRate(normalized.hcpcs, careSetting);
    
    // Try to use batch-fetched MPFS data first
    let benchmark: MpfsBenchmarkRow | null = null;
    let yearUsed = latestMpfsYear;
    let usedFallback = false;
    let modifierFallback = false;
    const queries: MpfsQueryAttempt[] = [];
    
    // Check if we have batched data for this code
    const batchedBenchmark = batchedMpfs[normalized.hcpcs];
    if (batchedBenchmark) {
      benchmark = batchedBenchmark;
      console.log(`[Benchmark] Using batch-fetched MPFS data for ${normalized.hcpcs}`);
    } else {
      // Fall back to individual fetch if not in batch (different year or with modifier)
      const fetchResult = await fetchMpfsBenchmarkWithFallback(
        normalized.hcpcs,
        yearToRequest,
        latestMpfsYear,
        normalized.modifier || item.modifier
      );
      benchmark = fetchResult.row;
      yearUsed = fetchResult.yearUsed;
      usedFallback = fetchResult.usedFallback;
      modifierFallback = fetchResult.modifierFallback;
      queries.push(...fetchResult.queries);
    }
    
    // Track all queries
    queriesAttempted.push(...queries);
    
    if (usedFallback && !usedYearFallback) {
      usedYearFallback = true;
      fallbackReason = `Service year ${yearToRequest} not in MPFS; using ${yearUsed} (latest available)`;
      metadataNotes.push(fallbackReason);
    }
    
    // CASE 1: No MPFS row found at all -> missing_from_dataset
    if (!benchmark) {
      codesMissing.push(normalized.hcpcs);
      const explanation = getUnmatchedCodeExplanation(normalized.hcpcs, 'missing', null, isFacility);
      results.push({
        hcpcs: normalized.hcpcs,
        modifier: normalized.modifier,
        description: item.description || null,
        billedAmount: item.billedAmount,
        units: item.units,
        medicareReferencePerUnit: null,
        medicareReferenceTotal: null,
        multiple: null,
        status: 'unknown',
        matchStatus: 'missing',
        benchmarkYearUsed: null,
        requestedYear: yearToRequest,
        notes: [explanation],
        exclusionReason: 'not_in_mpfs',
        feeSource: null,
        notPricedReason: null
      });
      continue;
    }

    // CASE 2 & 3: Row exists - try to calculate fee
    const { fee: feePerUnit, feeSource, notPricedReason, gpciApplied } = calculateMedicareFee(
      benchmark, 
      gpci, 
      isFacility,
      confidence
    );
    
    // If fee could not be calculated -> exists_not_priced
    if (feePerUnit === null || feePerUnit <= 0) {
      codesExistsNotPriced.push(normalized.hcpcs);
      
      // Use the improved explanation generator
      const explanation = getUnmatchedCodeExplanation(normalized.hcpcs, 'exists_not_priced', notPricedReason, isFacility);
      
      results.push({
        hcpcs: normalized.hcpcs,
        modifier: normalized.modifier,
        description: benchmark.description || item.description || null,
        billedAmount: item.billedAmount,
        units: item.units,
        medicareReferencePerUnit: null,
        medicareReferenceTotal: null,
        multiple: null,
        status: 'unknown',
        matchStatus: 'exists_not_priced',
        benchmarkYearUsed: yearUsed,
        requestedYear: yearToRequest,
        notes: [explanation],
        exclusionReason: 'exists_not_priced',
        feeSource,
        notPricedReason
      });
      continue;
    }

    // CASE 4: Successfully priced -> matched
    codesMatched.push(normalized.hcpcs);

    // Calculate total with units
    const units = item.units > 0 ? item.units : 1;
    const totalReference = feePerUnit * units;
    
    // Calculate multiple only if we have a billed amount
    const multiple = (item.billedAmount !== null && item.billedAmount > 0) 
      ? item.billedAmount / totalReference 
      : null;
    const percentOfMedicare = multiple !== null ? Math.round(multiple * 100) : null;
    const status = percentOfMedicare !== null ? determineStatus(percentOfMedicare) : 'unknown';
    
    // Build notes
    const notes: string[] = [];
    
    // Note year fallback if used
    if (usedFallback) {
      notes.push(`Using ${yearUsed} Medicare reference (latest available)`);
    }
    
    // Note modifier fallback if used
    if (modifierFallback) {
      notes.push('Base code rate used (modifier-specific rate not found)');
    }
    
    // Note GPCI adjustment
    if (gpciApplied && localityName) {
      notes.push(`Adjusted for locality: ${localityName}`);
    }
    
    // Note fee source
    if (feeSource === 'rvu_calc_local') {
      notes.push('Computed from RVUs with geographic adjustment');
    } else if (feeSource === 'rvu_calc_national') {
      notes.push('Computed from RVUs (national rate)');
    }
    
    // Check for bundling
    const isBundled = checkBundling(benchmark);
    if (isBundled) {
      notes.push('This is a bundled/global surgery code - follow-up visits may be included');
    }
    
    // Add context message based on status
    if (status === 'fair') {
      notes.push('Within typical commercial insurance range');
    } else if (status === 'high') {
      notes.push('Higher than typical, may be negotiable');
    } else if (status === 'very_high') {
      notes.push('Significantly above standard rates - review recommended');
    } else if (status === 'unknown') {
      notes.push('Billed amount not detected - cannot calculate comparison');
    }

    hasAnyBenchmark = true;
    totalMedicareReference += totalReference;
    
    results.push({
      hcpcs: normalized.hcpcs,
      modifier: normalized.modifier,
      description: benchmark.description || item.description || null,
      billedAmount: item.billedAmount,
      units,
      medicareReferencePerUnit: feePerUnit,
      medicareReferenceTotal: Math.round(totalReference * 100) / 100,
      multiple: multiple !== null ? Math.round(multiple * 100) / 100 : null,
      status,
      matchStatus: 'matched',
      benchmarkYearUsed: yearUsed,
      requestedYear: yearToRequest,
      notes,
      isBundled,
      modifierFallbackUsed: modifierFallback,
      gpciAdjusted: gpciApplied,
      feeSource,
      notPricedReason: null
    });
  }

  // Debug summary
  console.log('========== MEDICARE BENCHMARK SERVICE COMPLETE ==========');
  console.log('[Benchmark] Results summary:');
  results.forEach(r => {
    console.log(`  ${r.hcpcs}: $${r.medicareReferencePerUnit} (${r.matchStatus}), feeSource: ${r.feeSource || 'none'}`);
  });
  console.log(`[Benchmark] Matched: ${codesMatched.length}, Missing: ${codesMissing.length}, ExistsNotPriced: ${codesExistsNotPriced.length}`);
  console.log('=========================================================');

  // === MATCHED-ITEMS COMPARISON (prevents scope mismatch) ===
  // Only sum billed amounts for items that have BOTH a billed amount AND a Medicare reference
  const matchedItems = results.filter(r => 
    r.matchStatus === 'matched' && 
    r.billedAmount !== null && 
    r.billedAmount > 0 && 
    r.medicareReferenceTotal !== null && 
    r.medicareReferenceTotal > 0
  );
  
  const matchedBilledTotal = matchedItems.length > 0
    ? Math.round(matchedItems.reduce((sum, r) => sum + (r.billedAmount || 0), 0) * 100) / 100
    : null;
  
  const matchedMedicareTotal = matchedItems.length > 0
    ? Math.round(matchedItems.reduce((sum, r) => sum + (r.medicareReferenceTotal || 0), 0) * 100) / 100
    : null;
  
  const matchedItemsMultiple = (matchedBilledTotal && matchedMedicareTotal && matchedMedicareTotal > 0)
    ? Math.round((matchedBilledTotal / matchedMedicareTotal) * 100) / 100
    : null;
  
  const totalItemsCount = lineItems.length;
  const matchedItemsCount = matchedItems.length;
  const coveragePercent = totalItemsCount > 0 
    ? Math.round((matchedItemsCount / totalItemsCount) * 100) 
    : null;
  
  // Generate scope warning if there's a mismatch
  let scopeWarning: string | null = null;
  const unmatchedCount = totalItemsCount - matchedItemsCount;
  if (unmatchedCount > 0 && matchedItemsCount > 0) {
    scopeWarning = `Only ${matchedItemsCount} of ${totalItemsCount} items could be matched. Totals reflect matched items only.`;
  } else if (matchedItemsCount === 0 && totalItemsCount > 0) {
    scopeWarning = 'No items could be matched to Medicare pricing. Comparison not available.';
  }
  
  // Comparison is only valid when we have matching scope
  const isValidComparison = matchedBilledTotal !== null && 
                            matchedMedicareTotal !== null && 
                            matchedItemsCount > 0;

  // Calculate overall multiple (legacy - uses all billed vs matched Medicare)
  const overallMultiple = (hasAnyBenchmark && totalMedicareReference > 0 && billedTotalDetected && totalBilled > 0)
    ? Math.round((totalBilled / totalMedicareReference) * 100) / 100
    : null;

  // Determine status
  let status: BenchmarkStatus = 'ok';
  if (lineItems.length === 0 || normalizedCodes.every(c => !isValidBillableCode(c))) {
    status = 'no_codes';
  } else if (!hasAnyBenchmark) {
    status = 'no_matches';
  } else if ((codesMissing.length > 0 || codesExistsNotPriced.length > 0) && codesMatched.length > 0) {
    status = 'partial';
  }

  const benchmarkYearUsed = usedYearFallback ? latestMpfsYear : (requestedYears[0] || latestMpfsYear);

  return {
    status,
    
    totals: {
      billedTotal: billedTotalDetected ? Math.round(totalBilled * 100) / 100 : null,
      billedTotalDetected,
      medicareReferenceTotal: hasAnyBenchmark ? Math.round(totalMedicareReference * 100) / 100 : null,
      multipleOfMedicare: overallMultiple,
      difference: (hasAnyBenchmark && billedTotalDetected) 
        ? Math.round((totalBilled - totalMedicareReference) * 100) / 100 
        : null
    },
    
    // NEW: Matched-items comparison
    matchedItemsComparison: {
      matchedBilledTotal,
      matchedMedicareTotal,
      matchedItemsMultiple,
      matchedItemsCount,
      totalItemsCount,
      coveragePercent,
      scopeWarning,
      isValidComparison
    },
    
    metadata: {
      localityUsed: confidence,
      localityName,
      localityCode,
      benchmarkYearUsed,
      requestedYears,
      usedYearFallback,
      fallbackReason,
      zip: zipCode || null,
      state: state?.toUpperCase() || null,
      notes: metadataNotes
    },
    
    lineItems: results,
    
    debug: {
      rawCodesExtracted,
      normalizedCodes,
      validatedCodes,
      rejectedTokens,
      codesMatched,
      codesMissing,
      codesExistsNotPriced,
      latestMpfsYear,
      queriesAttempted,
      gpciLookup,
      geoDebug,
      geoResolution
    },
    
    calculatedAt: new Date().toISOString(),
    
    // Legacy compatibility
    totalBilled: billedTotalDetected ? Math.round(totalBilled * 100) / 100 : 0,
    totalMedicareReference: hasAnyBenchmark ? Math.round(totalMedicareReference * 100) / 100 : null,
    multipleOfMedicare: overallMultiple,
    confidence,
    localityName,
    state: state?.toUpperCase() || null,
    codesNotFound: codesMissing,
    codesExcluded: codesExistsNotPriced,
    dataYear: benchmarkYearUsed
  };
}

// ============= Helper Functions for UI =============

/**
 * Generate user-friendly benchmark statement
 */
export function generateBenchmarkStatement(output: MedicareBenchmarkOutput): string {
  if (!output.totals.medicareReferenceTotal) {
    return "Medicare reference pricing data is not available for the services on this bill.";
  }

  const formatter = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0
  });

  const yearNote = output.metadata.usedYearFallback 
    ? ` (using ${output.metadata.benchmarkYearUsed} rates, the latest available)`
    : '';

  return `Medicare's reference price for these services is approximately ${formatter.format(output.totals.medicareReferenceTotal)}${yearNote}.`;
}

/**
 * Generate comparison sentence
 */
export function generateComparisonSentence(output: MedicareBenchmarkOutput): string | null {
  if (!output.totals.billedTotalDetected) {
    return "Billed total not detected from this document.";
  }
  
  if (!output.totals.multipleOfMedicare || !output.totals.medicareReferenceTotal) {
    return null;
  }

  return formatBillVsReferenceSentence(
    output.totals.billedTotal || 0,
    output.totals.medicareReferenceTotal
  );
}

/**
 * Generate confidence qualifier
 */
export function generateConfidenceQualifier(output: MedicareBenchmarkOutput): string {
  if (output.metadata.localityUsed === 'local_adjusted' && output.metadata.localityName) {
    const zipNote = output.metadata.zip ? ` (ZIP ${output.metadata.zip})` : '';
    return `Adjusted for your region: ${output.metadata.localityName}${zipNote}`;
  }
  if (output.metadata.localityUsed === 'state_estimate' && output.metadata.state) {
    return `Estimate based on ${output.metadata.state} (exact locality unknown)`;
  }
  return "National estimate (exact locality unknown)";
}

/**
 * Generate year fallback disclosure
 */
export function generateYearFallbackDisclosure(output: MedicareBenchmarkOutput): string | null {
  if (!output.metadata.usedYearFallback) {
    return null;
  }
  
  const requestedYear = output.metadata.requestedYears.find(y => y !== output.metadata.benchmarkYearUsed);
  if (!requestedYear) {
    return null;
  }
  
  return `Using ${output.metadata.benchmarkYearUsed} Medicare reference pricing (latest available) to provide a comparison. This is not the historical ${requestedYear} Medicare rate.`;
}

/**
 * Generate overall status message
 */
export function generateOverallStatus(output: MedicareBenchmarkOutput): {
  status: 'fair' | 'high' | 'very_high' | 'mixed' | 'unknown';
  message: string;
} {
  if (!output.totals.billedTotalDetected) {
    return {
      status: 'unknown',
      message: 'Billed total not detected. Medicare reference pricing is shown for context, but we cannot calculate a comparison multiple.'
    };
  }
  
  if (!output.totals.multipleOfMedicare) {
    return {
      status: 'unknown',
      message: 'Insufficient data to determine pricing comparison.'
    };
  }

  const percentOfMedicare = Math.round(output.totals.multipleOfMedicare * 100);
  
  // Check for mixed results
  const statusCounts = {
    fair: 0,
    high: 0,
    very_high: 0,
    unknown: 0
  };
  
  for (const item of output.lineItems) {
    statusCounts[item.status]++;
  }
  
  const hasHighItems = statusCounts.high > 0 || statusCounts.very_high > 0;
  const hasFairItems = statusCounts.fair > 0;
  
  if (hasHighItems && hasFairItems && output.lineItems.length > 1) {
    return {
      status: 'mixed',
      message: 'Commercial prices are often higher than Medicare, but large differences may indicate room for negotiation or review.'
    };
  }

  if (percentOfMedicare <= 200) {
    return {
      status: 'fair',
      message: 'Your charges are within the typical range for commercial insurance. Commercial prices are usually 100-200% of Medicare rates.'
    };
  } else if (percentOfMedicare <= 300) {
    return {
      status: 'high',
      message: 'Commercial prices are often higher than Medicare, but some of these charges may be worth discussing with the billing department.'
    };
  } else {
    return {
      status: 'very_high',
      message: 'Commercial prices are often higher than Medicare, but these charges are significantly above typical rates. This may indicate room for negotiation or review.'
    };
  }
}
