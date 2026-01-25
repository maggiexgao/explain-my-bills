/**
 * Bill Type Detector - Auto-detects the type of medical bill
 * and recommends the appropriate fee schedule for comparison
 */

export type BillType = 'hospital_outpatient' | 'hospital_inpatient' | 'physician_office' | 'asc' | 'unknown';

export interface BillTypeResult {
  type: BillType;
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];
  recommendedFeeSchedule: 'OPPS' | 'MPFS' | 'DRG' | 'ASC' | 'mixed';
  message: string;
  shortLabel: string;
}

const ER_CODES = ['99281', '99282', '99283', '99284', '99285'];
const OBSERVATION_CODES = ['G0378', 'G0379'];
const CRITICAL_CARE_CODES = ['99291', '99292'];
const IV_CODES = ['96360', '96361', '96365', '96366', '96374', '96375'];

const HOSPITAL_KEYWORDS = [
  'hospital', 'medical center', 'health system', 'regional medical', 
  'community health', 'memorial', 'general hospital', 'university hospital',
  'children\'s hospital', 'st. ', 'saint ', 'mercy ', 'baptist ', 'methodist '
];

const ASC_KEYWORDS = [
  'surgery center', 'surgical center', 'ambulatory', 'outpatient surgery',
  'day surgery', 'same day surgery'
];

const OFFICE_KEYWORDS = [
  'clinic', 'medical office', 'physicians', 'md', 'family practice',
  'primary care', 'internal medicine', 'pediatrics', 'dermatology'
];

/**
 * Detect the type of bill based on codes, location, and text content
 */
export function detectBillType(
  codes: string[],
  location?: string,
  admitDate?: string,
  dischargeDate?: string,
  rawText?: string
): BillTypeResult {
  const indicators: string[] = [];
  const locationLower = (location || '').toLowerCase();
  const textLower = (rawText || '').toLowerCase();
  const normalizedCodes = codes.map(c => c.toUpperCase().trim());
  
  // Check for ER codes
  const hasERCodes = normalizedCodes.some(c => ER_CODES.includes(c));
  if (hasERCodes) indicators.push('ER visit codes present');
  
  // Check for observation codes
  const hasObservationCodes = normalizedCodes.some(c => OBSERVATION_CODES.includes(c.substring(0, 5)));
  if (hasObservationCodes) indicators.push('Observation codes present');
  
  // Check for critical care codes
  const hasCriticalCare = normalizedCodes.some(c => CRITICAL_CARE_CODES.includes(c));
  if (hasCriticalCare) indicators.push('Critical care codes present');
  
  // Check for IV codes (common in hospital settings)
  const hasIVCodes = normalizedCodes.some(c => IV_CODES.includes(c.substring(0, 5)));
  if (hasIVCodes) indicators.push('IV therapy codes present');
  
  // Check for 4-digit revenue codes (hospital-specific)
  const hasRevenueCodes = normalizedCodes.some(c => /^0\d{3}$/.test(c));
  if (hasRevenueCodes) indicators.push('Revenue codes present (hospital billing)');
  
  // Check for hospital indicators in location
  const isHospital = HOSPITAL_KEYWORDS.some(kw => locationLower.includes(kw));
  if (isHospital) indicators.push('Hospital location detected');
  
  // Check for inpatient indicators
  const hasMultipleDays = admitDate && dischargeDate && admitDate !== dischargeDate;
  if (hasMultipleDays) indicators.push('Multi-day stay detected');
  
  const hasInpatientText = textLower.includes('inpatient') || 
                           textLower.includes('room and board') ||
                           textLower.includes('drg') ||
                           textLower.includes('diagnosis related group');
  if (hasInpatientText) indicators.push('Inpatient terminology detected');
  
  // Check for ASC indicators
  const isASC = ASC_KEYWORDS.some(kw => locationLower.includes(kw));
  if (isASC) indicators.push('Surgery center location detected');
  
  // Check for office indicators
  const isOffice = OFFICE_KEYWORDS.some(kw => locationLower.includes(kw));
  if (isOffice) indicators.push('Office/clinic location detected');
  
  // Determine type based on indicators
  
  // Inpatient: Multi-day stay OR explicit inpatient terminology
  if (hasMultipleDays || hasInpatientText) {
    return {
      type: 'hospital_inpatient',
      confidence: hasMultipleDays && hasInpatientText ? 'high' : 'medium',
      indicators,
      recommendedFeeSchedule: 'DRG',
      message: 'This appears to be an inpatient hospital stay. Inpatient stays are priced using DRG (Diagnosis Related Groups). DRG comparison is not yet supported, so we\'re showing individual service benchmarks instead.',
      shortLabel: 'Inpatient'
    };
  }
  
  // ASC: Surgery center location
  if (isASC) {
    return {
      type: 'asc',
      confidence: 'medium',
      indicators,
      recommendedFeeSchedule: 'ASC',
      message: 'This appears to be from an Ambulatory Surgery Center (ASC). ASC rates are typically 40-60% of hospital outpatient rates.',
      shortLabel: 'Surgery Center'
    };
  }
  
  // Hospital Outpatient: ER codes, hospital location, revenue codes, or observation
  if (hasERCodes || hasRevenueCodes || hasObservationCodes || hasCriticalCare) {
    return {
      type: 'hospital_outpatient',
      confidence: hasERCodes || hasRevenueCodes ? 'high' : 'medium',
      indicators,
      recommendedFeeSchedule: 'OPPS',
      message: 'This is a hospital outpatient visit. We\'re using OPPS (Outpatient Prospective Payment System) benchmark rates, which are set for hospital facility services.',
      shortLabel: 'Hospital Outpatient'
    };
  }
  
  // Hospital Outpatient: Hospital location without inpatient indicators
  if (isHospital && !hasMultipleDays && !hasInpatientText) {
    return {
      type: 'hospital_outpatient',
      confidence: 'medium',
      indicators,
      recommendedFeeSchedule: 'OPPS',
      message: 'This appears to be from a hospital outpatient department. Using OPPS (Outpatient Prospective Payment System) benchmark rates.',
      shortLabel: 'Hospital Outpatient'
    };
  }
  
  // Physician Office: Office keywords or no hospital indicators
  if (isOffice || (!isHospital && !hasRevenueCodes && !hasERCodes)) {
    return {
      type: 'physician_office',
      confidence: isOffice ? 'medium' : 'low',
      indicators: indicators.length > 0 ? indicators : ['No hospital indicators detected'],
      recommendedFeeSchedule: 'MPFS',
      message: 'This appears to be from a physician\'s office or clinic. We\'re using MPFS (Medicare Physician Fee Schedule) benchmark rates.',
      shortLabel: 'Physician/Clinic'
    };
  }
  
  // Unknown: Can't determine
  return {
    type: 'unknown',
    confidence: 'low',
    indicators: indicators.length > 0 ? indicators : ['Insufficient information to determine bill type'],
    recommendedFeeSchedule: 'mixed',
    message: 'We couldn\'t definitively determine the care setting. Using a mix of benchmark rates based on the service types on your bill.',
    shortLabel: 'Mixed'
  };
}

