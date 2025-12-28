/**
 * CPT Evaluation Engine
 * Compares bill line items against Medicare fee schedule
 */

import { MpfsIndex, getLocalityOrMedianFee } from './mpfsTable';
import { classifyServiceType, ServiceType, getServiceTypeLabel } from './cptServiceBuckets';

export interface CptLineInput {
  cpt: string;
  modifier?: string;
  description?: string;
  billed: number;
  allowed?: number;
  patientResponsibility?: number;
  units?: number;
  siteOfService?: 'facility' | 'nonfacility';
  dateOfService?: string;
}

export interface CptLineEvaluation {
  cpt: string;
  modifier?: string;
  description?: string;
  serviceType: ServiceType;
  serviceTypeLabel: string;
  
  // Original amounts
  billed: number;
  allowed?: number;
  patientResponsibility?: number;
  units: number;
  
  // Medicare reference
  medicareAllowed: number | null;
  medicareSource: 'locality' | 'state_median' | 'not_found';
  localityName?: string;
  
  // Ratios
  billedVsMedicare: number | null;
  allowedVsMedicare: number | null;
  patientVsMedicare: number | null;
  
  // Notes
  notes: string[];
}

export interface ServiceTypeSummary {
  serviceType: ServiceType;
  serviceTypeLabel: string;
  count: number;
  totalBilled: number;
  totalMedicareAllowed: number;
  totalAllowed: number;
  avgBilledVsMedicare: number | null;
  avgAllowedVsMedicare: number | null;
}

export interface CptEvaluationSummary {
  lines: CptLineEvaluation[];
  byServiceType: ServiceTypeSummary[];
  
  // Overall stats
  totalBilled: number;
  totalMedicareAllowed: number;
  totalAllowed: number;
  overallBilledVsMedicare: number | null;
  overallAllowedVsMedicare: number | null;
  
  // Metadata
  year: string;
  state: string;
  locality?: string;
  codesNotFound: string[];
}

/**
 * Format ratio for display (e.g., "2.3× Medicare")
 */
export function formatMedicareRatio(ratio: number | null): string {
  if (ratio === null) return 'N/A';
  return `${ratio.toFixed(1)}×`;
}

/**
 * Evaluate a list of CPT line items against Medicare fee schedule
 */
