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
 */

import { supabase } from '@/integrations/supabase/client';

// ============= Types =============

export type ConfidenceLevel = 'local_adjusted' | 'national_estimate';
export type BenchmarkStatus = 'ok' | 'no_codes' | 'no_matches' | 'partial';

export interface NormalizedCode {
  hcpcs: string;
  modifier: string;
  raw: string;
}

export interface BenchmarkLineItem {
  hcpcs: string;
  description?: string;
  billedAmount: number;
  units: number;
  dateOfService?: string;
  modifier?: string;
  isFacility?: boolean;
  rawCode?: string; // Original extracted code before normalization
}

export interface BenchmarkLineResult {
  hcpcs: string;
  modifier: string;
  description: string | null;
  billedAmount: number;
  units: number;
  medicareReferencePerUnit: number | null;
  medicareReferenceTotal: number | null;
  multiple: number | null;
  status: 'fair' | 'high' | 'very_high' | 'unknown';
  matchStatus: 'matched' | 'missing';
  benchmarkYearUsed: number | null;
  notes: string[];
  isEmergency?: boolean;
  isBundled?: boolean;
  modifierFallbackUsed?: boolean;
}

export interface BenchmarkMetadata {
  localityUsed: ConfidenceLevel;
  localityName: string | null;
  benchmarkYearUsed: number;
  requestedYears: number[];
  usedYearFallback: boolean;
  fallbackReason: string | null;
  notes: string[];
}

export interface MedicareBenchmarkOutput {
  // Status indicator
  status: BenchmarkStatus;
  
  // Bill-level totals
  totals: {
    billedTotal: number;
    medicareReferenceTotal: number | null;
    multipleOfMedicare: number | null;
    difference: number | null;
  };
  
  // Metadata about the benchmark calculation
  metadata: BenchmarkMetadata;
  
  // Line-by-line breakdown
  lineItems: BenchmarkLineResult[];
  