/**
 * Get contextual explanation for why prices differ for specific code types
 */
export function getCodeTypeContext(hcpcs: string, description: string, billedAmount: number, benchmarkAmount: number): string | null {
  const code = hcpcs?.toUpperCase() || '';
  const desc = description?.toLowerCase() || '';
  const multiple = benchmarkAmount > 0 ? billedAmount / benchmarkAmount : 0;
  
  // Only provide context for high multiples
  if (multiple < 3) return null;
  
  // ER visits
  if (ER_CODES.includes(code)) {
    return `Emergency room facility fees cover 24/7 staffing, equipment, and emergency readiness. While the benchmark is $${benchmarkAmount.toFixed(0)}, hospitals typically charge more due to overhead. Insurance usually covers most of this; your portion depends on your plan's ER copay/coinsurance.`;
  }
  
  // Lab codes (80000-89999)
  if (/^8\d{4}/.test(code) || desc.includes('lab') || desc.includes('panel') || desc.includes('blood test')) {
    return `Lab tests often have significant markups in hospital settings. The benchmark rate of $${benchmarkAmount.toFixed(0)} reflects actual reagent and processing costs. Hospital charges of $${billedAmount.toFixed(0)} include facility overhead. Consider asking if future labs can be done at an independent lab for lower cost.`;
  }
  
  // Drug codes (J-codes)
  if (code.startsWith('J')) {
    return `Injectable drugs in hospitals often have the highest markups — sometimes 10-100× the drug's wholesale cost. The benchmark rate is based on Average Sales Price (ASP) plus a small margin. You can ask about bringing your own medication or using a pharmacy benefit.`;
  }
  
  // IV therapy
  if (IV_CODES.includes(code.substring(0, 5)) || desc.includes('iv') || desc.includes('infusion')) {
    return `IV therapy charges include supplies, pharmacy preparation, and nursing time. Hospital IV charges are typically much higher than outpatient infusion centers. If you need ongoing IV therapy, ask about outpatient alternatives.`;
  }
  
  // Imaging
  if (desc.includes('ct') || desc.includes('mri') || desc.includes('x-ray')) {
    return `Imaging charges in hospitals include both technical (equipment/technician) and professional (radiologist reading) components. Freestanding imaging centers often charge 50-70% less for the same scans.`;
  }
  
  return null;
}
