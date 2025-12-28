/**
 * CPT Evaluation Engine
 * Benchmarks CPT charges against Medicare Physician Fee Schedule
 */

import { classifyServiceType, ServiceType, getServiceTypeLabel } from './cptServiceBuckets';
import { getMpfsRowsForCpt, getStateMedianAllowed, MpfsRow } from './mpfsTable';
import { getCptMasterEntry } from './cptMaster';

export type SiteOfService = 'nonfacility' | 'facility';

export type CptLineInput = {
  cpt: string;
  modifier?: string | null;
  billedAmount?: number | null;
  allowedAmount?: number | null;
  patientResponsibility?: number | null;
  units?: number | null;
  siteOfService?: SiteOfService | null;
  description?: string;
};

export type CptLineEvaluation = {
  cpt: string;
  modifier?: string | null;
  description: string;
  serviceType: ServiceType;
  serviceTypeLabel: string;
  mpfsAllowed: number | null;
  mpfsSiteOfService: SiteOfService | null;
  billedAmount?: number | null;
  allowedAmount?: number | null;
  patientResponsibility?: number | null;
  billedVsMedicareRatio?: number | null;
  allowedVsMedicareRatio?: number | null;
  patientVsMedicareRatio?: number | null;
  notes: string[];
  ratioBadge?: 'good' | 'elevated' | 'high' | 'very-high' | null;
};

export type ServiceTypeSummary = {
  serviceType: ServiceType;
  serviceTypeLabel: string;
  totalBilled: number;
  totalMedicareAllowed: number;
  totalAllowed: number | null;
  avgAllowedVsMedicareRatio: number | null;
};

export type CptEvaluationSummary = {
  lines: CptLineEvaluation[];
  byServiceType: ServiceTypeSummary[];
  overallSummary: {
    totalBilled: number;
    totalMedicareAllowed: number;
    totalAllowed: number | null;
    avgBilledVsMedicareRatio: number | null;
  };
};

function getRatioBadge(ratio: number | null | undefined): CptLineEvaluation['ratioBadge'] {
  if (!ratio) return null;
  if (ratio <= 1.5) return 'good';
  if (ratio <= 2.5) return 'elevated';
  if (ratio <= 4) return 'high';
  return 'very-high';
}

/**
 * Evaluate CPT line items against Medicare Physician Fee Schedule
 */