  // Debug information
  debug: {
    rawCodesExtracted: string[];
    normalizedCodes: NormalizedCode[];
    codesMatched: string[];
    codesMissing: string[];
    latestMpfsYear: number;
    queriesAttempted: { hcpcs: string; year: number; found: boolean }[];
  };
  
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
 * Fetch GPCI locality data by state (fallback)
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
 * Fetch MPFS benchmark data for a specific HCPCS code with year fallback
 */
async function fetchMpfsBenchmarkWithFallback(
  hcpcs: string,
  requestedYear: number,
  latestYear: number,
  modifier?: string
): Promise<{ row: MpfsBenchmarkRow | null; yearUsed: number; usedFallback: boolean; modifierFallback: boolean }> {
  const normalizedCode = hcpcs.trim().toUpperCase();
  const normalizedModifier = modifier ? modifier.trim().toUpperCase() : '';
  
  // Try requested year first
  let result = await tryFetchMpfs(normalizedCode, requestedYear, normalizedModifier);
  
  if (result.row) {
    return { ...result, yearUsed: requestedYear, usedFallback: false };
  }
  
  // If requested year not found and it's different from latest, try latest year
  if (requestedYear !== latestYear) {
    result = await tryFetchMpfs(normalizedCode, latestYear, normalizedModifier);
    if (result.row) {
      return { ...result, yearUsed: latestYear, usedFallback: true };
    }
  }
  
  return { row: null, yearUsed: latestYear, usedFallback: requestedYear !== latestYear, modifierFallback: false };
}

async function tryFetchMpfs(
  hcpcs: string,
  year: number,
  modifier: string
): Promise<{ row: MpfsBenchmarkRow | null; modifierFallback: boolean }> {
  // Try exact modifier match first
  if (modifier) {
    const { data } = await supabase
      .from('mpfs_benchmarks')
      .select('*')
      .eq('hcpcs', hcpcs)
      .eq('year', year)
      .eq('qp_status', 'nonQP')
      .eq('modifier', modifier)
      .limit(1)
      .maybeSingle();
    
    if (data) {
      return { row: data as MpfsBenchmarkRow, modifierFallback: false };
    }
  }
  
  // Try without modifier (base code)
  const { data } = await supabase
    .from('mpfs_benchmarks')
    .select('*')
    .eq('hcpcs', hcpcs)
    .eq('year', year)
    .eq('qp_status', 'nonQP')
    .eq('modifier', '')
    .limit(1)
    .maybeSingle();
  
  return { 
    row: data as MpfsBenchmarkRow | null, 
    modifierFallback: modifier ? !!data : false 
  };
}

// ============= Calculation Functions =============

/**
 * Calculate Medicare fee using RVUs and GPCI
 * 
 * Formula: Fee = [(Work RVU × Work GPCI) + (PE RVU × PE GPCI) + (MP RVU × MP GPCI)] × CF
 */
function calculateGpciAdjustedFee(
  benchmark: MpfsBenchmarkRow,
  gpci: GpciLocalityRow | null,
  isFacility: boolean = false
): number | null {
  // First, try to use pre-calculated fee if available
  const directFee = isFacility ? benchmark.fac_fee : benchmark.nonfac_fee;
  
  // Only use direct fee if it's a valid positive number
  if (directFee !== null && typeof directFee === 'number' && directFee > 0) {
    // If we have GPCI, we need to adjust. Otherwise, use the national fee directly.
    if (!gpci) {
      return Math.round(directFee * 100) / 100;
    }
    // Note: Direct fees from MPFS are national. GPCI adjustment would require RVU recalculation.
    // For now, if GPCI is present but we only have direct fees, we'll use the national fee
    // and note that GPCI adjustment couldn't be applied.
  }
  
  // Calculate from RVUs
  const workRvu = benchmark.work_rvu ?? 0;
  const mpRvu = benchmark.mp_rvu ?? 0;
  const peRvu = isFacility 
    ? (benchmark.fac_pe_rvu ?? 0) 
    : (benchmark.nonfac_pe_rvu ?? 0);

  // If no RVUs at all, fall back to direct fee even if it's 0
  if (workRvu === 0 && peRvu === 0 && mpRvu === 0) {
    return directFee ?? null;
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

  return Math.round(adjustedFee * 100) / 100;
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
  const queriesAttempted: { hcpcs: string; year: number; found: boolean }[] = [];
  const requestedYears: number[] = [];
  const metadataNotes: string[] = [];
  
  let totalBilled = 0;
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
  
  // Try ZIP first for highest accuracy
  if (zipCode) {
    gpci = await fetchGpciByZip(zipCode);
    if (gpci) {
      confidence = 'local_adjusted';
      localityName = gpci.locality_name;
    }
  }
  
  // Fall back to state if no ZIP match
  if (!gpci && state) {
    gpci = await fetchGpciByState(state);
    if (gpci) {
      confidence = 'local_adjusted';
      localityName = gpci.locality_name;
    }
  }

  // Process each line item
  for (const item of lineItems) {
    totalBilled += item.billedAmount;
    
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
        notes: [`Invalid or unrecognized code format: "${rawCode}"`]
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
    const { row: benchmark, yearUsed, usedFallback, modifierFallback } = 
      await fetchMpfsBenchmarkWithFallback(
        normalized.hcpcs,
        yearToRequest,
        latestMpfsYear,
        normalized.modifier || item.modifier
      );
    
    // Track query
    queriesAttempted.push({ 
      hcpcs: normalized.hcpcs, 
      year: yearUsed, 
      found: !!benchmark 
    });
    
    if (usedFallback && !usedYearFallback) {
      usedYearFallback = true;
      fallbackReason = `Service year ${yearToRequest} not in MPFS; using ${yearUsed} (latest available)`;
      metadataNotes.push(fallbackReason);
    }
    
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
        notes: ['No Medicare reference available for this service']
      });
      continue;
    }

