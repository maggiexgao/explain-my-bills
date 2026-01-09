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
 * PHASE 1 FIX: Proper handling of "exists_not_priced" codes like 99140
 * PHASE 2 FIX: Enhanced GPCI locality adjustment with ZIP/State lookup
 */

import { supabase } from '@/integrations/supabase/client';

// ============= Types =============

export type ConfidenceLevel = 'local_adjusted' | 'state_estimate' | 'national_estimate';
export type BenchmarkStatus = 'ok' | 'no_codes' | 'no_matches' | 'partial';
export type MatchStatus = 'matched' | 'missing' | 'exists_not_priced';

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

export interface DebugInfo {
  rawCodesExtracted: string[];
  normalizedCodes: NormalizedCode[];
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
    workGpci: number | null;
    peGpci: number | null;
    mpGpci: number | null;
  };
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

// ============= Constants =============

// Default conversion factor (CY 2026)
const DEFAULT_CONVERSION_FACTOR = 34.6062;

// Status thresholds (percent of Medicare)
const FAIR_THRESHOLD = 200;    // <= 200% = fair
const HIGH_THRESHOLD = 300;    // <= 300% = high, > 300% = very_high

// Global surgery indicators that affect bundling
const BUNDLED_GLOBAL_DAYS = ['010', '090'];

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
 * 
 * Examples:
 * - "CPT 58662" -> { hcpcs: "58662", modifier: "" }
 * - "58662-59" -> { hcpcs: "58662", modifier: "59" }
 * - "0001F" -> { hcpcs: "0001F", modifier: "" }
 * - "99285 25" -> { hcpcs: "99285", modifier: "25" }
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
  // Valid patterns: 99285, 0001F, G0123, J1885, A0123
  const isValidHcpcs = /^[A-Z0-9]{4,5}$/.test(hcpcs);
  
  if (!isValidHcpcs) {
    // Maybe the raw input was just the code with extra stuff
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
 * 
 * DO NOT require 5 digits only - allow alphanumeric HCPCS
 */
export function isValidBillableCode(normalized: NormalizedCode): boolean {
  if (!normalized.hcpcs || normalized.hcpcs.length < 4) {
    return false;
  }
  
  // Must be alphanumeric, 4-5 characters
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

/**
 * Fetch GPCI locality data by ZIP code
 */
async function fetchGpciByZip(zipCode: string): Promise<GpciLocalityRow | null> {
  const zip5 = zipCode.trim().substring(0, 5);
  
  const { data, error } = await supabase
    .from('gpci_localities')
    .select('*')
    .eq('zip_code', zip5)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as GpciLocalityRow;
}

/**
 * Fetch GPCI locality data by state (returns first locality for state)
 */
async function fetchGpciByState(stateAbbr: string): Promise<GpciLocalityRow | null> {
  const { data, error } = await supabase
    .from('gpci_localities')
    .select('*')
    .eq('state_abbr', stateAbbr.toUpperCase())
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as GpciLocalityRow;
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
    has_rvu: false
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
      queryAttempt.has_fee = (row.nonfac_fee !== null && row.nonfac_fee > 0) || 
                             (row.fac_fee !== null && row.fac_fee > 0);
      queryAttempt.has_rvu = (row.work_rvu !== null && row.work_rvu > 0) ||
                             (row.nonfac_pe_rvu !== null && row.nonfac_pe_rvu > 0) ||
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
    queryAttempt.has_fee = (row.nonfac_fee !== null && row.nonfac_fee > 0) || 
                           (row.fac_fee !== null && row.fac_fee > 0);
    queryAttempt.has_rvu = (row.work_rvu !== null && row.work_rvu > 0) ||
                           (row.nonfac_pe_rvu !== null && row.nonfac_pe_rvu > 0) ||
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
 * Fetch MPFS benchmark data for a specific HCPCS code with year fallback
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

// ============= Calculation Functions =============

/**
 * Calculate Medicare fee using RVUs and GPCI
 * 
 * Formula: Fee = [(Work RVU × Work GPCI) + (PE RVU × PE GPCI) + (MP RVU × MP GPCI)] × CF
 * 
 * Returns: { fee: number | null, calculated: boolean, gpciApplied: boolean }
 */
function calculateGpciAdjustedFee(
  benchmark: MpfsBenchmarkRow,
  gpci: GpciLocalityRow | null,
  isFacility: boolean = false
): { fee: number | null; calculated: boolean; gpciApplied: boolean } {
  // First, check for pre-calculated fee
  const directFee = isFacility ? benchmark.fac_fee : benchmark.nonfac_fee;
  
  // Only use direct fee if it's a valid positive number
  if (directFee !== null && typeof directFee === 'number' && directFee > 0) {
    // If we have GPCI, we need to recalculate using RVUs
    // For now, use the national fee directly - GPCI adjustment requires RVUs
    if (!gpci) {
      return { 
        fee: Math.round(directFee * 100) / 100, 
        calculated: false, 
        gpciApplied: false 
      };
    }
    // Fall through to RVU calculation for GPCI adjustment
  }
  
  // Calculate from RVUs
  const workRvu = benchmark.work_rvu ?? 0;
  const mpRvu = benchmark.mp_rvu ?? 0;
  const peRvu = isFacility 
    ? (benchmark.fac_pe_rvu ?? 0) 
    : (benchmark.nonfac_pe_rvu ?? 0);

  // If no RVUs at all, use direct fee even if it's 0
  if (workRvu === 0 && peRvu === 0 && mpRvu === 0) {
    // This is the "exists_not_priced" case
    if (directFee !== null && directFee > 0) {
      return { fee: directFee, calculated: false, gpciApplied: false };
    }
    return { fee: null, calculated: false, gpciApplied: false };
  }

  // Get conversion factor (use stored or default)
  const cf = benchmark.conversion_factor ?? DEFAULT_CONVERSION_FACTOR;

  // Get GPCI factors (default to 1.0 for national)
  const workGpci = gpci?.work_gpci ?? 1.0;
  const peGpci = gpci?.pe_gpci ?? 1.0;
  const mpGpci = gpci?.mp_gpci ?? 1.0;

  // Calculate geographically adjusted fee
  const adjustedFee = (
    (workRvu * workGpci) +
    (peRvu * peGpci) +
    (mpRvu * mpGpci)
  ) * cf;

  return { 
    fee: Math.round(adjustedFee * 100) / 100, 
    calculated: true, 
    gpciApplied: gpci !== null 
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
    // Sanity check: year should be reasonable (1990-2030)
    if (year >= 1990 && year <= 2030) {
      return year;
    }
  } catch {
    // Try to extract year from string patterns like "MM/DD/YYYY" or "YYYY-MM-DD"
    const yearMatch = dateOfService.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      return parseInt(yearMatch[0], 10);
    }
  }
  
  return null;
}

/**
 * Determine if MPFS row exists but has no priceable data
 * This handles codes like 99140 that exist in MPFS but have 0 RVUs and null fees
 */
function isExistsNotPriced(benchmark: MpfsBenchmarkRow | null): boolean {
  if (!benchmark) return false;
  
  const hasFee = (benchmark.nonfac_fee !== null && benchmark.nonfac_fee > 0) || 
                 (benchmark.fac_fee !== null && benchmark.fac_fee > 0);
  const hasRvu = (benchmark.work_rvu !== null && benchmark.work_rvu > 0) ||
                 (benchmark.nonfac_pe_rvu !== null && benchmark.nonfac_pe_rvu > 0) ||
                 (benchmark.fac_pe_rvu !== null && benchmark.fac_pe_rvu > 0) ||
                 (benchmark.mp_rvu !== null && benchmark.mp_rvu > 0);
  
  // Row exists but no fee data and no meaningful RVUs
  return !hasFee && !hasRvu;
}

// ============= Main Service Function =============

/**
 * Calculate Medicare benchmarks for a list of bill line items
 * 
 * This is the main entry point for benchmark calculation.
 * It handles all the complexity of:
 * - Normalizing CPT/HCPCS codes
 * - Year fallback logic
 * - Fetching MPFS data for each code
 * - Applying GPCI geographic adjustments
 * - Multiplying by units
 * - Comparing to billed amounts
 * - Tracking edge cases with detailed debug info
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
  
  // Determine confidence level and fetch GPCI
  let gpci: GpciLocalityRow | null = null;
  let confidence: ConfidenceLevel = 'national_estimate';
  let localityName: string | null = null;
  let localityCode: string | null = null;
  
  // GPCI lookup debug info
  const gpciLookup = {
    attempted: false,
    zipUsed: zipCode || null,
    stateUsed: state || null,
    localityFound: false,
    localityName: null as string | null,
    workGpci: null as number | null,
    peGpci: null as number | null,
    mpGpci: null as number | null
  };
  
  // Try ZIP first for highest accuracy
  if (zipCode) {
    gpciLookup.attempted = true;
    gpci = await fetchGpciByZip(zipCode);
    if (gpci) {
      confidence = 'local_adjusted';
      localityName = gpci.locality_name;
      localityCode = gpci.locality_num;
      gpciLookup.localityFound = true;
      gpciLookup.localityName = gpci.locality_name;
      gpciLookup.workGpci = gpci.work_gpci;
      gpciLookup.peGpci = gpci.pe_gpci;
      gpciLookup.mpGpci = gpci.mp_gpci;
    }
  }
  
  // Fall back to state if no ZIP match
  if (!gpci && state) {
    gpciLookup.attempted = true;
    gpci = await fetchGpciByState(state);
    if (gpci) {
      confidence = 'state_estimate';
      localityName = gpci.locality_name;
      localityCode = gpci.locality_num;
      gpciLookup.localityFound = true;
      gpciLookup.localityName = gpci.locality_name;
      gpciLookup.workGpci = gpci.work_gpci;
      gpciLookup.peGpci = gpci.pe_gpci;
      gpciLookup.mpGpci = gpci.mp_gpci;
    }
  }

  // Process each line item
  for (const item of lineItems) {
    // Track billed amount (allow null)
    if (item.billedAmount !== null && item.billedAmount !== undefined) {
      totalBilled += item.billedAmount;
      billedTotalDetected = true;
    }
    
    // Track raw code
    const rawCode = item.rawCode || item.hcpcs;
    rawCodesExtracted.push(rawCode);
    
    // Normalize the code
    const normalized = normalizeCode(rawCode);
    normalizedCodes.push(normalized);
    
    // Skip if code is not valid after normalization
    if (!isValidBillableCode(normalized)) {
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
        notes: [`Invalid or unrecognized code format: "${rawCode}"`],
        exclusionReason: 'no_valid_code'
      });
      continue;
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
    
    // CASE 1: No MPFS row found at all
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
        notes: ['Code not found in Medicare Physician Fee Schedule'],
        exclusionReason: 'not_in_mpfs'
      });
      continue;
    }

    // CASE 2: MPFS row exists but has no priceable data (e.g., 99140)
    if (isExistsNotPriced(benchmark)) {
      codesExistsNotPriced.push(normalized.hcpcs);
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
        notes: [
          'Medicare reference amount not available for this code in our dataset',
          'This may be an add-on code, carrier-priced, or requires special circumstances'
        ],
        exclusionReason: 'exists_not_priced'
      });
      continue;
    }

    // CASE 3: Calculate fee
    const { fee: feePerUnit, calculated, gpciApplied } = calculateGpciAdjustedFee(
      benchmark, 
      gpci, 
      item.isFacility
    );
    
    if (feePerUnit === null || feePerUnit <= 0) {
      codesExistsNotPriced.push(normalized.hcpcs);
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
        notes: ['Medicare reference amount not available (fee calculation returned null)'],
        exclusionReason: 'fee_calculation_null'
      });
      continue;
    }

    // Mark as matched
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
    if (gpciApplied) {
      notes.push(`Adjusted for locality: ${localityName || 'regional'}`);
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
      gpciAdjusted: gpciApplied
    });
  }

  // Calculate overall multiple (only if both billed and reference are detected)
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
      billedTotal: billedTotalDetected ? totalBilled : null,
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
      codesMatched,
      codesMissing,
      codesExistsNotPriced,
      latestMpfsYear,
      queriesAttempted,
      gpciLookup
    },
    
    calculatedAt: new Date().toISOString(),
    
    // Legacy compatibility
    totalBilled: billedTotalDetected ? totalBilled : 0,
    totalMedicareReference: hasAnyBenchmark ? Math.round(totalMedicareReference * 100) / 100 : null,
    multipleOfMedicare: overallMultiple,
    confidence,
    localityName,
    state: state?.toUpperCase() || null,
    codesNotFound: [...codesMissing, ...codesExistsNotPriced],
    codesExcluded: [],
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
  // Check if billed total was detected
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
  // If no billed total detected, we can still show reference pricing
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