export function evaluateCptLinesAgainstMedicare(
  mpfsIndex: MpfsIndex,
  year: string,
  state: string,
  localityOrNull: string | null,
  lineInputs: CptLineInput[]
): CptEvaluationSummary {
  const lines: CptLineEvaluation[] = [];
  const codesNotFound: string[] = [];
  
  // Service type aggregation
  const serviceTypeAgg = new Map<ServiceType, {
    count: number;
    totalBilled: number;
    totalMedicareAllowed: number;
    totalAllowed: number;
    medicareItems: number;
  }>();
  
  for (const input of lineInputs) {
    // Normalize CPT code - trim whitespace, remove common suffixes
    const normCpt = input.cpt.trim().replace(/ CPT®?$/i, '').padStart(5, '0');
    const normModifier = input.modifier?.trim() || undefined;
    
    const serviceType = classifyServiceType(normCpt);
    const units = input.units || 1;
    const isFacility = input.siteOfService === 'facility';
    
    console.log('[CPT Medicare Eval] evaluating', { 
      cpt: normCpt, 
      modifier: normModifier, 
      state, 
      locality: localityOrNull,
      site: isFacility ? 'facility' : 'nonfacility',
      billed: input.billed
    });
    
    // Get Medicare fee
    const feeResult = getLocalityOrMedianFee(
      mpfsIndex,
      year,
      state,
      localityOrNull,
      normCpt,
      normModifier,
      isFacility
    );
    
    const medicareAllowed = feeResult.fee !== null ? feeResult.fee * units : null;
    const notes: string[] = [];
    
    console.log('[CPT Medicare Eval] fee result', { 
      cpt: normCpt, 
      mpfsAllowed: medicareAllowed, 
      fee: feeResult.fee,
      isMedian: feeResult.isMedian,
      localityName: feeResult.localityName
    });
    
    if (feeResult.fee === null) {
      codesNotFound.push(normCpt);
      notes.push('Not in Medicare fee schedule dataset');
    } else if (feeResult.isMedian) {
      notes.push(`Using ${state} state median (locality not matched)`);
    } else if (feeResult.localityName) {
      notes.push(`${feeResult.localityName}`);
    }
    
    // Calculate ratios
    const billedVsMedicare = medicareAllowed !== null && medicareAllowed > 0 
      ? input.billed / medicareAllowed 
      : null;
    
    const allowedVsMedicare = medicareAllowed !== null && medicareAllowed > 0 && input.allowed
      ? input.allowed / medicareAllowed 
      : null;
    
    const patientVsMedicare = medicareAllowed !== null && medicareAllowed > 0 && input.patientResponsibility
      ? input.patientResponsibility / medicareAllowed 
      : null;
    
    const evaluation: CptLineEvaluation = {
      cpt: input.cpt,
      modifier: input.modifier,
      description: input.description,
      serviceType,
      serviceTypeLabel: getServiceTypeLabel(serviceType),
      billed: input.billed,
      allowed: input.allowed,
      patientResponsibility: input.patientResponsibility,
      units,
      medicareAllowed,
      medicareSource: feeResult.fee === null ? 'not_found' : (feeResult.isMedian ? 'state_median' : 'locality'),
      localityName: feeResult.localityName,
      billedVsMedicare,
      allowedVsMedicare,
      patientVsMedicare,
      notes,
    };
    
    lines.push(evaluation);
    
    // Update service type aggregation
    if (!serviceTypeAgg.has(serviceType)) {
      serviceTypeAgg.set(serviceType, {
        count: 0,
        totalBilled: 0,
        totalMedicareAllowed: 0,
        totalAllowed: 0,
        medicareItems: 0,
      });
    }
    const agg = serviceTypeAgg.get(serviceType)!;
    agg.count++;
    agg.totalBilled += input.billed;
    if (medicareAllowed !== null) {
      agg.totalMedicareAllowed += medicareAllowed;
      agg.medicareItems++;
    }
    if (input.allowed) {
      agg.totalAllowed += input.allowed;
    }
  }
  
  // Build service type summaries
  const byServiceType: ServiceTypeSummary[] = [];
  for (const [serviceType, agg] of serviceTypeAgg.entries()) {
    byServiceType.push({
      serviceType,
      serviceTypeLabel: getServiceTypeLabel(serviceType),
      count: agg.count,
      totalBilled: agg.totalBilled,
      totalMedicareAllowed: agg.totalMedicareAllowed,
      totalAllowed: agg.totalAllowed,
      avgBilledVsMedicare: agg.medicareItems > 0 && agg.totalMedicareAllowed > 0
        ? agg.totalBilled / agg.totalMedicareAllowed
        : null,
      avgAllowedVsMedicare: agg.medicareItems > 0 && agg.totalMedicareAllowed > 0 && agg.totalAllowed > 0
        ? agg.totalAllowed / agg.totalMedicareAllowed
        : null,
    });
  }
  
  // Sort by total billed descending
  byServiceType.sort((a, b) => b.totalBilled - a.totalBilled);
  
  // Calculate overall stats
  const totalBilled = lines.reduce((sum, l) => sum + l.billed, 0);
  const totalMedicareAllowed = lines.reduce((sum, l) => sum + (l.medicareAllowed || 0), 0);
  const totalAllowed = lines.reduce((sum, l) => sum + (l.allowed || 0), 0);
  
  return {
    lines,
    byServiceType,
    totalBilled,
    totalMedicareAllowed,
    totalAllowed,
    overallBilledVsMedicare: totalMedicareAllowed > 0 ? totalBilled / totalMedicareAllowed : null,
    overallAllowedVsMedicare: totalMedicareAllowed > 0 && totalAllowed > 0 ? totalAllowed / totalMedicareAllowed : null,
    year,
    state,
    locality: localityOrNull || undefined,
    codesNotFound: [...new Set(codesNotFound)],
  };
}

/**
 * Get interpretation of Medicare ratio
 */
export function interpretMedicareRatio(ratio: number | null): {
  level: 'low' | 'typical' | 'high' | 'very_high' | 'unknown';
  message: string;
} {
  if (ratio === null) {
    return { level: 'unknown', message: 'Unable to compare to Medicare' };
  }
  
  if (ratio < 1.0) {
    return { level: 'low', message: 'Below Medicare rates' };
  }
  if (ratio <= 1.5) {
    return { level: 'typical', message: 'Near Medicare rates' };
  }
  if (ratio <= 3.0) {
    return { level: 'high', message: 'Above Medicare rates (common for private insurance)' };
  }
  return { level: 'very_high', message: 'Well above Medicare rates' };
}
