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

export interface BenchmarkLineItem {
  hcpcs: string;
  description?: string;
  billedAmount: number;
  units: number;
  dateOfService?: string;
  modifier?: string;
  isFacility?: boolean;
}

export interface BenchmarkLineResult {
  hcpcs: string;
  description: string | null;
  billedAmount: number;
  units: number;
  medicareReferencePerUnit: number | null;
  medicareReferenceTotal: number | null;
  multiple: number | null;
  status: 'fair' | 'high' | 'very_high' | 'unknown';
  notes: string[];
  isEmergency?: boolean;
  isBundled?: boolean;
}

export interface MedicareBenchmarkOutput {
  // Bill-level totals
  totalBilled: number;
  totalMedicareReference: number | null;
  multipleOfMedicare: number | null;
  
  // Confidence and geographic info
  confidence: ConfidenceLevel;
  localityName: string | null;
  state: string | null;
  
  // Line-by-line breakdown
  lineItems: BenchmarkLineResult[];
  
  // Edge case tracking
  codesNotFound: string[];
  codesExcluded: string[];
  
  // Metadata
  dataYear: number;
  calculatedAt: string;
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

// ============= Data Fetching =============

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
 * Fetch MPFS benchmark data for a specific HCPCS code
 */
async function fetchMpfsBenchmark(
  hcpcs: string,
  year: number,
  modifier?: string
): Promise<MpfsBenchmarkRow | null> {
  const normalizedCode = hcpcs.trim().toUpperCase();
  const normalizedModifier = modifier ? modifier.trim().toUpperCase() : '';

  let query = supabase
    .from('mpfs_benchmarks')
    .select('*')
    .eq('hcpcs', normalizedCode)
    .eq('year', year)
    .eq('qp_status', 'nonQP');

  // Try exact modifier match first
  if (normalizedModifier) {
    query = query.eq('modifier', normalizedModifier);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  // If no match with modifier, try without
  if ((!data && normalizedModifier) || error) {
    const fallbackQuery = await supabase
      .from('mpfs_benchmarks')
      .select('*')
      .eq('hcpcs', normalizedCode)
      .eq('year', year)
      .eq('qp_status', 'nonQP')
      .eq('modifier', '')
      .limit(1)
      .maybeSingle();

    if (fallbackQuery.data) return fallbackQuery.data as MpfsBenchmarkRow;
  }

  if (error || !data) return null;
  return data as MpfsBenchmarkRow;
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
  const workRvu = benchmark.work_rvu ?? 0;
  const mpRvu = benchmark.mp_rvu ?? 0;
  const peRvu = isFacility 
    ? (benchmark.fac_pe_rvu ?? 0) 
    : (benchmark.nonfac_pe_rvu ?? 0);

  // If no RVUs, use direct fee if available
  if (workRvu === 0 && peRvu === 0 && mpRvu === 0) {
    const directFee = isFacility ? benchmark.fac_fee : benchmark.nonfac_fee;
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
 * Extract service year from date string, defaulting to current year
 */
function extractYear(dateOfService?: string): number {
  if (!dateOfService) return 2026; // Default to current MPFS year
  
  const year = new Date(dateOfService).getFullYear();
  // Clamp to valid MPFS years we have data for
  if (year >= 2026) return 2026;
  if (year <= 2024) return 2026; // Fallback if no older data
  return year;
}

// ============= Main Service Function =============

/**
 * Calculate Medicare benchmarks for a list of bill line items
 * 
 * This is the main entry point for benchmark calculation.
 * It handles all the complexity of:
 * - Fetching MPFS data for each code
 * - Applying GPCI geographic adjustments
 * - Multiplying by units
 * - Comparing to billed amounts
 * - Tracking edge cases
 */
export async function calculateMedicareBenchmarks(
  lineItems: BenchmarkLineItem[],
  state: string,
  zipCode?: string
): Promise<MedicareBenchmarkOutput> {
  const results: BenchmarkLineResult[] = [];
  const codesNotFound: string[] = [];
  const codesExcluded: string[] = [];
  
  let totalBilled = 0;
  let totalMedicareReference = 0;
  let hasAnyBenchmark = false;
  
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
    
    const year = extractYear(item.dateOfService);
    const benchmark = await fetchMpfsBenchmark(item.hcpcs, year, item.modifier);
    
    if (!benchmark) {
      codesNotFound.push(item.hcpcs);
      results.push({
        hcpcs: item.hcpcs,
        description: item.description || null,
        billedAmount: item.billedAmount,
        units: item.units,
        medicareReferencePerUnit: null,
        medicareReferenceTotal: null,
        multiple: null,
        status: 'unknown',
        notes: ['No Medicare reference available for this service']
      });
      continue;
    }

    // Calculate per-unit fee
    const feePerUnit = calculateGpciAdjustedFee(benchmark, gpci, item.isFacility);
    
    if (feePerUnit === null || feePerUnit <= 0) {
      codesNotFound.push(item.hcpcs);
      results.push({
        hcpcs: item.hcpcs,
        description: benchmark.description || item.description || null,
        billedAmount: item.billedAmount,
        units: item.units,
        medicareReferencePerUnit: null,
        medicareReferenceTotal: null,
        multiple: null,
        status: 'unknown',
        notes: ['No fee data available for this code']
      });
      continue;
    }

    // Calculate total with units
    const totalReference = feePerUnit * item.units;
    const multiple = item.billedAmount / totalReference;
    const percentOfMedicare = Math.round(multiple * 100);
    const status = determineStatus(percentOfMedicare);
    
    // Build notes
    const notes: string[] = [];
    
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
      hcpcs: item.hcpcs,
      description: benchmark.description || item.description || null,
      billedAmount: item.billedAmount,
      units: item.units,
      medicareReferencePerUnit: feePerUnit,
      medicareReferenceTotal: totalReference,
      multiple: Math.round(multiple * 100) / 100,
      status,
      notes,
      isBundled
    });
  }

  // Calculate overall multiple
  const overallMultiple = hasAnyBenchmark && totalMedicareReference > 0
    ? Math.round((totalBilled / totalMedicareReference) * 100) / 100
    : null;

  return {
    totalBilled,
    totalMedicareReference: hasAnyBenchmark ? Math.round(totalMedicareReference * 100) / 100 : null,
    multipleOfMedicare: overallMultiple,
    confidence,
    localityName,
    state: state.toUpperCase(),
    lineItems: results,
    codesNotFound,
    codesExcluded,
    dataYear: 2026,
    calculatedAt: new Date().toISOString()
  };
}

// ============= Helper Functions for UI =============

/**
 * Generate user-friendly benchmark statement
 */
export function generateBenchmarkStatement(output: MedicareBenchmarkOutput): string {
  if (!output.totalMedicareReference) {
    return "Medicare reference pricing data is not available for the services on this bill.";
  }

  const formatter = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0
  });

  return `Medicare's reference price for these services is approximately ${formatter.format(output.totalMedicareReference)}.`;
}

/**
 * Generate comparison sentence
 */
export function generateComparisonSentence(output: MedicareBenchmarkOutput): string | null {
  if (!output.multipleOfMedicare || !output.totalMedicareReference) {
    return null;
  }

  const formatter = new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0
  });

  return `Your bill of ${formatter.format(output.totalBilled)} is about ${output.multipleOfMedicare}× higher than this reference price.`;
}

/**
 * Generate confidence qualifier
 */
export function generateConfidenceQualifier(output: MedicareBenchmarkOutput): string {
  if (output.confidence === 'local_adjusted' && output.localityName) {
    return `Adjusted for your region (${output.localityName})`;
  }
  return "National estimate (exact locality unknown)";
}

/**
 * Generate overall status message
 */
export function generateOverallStatus(output: MedicareBenchmarkOutput): {
  status: 'fair' | 'high' | 'very_high' | 'mixed' | 'unknown';
  message: string;
} {
  if (!output.multipleOfMedicare) {
    return {
      status: 'unknown',
      message: 'Insufficient data to determine pricing comparison.'
    };
  }

  const percentOfMedicare = Math.round(output.multipleOfMedicare * 100);
  
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