export async function evaluateCptLinesAgainstMedicare(
  year: number,
  state: string,
  localityOrNull: string | null,
  lineInputs: CptLineInput[]
): Promise<CptEvaluationSummary> {
  const lines: CptLineEvaluation[] = [];

  for (const input of lineInputs) {
    const serviceType = await classifyServiceType(input.cpt);
    const serviceTypeLabel = getServiceTypeLabel(serviceType);
    const site: SiteOfService = input.siteOfService ?? 'nonfacility';
    const notes: string[] = [];

    // Get CPT description
    const masterEntry = await getCptMasterEntry(input.cpt);
    const description = input.description || masterEntry?.longDescription || `Code ${input.cpt}`;

    // Look up MPFS
    const rows: MpfsRow[] = await getMpfsRowsForCpt(year, state, input.cpt, input.modifier ?? null);
    let mpfsAllowed: number | null = null;

    if (rows.length === 0) {
      // Try state median
      const stateMed = await getStateMedianAllowed(year, state, input.cpt, input.modifier ?? null);
      mpfsAllowed = site === 'nonfacility' ? stateMed.nonfacilityMedian : stateMed.facilityMedian;
      
      if (mpfsAllowed == null) {
        notes.push('Medicare does not set a fee for this code in the physician fee schedule (or data unavailable).');
      } else {
        notes.push('Using state-level median Medicare allowed amount (locality not specified).');
      }
    } else {
      let candidateRows = rows;
      if (localityOrNull) {
        const localityRows = rows.filter(r => r.locality === localityOrNull);
        if (localityRows.length > 0) candidateRows = localityRows;
      }
      
      const amounts = candidateRows
        .map(r => (site === 'nonfacility' ? r.nonfacilityFee : r.facilityFee))
        .filter((v): v is number => v != null);
      
      if (amounts.length > 0) {
        const sorted = [...amounts].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        mpfsAllowed = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      } else {
        notes.push('No usable Medicare fee found for this code/site of service.');
      }
    }

    // Apply units multiplier
    const units = input.units ?? 1;
    if (mpfsAllowed && units > 1) {
      mpfsAllowed = mpfsAllowed * units;
      notes.push(`Medicare amount multiplied by ${units} units.`);
    }

    const billed = input.billedAmount ?? null;
    const allowed = input.allowedAmount ?? null;
    const patient = input.patientResponsibility ?? null;

    const billedVsMedicare = billed != null && mpfsAllowed != null && mpfsAllowed > 0
      ? billed / mpfsAllowed
      : null;
    const allowedVsMedicare = allowed != null && mpfsAllowed != null && mpfsAllowed > 0
      ? allowed / mpfsAllowed
      : null;
    const patientVsMedicare = patient != null && mpfsAllowed != null && mpfsAllowed > 0
      ? patient / mpfsAllowed
      : null;

    lines.push({
      cpt: input.cpt,
      modifier: input.modifier ?? null,
      description,
      serviceType,
      serviceTypeLabel,
      mpfsAllowed,
      mpfsSiteOfService: site,
      billedAmount: billed,
      allowedAmount: allowed,
      patientResponsibility: patient,
      billedVsMedicareRatio: billedVsMedicare,
      allowedVsMedicareRatio: allowedVsMedicare,
      patientVsMedicareRatio: patientVsMedicare,
      notes,
      ratioBadge: getRatioBadge(billedVsMedicare),
    });
  }

  // Aggregate by service type
  const byMap = new Map<ServiceType, { totalBilled: number; totalMedicareAllowed: number; totalAllowed: number }>();

  for (const line of lines) {
    const key = line.serviceType;
    const existing = byMap.get(key) ?? { totalBilled: 0, totalMedicareAllowed: 0, totalAllowed: 0 };
    
    if (line.billedAmount != null && line.billedAmount > 0) {
      existing.totalBilled += line.billedAmount;
    }
    if (line.mpfsAllowed != null && line.mpfsAllowed > 0) {
      existing.totalMedicareAllowed += line.mpfsAllowed;
    }
    if (line.allowedAmount != null && line.allowedAmount > 0) {
      existing.totalAllowed += line.allowedAmount;
    }
    
    byMap.set(key, existing);
  }

  const byServiceType: ServiceTypeSummary[] = Array.from(byMap.entries()).map(([serviceType, agg]) => {
    const ratio = agg.totalAllowed > 0 && agg.totalMedicareAllowed > 0
      ? agg.totalAllowed / agg.totalMedicareAllowed
      : null;
    
    return {
      serviceType,
      serviceTypeLabel: getServiceTypeLabel(serviceType),
      totalBilled: agg.totalBilled,
      totalMedicareAllowed: agg.totalMedicareAllowed,
      totalAllowed: agg.totalAllowed || null,
      avgAllowedVsMedicareRatio: ratio,
    };
  });

  // Overall summary
  const overallTotalBilled = byServiceType.reduce((sum, s) => sum + s.totalBilled, 0);
  const overallTotalMedicareAllowed = byServiceType.reduce((sum, s) => sum + s.totalMedicareAllowed, 0);
  const overallTotalAllowed = byServiceType.reduce((sum, s) => sum + (s.totalAllowed ?? 0), 0);

  return {
    lines,
    byServiceType,
    overallSummary: {
      totalBilled: overallTotalBilled,
      totalMedicareAllowed: overallTotalMedicareAllowed,
      totalAllowed: overallTotalAllowed || null,
      avgBilledVsMedicareRatio: overallTotalMedicareAllowed > 0
        ? overallTotalBilled / overallTotalMedicareAllowed
        : null,
    },
  };
}

/**
 * Format a ratio as a user-friendly string
 */
export function formatRatio(ratio: number | null | undefined): string {
  if (!ratio) return 'N/A';
  return `${ratio.toFixed(1)}×`;
}

/**
 * Get a description of what the ratio means
 */
export function getRatioDescription(ratio: number | null | undefined): string {
  if (!ratio) return '';
  if (ratio <= 1.2) return 'Close to Medicare rate';
  if (ratio <= 1.5) return 'Slightly above Medicare';
  if (ratio <= 2.5) return 'Moderately above Medicare';
  if (ratio <= 4) return 'Significantly above Medicare';
  return 'Very high compared to Medicare';
}
