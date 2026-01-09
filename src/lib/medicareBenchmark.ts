/**
 * Medicare Benchmark Utilities
 * Calculate local Medicare fees and compare to billed amounts
 */

import { supabase } from '@/integrations/supabase/client';

// 2026 Conversion Factor
const CONVERSION_FACTOR = 34.6062;

export interface MpfsBenchmark {
  hcpcs: string;
  modifier: string | null;
  description: string | null;
  status: string | null;
  work_rvu: number | null;
  nonfac_pe_rvu: number | null;
  fac_pe_rvu: number | null;
  mp_rvu: number | null;
  nonfac_fee: number | null;
  fac_fee: number | null;
}

export interface GpciLocality {
  locality_num: string;
  state_abbr: string;
  locality_name: string;
  zip_code: string | null;
  work_gpci: number;
  pe_gpci: number;
  mp_gpci: number;
}

export interface MedicareBenchmarkResult {
  medicareFee: number | null;
  description: string | null;
  localityName: string | null;
  state: string | null;
  status: 'found' | 'not_found' | 'estimated';
  message?: string;
}

export interface MedicareComparison {
  cptCode: string;
  chargedAmount: number;
  medicareFee: number | null;
  percentOfMedicare: number | null;
  status: 'fair' | 'high' | 'very_high' | 'unknown';
  statusColor: 'green' | 'yellow' | 'red' | 'gray';
  message: string;
  description?: string | null;
  localityName?: string | null;
}

export interface MedicareSummary {
  totalCharged: number;
  totalMedicare: number | null;
  percentOfMedicare: number | null;
  overallStatus: 'fair' | 'high' | 'very_high' | 'mixed' | 'unknown';
  itemsFlagged: number;
  potentialSavings: number | null;
  comparisons: MedicareComparison[];
  cptCodesNotFound: string[];
}

export type CareSetting = 'office' | 'facility';

/**
 * Get GPCI data for a given state
 */
export async function getGpciByState(stateAbbr: string): Promise<GpciLocality | null> {
  const { data, error } = await supabase
    .from('gpci_localities')
    .select('*')
    .eq('state_abbr', stateAbbr.toUpperCase())
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as GpciLocality;
}

/**
 * Get GPCI data for a given ZIP code
 */
export async function getGpciByZip(zipCode: string): Promise<GpciLocality | null> {
  // Normalize ZIP to 5 digits
  const zip5 = zipCode.trim().substring(0, 5);
  
  const { data, error } = await supabase
    .from('gpci_localities')
    .select('*')
    .eq('zip_code', zip5)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as GpciLocality;
}

/**
 * Get Medicare benchmark data for a CPT/HCPCS code
 */