    // Calculate per-unit fee
    const feePerUnit = calculateGpciAdjustedFee(benchmark, gpci, item.isFacility);
    
    if (feePerUnit === null || feePerUnit <= 0) {
      codesMissing.push(normalized.hcpcs);
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
        matchStatus: 'missing',
        benchmarkYearUsed: yearUsed,
        notes: ['No fee data available for this code']
      });
      continue;
    }

    // Mark as matched
    codesMatched.push(normalized.hcpcs);

    // Calculate total with units
    const units = item.units > 0 ? item.units : 1;
    const totalReference = feePerUnit * units;
    const multiple = item.billedAmount / totalReference;
    const percentOfMedicare = Math.round(multiple * 100);
    const status = determineStatus(percentOfMedicare);
    
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
    
    // Check for bundling
    const isBundled = checkBundling(benchmark);
    if (isBundled) {
      notes.push('This is a bundled/global surgery code - follow-up visits may be included');
    }
    
    // Add context message
    if (status === 'fair') {
      notes.push('Within typical commercial insurance range');
    } else if (status === 'high') {
      notes.push('Higher than typical, may be negotiable');
    } else if (status === 'very_high') {
      notes.push('Significantly above standard rates - review recommended');
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
      multiple: Math.round(multiple * 100) / 100,
      status,
      matchStatus: 'matched',
      benchmarkYearUsed: yearUsed,
      notes,
      isBundled,
      modifierFallbackUsed: modifierFallback
    });
  }

  // Calculate overall multiple
  const overallMultiple = hasAnyBenchmark && totalMedicareReference > 0
    ? Math.round((totalBilled / totalMedicareReference) * 100) / 100
    : null;

  // Determine status
  let status: BenchmarkStatus = 'ok';
  if (lineItems.length === 0 || normalizedCodes.every(c => !isValidBillableCode(c))) {
    status = 'no_codes';
  } else if (!hasAnyBenchmark) {
    status = 'no_matches';
  } else if (codesMissing.length > 0 && codesMatched.length > 0) {
    status = 'partial';
  }

  const benchmarkYearUsed = usedYearFallback ? latestMpfsYear : (requestedYears[0] || latestMpfsYear);

  return {
    status,
    
    totals: {
      billedTotal: totalBilled,
      medicareReferenceTotal: hasAnyBenchmark ? Math.round(totalMedicareReference * 100) / 100 : null,
      multipleOfMedicare: overallMultiple,
      difference: hasAnyBenchmark ? Math.round((totalBilled - totalMedicareReference) * 100) / 100 : null
    },
    
    metadata: {
      localityUsed: confidence,
      localityName,
      benchmarkYearUsed,
      requestedYears,
      usedYearFallback,
      fallbackReason,
      notes: metadataNotes
    },
    
    lineItems: results,
    
    debug: {
      rawCodesExtracted,
      normalizedCodes,
      codesMatched,
      codesMissing,
      latestMpfsYear,
      queriesAttempted
    },
    
    calculatedAt: new Date().toISOString(),
    
    // Legacy compatibility
    totalBilled,
    totalMedicareReference: hasAnyBenchmark ? Math.round(totalMedicareReference * 100) / 100 : null,
    multipleOfMedicare: overallMultiple,
    confidence,
    localityName,
    state: state?.toUpperCase() || null,
    codesNotFound: codesMissing,
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
  if (!output.totals.multipleOfMedicare || !output.totals.medicareReferenceTotal) {
    return null;
  }

  const formatter = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0
  });

  return `Your bill of ${formatter.format(output.totals.billedTotal)} is about ${output.totals.multipleOfMedicare}× higher than this reference price.`;
}

/**
 * Generate confidence qualifier
 */
export function generateConfidenceQualifier(output: MedicareBenchmarkOutput): string {
  if (output.metadata.localityUsed === 'local_adjusted' && output.metadata.localityName) {
    return `Adjusted for your region (${output.metadata.localityName})`;
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
