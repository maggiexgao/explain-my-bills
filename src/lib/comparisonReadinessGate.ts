/**
 * Comparison Readiness Gate
 * 
 * Central truth for whether we can safely compute and display a Medicare multiple.
 * This prevents misleading comparisons by ensuring scope alignment.
 * 
 * Rules:
 * 1. Multiple ONLY when numerator scope matches denominator scope
 * 2. Prefer matched_billed_total vs medicare_reference_matched_total
 * 3. NEVER compute multiple using patientBalance or amountDue
 * 4. If totals are null/unknown: show "Not detected" not $0
 */

import { MedicareBenchmarkOutput } from './medicareBenchmarkService';
import { StructuredTotals, ComparisonTotalSelection, selectComparisonTotal } from './totals/normalizeTotals';

// ============= Types =============

export type ReadinessStatus = 'ready' | 'limited_data' | 'not_possible';

export type NumeratorType = 'matched_billed_total' | 'document_total_charges' | 'none';
export type DenominatorType = 'medicare_reference_matched_total' | 'none';

export interface CoverageInfo {
  extractedLineItems: number;
  matchedLineItems: number;
  pricedItems: number;
  matchedBilledTotalPresent: boolean;
  matchedMedicareTotalPresent: boolean;
  coveragePercent: number;
}

export interface ComparisonModel {
  numeratorType: NumeratorType;
  numeratorValue: number | null;
  numeratorLabel: string;
  denominatorType: DenominatorType;
  denominatorValue: number | null;
  denominatorLabel: string;
  canComputeMultiple: boolean;
  multiple: number | null;
  coverage: CoverageInfo;
  scopeWarnings: string[];
  comparisonBasis: 'matched_items' | 'document_total' | 'none';
  explanation: string;
}

export interface ReadinessResult {
  status: ReadinessStatus;
  reasons: string[];
  comparisonModel: ComparisonModel;
}

// ============= Constants =============

// Minimum coverage threshold to allow document_total_charges comparison
const MIN_COVERAGE_FOR_DOC_TOTAL = 0.7; // 70%

// Minimum matched items to consider a comparison valid
const MIN_MATCHED_ITEMS = 1;

// ============= Main Function =============

/**
 * Compute comparison readiness for a given analysis result.
 * 
 * This is the SINGLE SOURCE OF TRUTH for:
 * - Whether we can show a multiple
 * - What numbers we're comparing
 * - What warnings to display
 */
