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

// ============= Types =============

export type ConfidenceLevel = 'local_adjusted' | 'state_estimate' | 'national_estimate';
export type BenchmarkStatus = 'ok' | 'no_codes' | 'no_matches' | 'partial';
export type MatchStatus = 'matched' | 'missing' | 'exists_not_priced';

// Fee source indicates how the Medicare fee was determined
export type FeeSource = 
  | 'direct_fee'          // Used pre-calculated fee from MPFS
  | 'rvu_calc_national'   // Computed from RVUs without GPCI
  | 'rvu_calc_local'      // Computed from RVUs with GPCI adjustment
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
  // Clear cache at start of new calculation
  clearMpfsYearCache();
  
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
    
    // Fetch MPFS benchmark with fallback
    const { row: benchmark, yearUsed, usedFallback, modifierFallback, queries } = 
      await fetchMpfsBenchmarkWithFallback(
        normalized.hcpcs,
        yearToRequest,
        latestMpfsYear,
        normalized.modifier || item.modifier
      );
    
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
        notes: ['We couldn\'t find this code in our Medicare dataset.'],
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
      item.isFacility,
      confidence
    );
    
    // If fee could not be calculated -> exists_not_priced
    if (feePerUnit === null || feePerUnit <= 0) {
      codesExistsNotPriced.push(normalized.hcpcs);
      
      // Build explanation based on reason
      let explanation = 'This code appears in Medicare\'s physician fee schedule tables, but a payable Medicare reference amount isn\'t available in our dataset for it';
      if (notPricedReason === 'rvus_zero_or_missing') {
        explanation += ' (often because it\'s carrier-priced, bundled, or not paid under MPFS).';
      } else if (notPricedReason === 'status_indicator_nonpayable') {
        explanation += ' (status indicator shows this code is not separately payable).';
      } else if (notPricedReason === 'conversion_factor_missing') {
        explanation += ' (conversion factor not available).';
      } else {
        explanation += '.';
      }
      
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

  // Calculate overall multiple
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

  const formatter = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0
  });

  return `Your bill of ${formatter.format(output.totals.billedTotal || 0)} is about ${output.totals.multipleOfMedicare}× higher than this reference price.`;
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