export async function getMpfsBenchmark(hcpcsCode: string, modifier?: string): Promise<MpfsBenchmark | null> {
  // Normalize the code
  const code = hcpcsCode.trim().toUpperCase();
  
  let query = supabase
    .from('mpfs_benchmarks')
    .select('*')
    .eq('hcpcs', code);

  if (modifier) {
    query = query.eq('modifier', modifier.trim().toUpperCase());
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as MpfsBenchmark;
}

/**
 * Calculate local Medicare fee using RVUs and GPCI
 */
export function calculateLocalMedicareFee(
  benchmark: MpfsBenchmark,
  gpci: GpciLocality | null,
  setting: CareSetting = 'office'
): number | null {
  // Check if we have valid RVU data
  const workRvu = benchmark.work_rvu ?? 0;
  const mpRvu = benchmark.mp_rvu ?? 0;
  
  // Select PE RVU based on setting
  const peRvu = setting === 'office' 
    ? (benchmark.nonfac_pe_rvu ?? 0)
    : (benchmark.fac_pe_rvu ?? 0);

  // If no RVUs, check if there's a direct fee
  if (workRvu === 0 && peRvu === 0 && mpRvu === 0) {
    // Use national fee if available
    const fee = setting === 'office' 
      ? benchmark.nonfac_fee 
      : benchmark.fac_fee;
    return fee ?? null;
  }

  // Apply GPCI adjustments (default to 1.0 for national average)
  const workGpci = gpci?.work_gpci ?? 1.0;
  const peGpci = gpci?.pe_gpci ?? 1.0;
  const mpGpci = gpci?.mp_gpci ?? 1.0;

  // Calculate geographically adjusted fee
  const localFee = (
    (workRvu * workGpci) +
    (peRvu * peGpci) +
    (mpRvu * mpGpci)
  ) * CONVERSION_FACTOR;

  return Math.round(localFee * 100) / 100;
}

/**
 * Add Medicare benchmark to a CPT code lookup
 */
export async function addMedicareBenchmark(
  cptCode: string,
  stateAbbr: string,
  zipCode?: string,
  setting: CareSetting = 'office'
): Promise<MedicareBenchmarkResult> {
  // Get MPFS benchmark for this CPT
  const benchmark = await getMpfsBenchmark(cptCode);
  
  if (!benchmark) {
    return {
      medicareFee: null,
      description: null,
      localityName: null,
      state: null,
      status: 'not_found',
      message: 'This code is not in Medicare fee schedule'
    };
  }

  // Get GPCI - try ZIP first, then state
  let gpci: GpciLocality | null = null;
  
  if (zipCode) {
    gpci = await getGpciByZip(zipCode);
  }
  
  if (!gpci && stateAbbr) {
    gpci = await getGpciByState(stateAbbr);
  }

  // Calculate local Medicare fee
  const medicareFee = calculateLocalMedicareFee(benchmark, gpci, setting);

  if (!medicareFee) {
    return {
      medicareFee: null,
      description: benchmark.description,
      localityName: null,
      state: null,
      status: 'not_found',
      message: 'No fee data available for this code'
    };
  }

  return {
    medicareFee,
    description: benchmark.description,
    localityName: gpci?.locality_name || 'National Average',
    state: gpci?.state_abbr || null,
    status: gpci ? 'found' : 'estimated'
  };
}

/**
 * Compare charged amount to Medicare fee
 */
export function compareToMedicare(
  chargedAmount: number,
  medicareFee: number | null
): Pick<MedicareComparison, 'percentOfMedicare' | 'status' | 'statusColor' | 'message'> {
  if (!medicareFee || medicareFee <= 0) {
    return {
      percentOfMedicare: null,
      status: 'unknown',
      statusColor: 'gray',
      message: 'Medicare benchmark not available'
    };
  }

  const percent = Math.round((chargedAmount / medicareFee) * 100);

  if (percent <= 200) {
    return {
      percentOfMedicare: percent,
      status: 'fair',
      statusColor: 'green',
      message: 'Within typical commercial insurance range'
    };
  } else if (percent <= 300) {
    return {
      percentOfMedicare: percent,
      status: 'high',
      statusColor: 'yellow',
      message: 'Higher than typical, consider negotiating'
    };
  } else {
    return {
      percentOfMedicare: percent,
      status: 'very_high',
      statusColor: 'red',
      message: 'Significantly above standard rates'
    };
  }
}

export interface LineItemWithCpt {
  cptCode: string;
  description?: string;
  chargedAmount: number;
}

/**
 * Analyze multiple line items against Medicare benchmarks
 */
export async function analyzeBillAgainstMedicare(
  lineItems: LineItemWithCpt[],
  stateAbbr: string,
  zipCode?: string,
  setting: CareSetting = 'office'
): Promise<MedicareSummary> {
  const comparisons: MedicareComparison[] = [];
  const cptCodesNotFound: string[] = [];
  let totalCharged = 0;
  let totalMedicare = 0;
  let itemsFlagged = 0;
  let hasAnyMedicare = false;

  for (const item of lineItems) {
    totalCharged += item.chargedAmount;

    const benchmarkResult = await addMedicareBenchmark(
      item.cptCode,
      stateAbbr,
      zipCode,
      setting
    );

    if (benchmarkResult.status === 'not_found') {
      cptCodesNotFound.push(item.cptCode);
      comparisons.push({
        cptCode: item.cptCode,
        chargedAmount: item.chargedAmount,
        medicareFee: null,
        percentOfMedicare: null,
        status: 'unknown',
        statusColor: 'gray',
        message: 'Not in Medicare fee schedule',
        description: item.description
      });
      continue;
    }

    hasAnyMedicare = true;
    const medicareFee = benchmarkResult.medicareFee!;
    totalMedicare += medicareFee;

    const comparison = compareToMedicare(item.chargedAmount, medicareFee);
    
    if (comparison.status === 'high' || comparison.status === 'very_high') {
      itemsFlagged++;
    }

    comparisons.push({
      cptCode: item.cptCode,
      chargedAmount: item.chargedAmount,
      medicareFee,
      ...comparison,
      description: benchmarkResult.description || item.description,
      localityName: benchmarkResult.localityName
    });
  }

  // Calculate overall summary
  const percentOfMedicare = hasAnyMedicare && totalMedicare > 0
    ? Math.round((totalCharged / totalMedicare) * 100)
    : null;

  let overallStatus: MedicareSummary['overallStatus'] = 'unknown';
  if (percentOfMedicare !== null) {
    if (percentOfMedicare <= 200) {
      overallStatus = 'fair';
    } else if (percentOfMedicare <= 300) {
      overallStatus = 'high';
    } else {
      overallStatus = 'very_high';
    }
    
    // Mark as mixed if some items are fair and some are flagged
    if (itemsFlagged > 0 && itemsFlagged < comparisons.length) {
      overallStatus = 'mixed';
    }
  }

  // Calculate potential savings (difference from 150% of Medicare)
  const potentialSavings = hasAnyMedicare && totalMedicare > 0
    ? Math.max(0, totalCharged - (totalMedicare * 1.5))
    : null;

  return {
    totalCharged,
    totalMedicare: hasAnyMedicare ? totalMedicare : null,
    percentOfMedicare,
    overallStatus,
    itemsFlagged,
    potentialSavings: potentialSavings ? Math.round(potentialSavings) : null,
    comparisons,
    cptCodesNotFound
  };
}

/**
 * Search for CPT codes by description
 */
export async function searchCptByDescription(
  searchTerm: string,
  limit: number = 10
): Promise<MpfsBenchmark[]> {
  const { data, error } = await supabase
    .from('mpfs_benchmarks')
    .select('*')
    .ilike('description', `%${searchTerm}%`)
    .not('nonfac_fee', 'is', null)
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data as MpfsBenchmark[];
}