export function computeComparisonReadiness(
  benchmarkOutput: MedicareBenchmarkOutput | null,
  structuredTotals?: StructuredTotals | null
): ReadinessResult {
  const reasons: string[] = [];
  const scopeWarnings: string[] = [];
  
  // Default "not possible" result
  const notPossibleResult = (reason: string): ReadinessResult => ({
    status: 'not_possible',
    reasons: [reason],
    comparisonModel: {
      numeratorType: 'none',
      numeratorValue: null,
      numeratorLabel: 'Not available',
      denominatorType: 'none',
      denominatorValue: null,
      denominatorLabel: 'Not available',
      canComputeMultiple: false,
      multiple: null,
      coverage: {
        extractedLineItems: 0,
        matchedLineItems: 0,
        pricedItems: 0,
        matchedBilledTotalPresent: false,
        matchedMedicareTotalPresent: false,
        coveragePercent: 0
      },
      scopeWarnings: [reason],
      comparisonBasis: 'none',
      explanation: reason
    }
  });
  
  // No benchmark output at all
  if (!benchmarkOutput) {
    return notPossibleResult('No Medicare benchmark data available');
  }
  
  // Extract matched items comparison data
  const matched = benchmarkOutput.matchedItemsComparison;
  const totals = benchmarkOutput.totals;
  
  // Build coverage info
  const coverage: CoverageInfo = {
    extractedLineItems: matched?.totalItemsCount || benchmarkOutput.lineItems.length,
    matchedLineItems: matched?.matchedItemsCount || 0,
    pricedItems: benchmarkOutput.lineItems.filter(i => i.matchStatus === 'matched').length,
    matchedBilledTotalPresent: (matched?.matchedBilledTotal ?? 0) > 0,
    matchedMedicareTotalPresent: (matched?.matchedMedicareTotal ?? 0) > 0,
    coveragePercent: matched?.coveragePercent ?? 0
  };
  
  // ===== PATH 1: Matched Items Comparison (PREFERRED) =====
  // This is the most accurate because we're comparing apples to apples
  if (matched?.isValidComparison && 
      matched.matchedBilledTotal && matched.matchedBilledTotal > 0 &&
      matched.matchedMedicareTotal && matched.matchedMedicareTotal > 0 &&
      matched.matchedItemsCount >= MIN_MATCHED_ITEMS) {
    
    const multiple = matched.matchedBilledTotal / matched.matchedMedicareTotal;
    
    // Check if coverage is partial
    if (coverage.coveragePercent < 1) {
      scopeWarnings.push(
        `Comparison includes ${coverage.pricedItems} of ${coverage.extractedLineItems} line items (${Math.round(coverage.coveragePercent * 100)}% coverage)`
      );
    }
    
    return {
      status: 'ready',
      reasons: [`Matched ${coverage.pricedItems} items with both billed amounts and Medicare prices`],
      comparisonModel: {
        numeratorType: 'matched_billed_total',
        numeratorValue: matched.matchedBilledTotal,
        numeratorLabel: `Matched Charges (${coverage.pricedItems} items)`,
        denominatorType: 'medicare_reference_matched_total',
        denominatorValue: matched.matchedMedicareTotal,
        denominatorLabel: 'Medicare Reference (matched)',
        canComputeMultiple: true,
        multiple,
        coverage,
        scopeWarnings,
        comparisonBasis: 'matched_items',
        explanation: `Comparing billed charges ($${matched.matchedBilledTotal.toLocaleString()}) to Medicare reference ($${matched.matchedMedicareTotal.toLocaleString()}) for ${coverage.pricedItems} matched line items.`
      }
    };
  }
  
  // ===== PATH 2: Document Total Charges vs Medicare Reference =====
  // Only allowed if we have totalCharges (not patient balance) AND high coverage
  if (structuredTotals?.totalCharges && structuredTotals.totalCharges.value > 0) {
    const docTotal = structuredTotals.totalCharges.value;
    const medicareTotal = benchmarkOutput.totals.medicareReferenceTotal;
    
    // Check if we have enough coverage to make this comparison meaningful
    if (medicareTotal && medicareTotal > 0 && 
        coverage.coveragePercent >= MIN_COVERAGE_FOR_DOC_TOTAL &&
        coverage.pricedItems >= MIN_MATCHED_ITEMS) {
      
      const multiple = docTotal / medicareTotal;
      
      scopeWarnings.push(
        'Comparison uses document total charges vs matched Medicare reference'
      );
      
      if (coverage.coveragePercent < 1) {
        scopeWarnings.push(
          `Only ${Math.round(coverage.coveragePercent * 100)}% of line items could be matched`
        );
      }
      
      return {
        status: 'ready',
        reasons: [
          `Using document total charges ($${docTotal.toLocaleString()})`,
          `Coverage: ${Math.round(coverage.coveragePercent * 100)}%`
        ],
        comparisonModel: {
          numeratorType: 'document_total_charges',
          numeratorValue: docTotal,
          numeratorLabel: structuredTotals.totalCharges.label || 'Total Charges',
          denominatorType: 'medicare_reference_matched_total',
          denominatorValue: medicareTotal,
          denominatorLabel: 'Medicare Reference',
          canComputeMultiple: true,
          multiple,
          coverage,
          scopeWarnings,
          comparisonBasis: 'document_total',
          explanation: `Comparing document total charges ($${docTotal.toLocaleString()}) to Medicare reference ($${medicareTotal.toLocaleString()}). ${structuredTotals.totalCharges.confidence} confidence.`
        }
      };
    }
  }
  
  // ===== PATH 3: Limited Data - Patient Balance Only =====
  // We found a patient balance but NOT total charges - cannot compute meaningful multiple
  const patientTotal = structuredTotals?.patientResponsibility || structuredTotals?.amountDue;
  if (patientTotal && patientTotal.value > 0) {
    reasons.push('Only patient balance detected (not total charges)');
    scopeWarnings.push(
      'Patient balance detected instead of total charges.',
      'Medicare reference is based on full service pricing, not post-insurance balance.',
      'We cannot compute a meaningful multiple from this.'
    );
    
    return {
      status: 'limited_data',
      reasons,
      comparisonModel: {
        numeratorType: 'none',
        numeratorValue: patientTotal.value,
        numeratorLabel: patientTotal.label || 'Patient Balance',
        denominatorType: benchmarkOutput.totals.medicareReferenceTotal ? 'medicare_reference_matched_total' : 'none',
        denominatorValue: benchmarkOutput.totals.medicareReferenceTotal,
        denominatorLabel: 'Medicare Reference',
        canComputeMultiple: false,
        multiple: null,
        coverage,
        scopeWarnings,
        comparisonBasis: 'none',
        explanation: `Found "${patientTotal.label}" ($${patientTotal.value.toLocaleString()}), which is your remaining balance after insurance. This cannot be compared to Medicare reference prices.`
      }
    };
  }
  
  // ===== PATH 4: No Totals Detected =====
  if (!totals.billedTotalDetected || (totals.billedTotal === null || totals.billedTotal === 0)) {
    // Check if we at least have Medicare reference
    if (benchmarkOutput.totals.medicareReferenceTotal && benchmarkOutput.totals.medicareReferenceTotal > 0) {
      reasons.push('No billed amounts detected in document');
      scopeWarnings.push(
        'Could not extract billed amounts from the document.',
        'Medicare reference prices are available for matched services.'
      );
      
      return {
        status: 'limited_data',
        reasons,
        comparisonModel: {
          numeratorType: 'none',
          numeratorValue: null,
          numeratorLabel: 'Not detected',
          denominatorType: 'medicare_reference_matched_total',
          denominatorValue: benchmarkOutput.totals.medicareReferenceTotal,
          denominatorLabel: 'Medicare Reference',
          canComputeMultiple: false,
          multiple: null,
          coverage,
          scopeWarnings,
          comparisonBasis: 'none',
          explanation: 'No billed amounts could be extracted from this document. Medicare reference prices are shown for informational purposes.'
        }
      };
    }
    
    return notPossibleResult('No billed amounts or Medicare prices available');
  }
  
  // ===== PATH 5: Low Coverage =====
  if (coverage.coveragePercent < MIN_COVERAGE_FOR_DOC_TOTAL) {
    reasons.push(`Low coverage: only ${Math.round(coverage.coveragePercent * 100)}% of items priced`);
    scopeWarnings.push(
      `Only ${coverage.pricedItems} of ${coverage.extractedLineItems} line items could be matched to Medicare prices.`,
      'Comparison would not be representative of the full bill.'
    );
    
    return {
      status: 'limited_data',
      reasons,
      comparisonModel: {
        numeratorType: 'none',
        numeratorValue: totals.billedTotal,
        numeratorLabel: 'Billed Total',
        denominatorType: 'medicare_reference_matched_total',
        denominatorValue: benchmarkOutput.totals.medicareReferenceTotal,
        denominatorLabel: 'Medicare Reference (partial)',
        canComputeMultiple: false,
        multiple: null,
        coverage,
        scopeWarnings,
        comparisonBasis: 'none',
        explanation: `Low coverage (${Math.round(coverage.coveragePercent * 100)}%) - comparison would not be representative.`
      }
    };
  }
  
  // ===== FALLBACK: Something went wrong =====
  return notPossibleResult('Unable to determine comparison readiness');
}

// ============= Helper Functions =============

/**
 * Format a readiness result for display in UI
 */
export function formatReadinessForUI(result: ReadinessResult): {
  canShowMultiple: boolean;
  multipleValue: number | null;
  multipleLabel: string;
  statusBadge: 'success' | 'warning' | 'error';
  statusLabel: string;
  explanation: string;
  warnings: string[];
} {
  const model = result.comparisonModel;
  
  if (result.status === 'ready' && model.canComputeMultiple && model.multiple !== null) {
    return {
      canShowMultiple: true,
      multipleValue: model.multiple,
      multipleLabel: `${model.multiple.toFixed(1)}× Medicare`,
      statusBadge: 'success',
      statusLabel: 'Comparison Ready',
      explanation: model.explanation,
      warnings: model.scopeWarnings
    };
  }
  
  if (result.status === 'limited_data') {
    return {
      canShowMultiple: false,
      multipleValue: null,
      multipleLabel: 'Limited Data',
      statusBadge: 'warning',
      statusLabel: 'Limited Data',
      explanation: model.explanation,
      warnings: model.scopeWarnings
    };
  }
  
  return {
    canShowMultiple: false,
    multipleValue: null,
    multipleLabel: 'Not Available',
    statusBadge: 'error',
    statusLabel: 'Comparison Not Possible',
    explanation: model.explanation || result.reasons[0] || 'Unable to compute comparison',
    warnings: model.scopeWarnings
  };
}

/**
 * Get a user-friendly status explanation
 */
export function getStatusExplanation(status: ReadinessStatus): string {
  switch (status) {
    case 'ready':
      return 'We have enough information to show how your charges compare to Medicare reference prices.';
    case 'limited_data':
      return 'We found some information but cannot compute a meaningful comparison. See details below.';
    case 'not_possible':
      return 'Unable to compare this document to Medicare reference prices.';
  }
}
