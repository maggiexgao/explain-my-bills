/**
 * Totals Resolution Module
 * 
 * Deterministic reconciliation logic for extracted totals.
 * Decides which totals to use and why, with full transparency.
 * 
 * Key principles:
 * - Never use patient balance as "Total Billed" for Medicare multiples
 * - If only patient balance exists, show it labeled correctly but forbid multiple
 * - Prefer document total with high confidence, fall back to line item sum
 * - Full evidence trail for debugging
 */

import { StructuredTotals, DetectedTotal, TotalsConfidence } from './normalizeTotals';

// ============= Types =============

export type SelectedTotalSource = 'doc_total' | 'line_sum' | 'none';
export type SelectedBalanceSource = 'balance_due' | 'amount_due' | 'patient_responsibility' | 'none';

export interface ResolvedTotals {
  // For Medicare comparison (numerator)
  chargesTotal: number | null;
  chargesTotalConfidence: TotalsConfidence | null;
  chargesTotalLabel: string;
  selectedChargesSource: SelectedTotalSource;
  chargesEvidence: string;
  
  // For display (what patient may owe - NOT for multiples)
  patientBalance: number | null;
  patientBalanceConfidence: TotalsConfidence | null;
  patientBalanceLabel: string;
  selectedBalanceSource: SelectedBalanceSource;
  balanceEvidence: string;
  
  // Insurance info if available
  insurancePaid: number | null;
  adjustments: number | null;
  
  // Validation & transparency
  warnings: string[];
  derivationNotes: string[];
  canUseForMultiple: boolean;
  multipleBlockReason: string | null;
}

export interface LineItemWithBilled {
  code?: string;
  description?: string;
  billedAmount?: number | null;
  billedConfidence?: TotalsConfidence;
  billedEvidence?: string;
}

// ============= Constants =============

const MIN_LINE_ITEMS_FOR_SUM = 2;
const MIN_CONFIDENCE_FOR_DOC_TOTAL: TotalsConfidence = 'medium';

// ============= Main Function =============

/**
 * Resolve totals from extracted data + line items.
 * 
 * This is the single source of truth for what totals we use.
 * All UI and comparison logic should use this output.
 */
export function resolveTotals(
  extractedTotals: StructuredTotals | null,
  lineItems: LineItemWithBilled[]
): ResolvedTotals {
  const warnings: string[] = [];
  const derivationNotes: string[] = [];
  
  // Start with empty result
  let chargesTotal: number | null = null;
  let chargesTotalConfidence: TotalsConfidence | null = null;
  let chargesTotalLabel = 'Not detected';
  let selectedChargesSource: SelectedTotalSource = 'none';
  let chargesEvidence = '';
  
  let patientBalance: number | null = null;
  let patientBalanceConfidence: TotalsConfidence | null = null;
  let patientBalanceLabel = 'Not detected';
  let selectedBalanceSource: SelectedBalanceSource = 'none';
  let balanceEvidence = '';
  
  let insurancePaid: number | null = null;
  let adjustments: number | null = null;
  
  // ===== STEP 1: Try to get chargesTotal from extracted totals =====
  if (extractedTotals?.totalCharges && extractedTotals.totalCharges.value > 0) {
    const tc = extractedTotals.totalCharges;
    
    // Accept if confidence is high or medium
    if (tc.confidence === 'high' || tc.confidence === 'medium') {
      chargesTotal = tc.value;
      chargesTotalConfidence = tc.confidence;
      chargesTotalLabel = tc.label || 'Total Charges';
      selectedChargesSource = 'doc_total';
      chargesEvidence = tc.evidence || 'Extracted from document';
      derivationNotes.push(`Using document total: ${tc.label} = $${tc.value.toFixed(2)} (${tc.confidence} confidence)`);
    } else {
      derivationNotes.push(`Document total found but confidence too low: ${tc.confidence}`);
    }
  }
  
  // ===== STEP 2: If no doc total, try line item sum =====
  if (chargesTotal === null) {
    const itemsWithBilled = lineItems.filter(item => 
      item.billedAmount !== null && 
      item.billedAmount !== undefined && 
      item.billedAmount > 0
    );
    
    if (itemsWithBilled.length >= MIN_LINE_ITEMS_FOR_SUM) {
      const sum = itemsWithBilled.reduce((acc, item) => acc + (item.billedAmount || 0), 0);
      
      chargesTotal = sum;
      chargesTotalConfidence = itemsWithBilled.length >= 3 ? 'medium' : 'low';
      chargesTotalLabel = `Sum of ${itemsWithBilled.length} line items`;
      selectedChargesSource = 'line_sum';
      chargesEvidence = `Calculated by summing billed amounts from ${itemsWithBilled.length} line items`;
      
      derivationNotes.push(
        `Derived charges from ${itemsWithBilled.length} line items: $${sum.toFixed(2)} (${chargesTotalConfidence} confidence)`
      );
      
      if (chargesTotalConfidence === 'low') {
        warnings.push('Charges derived from limited line items - may not represent full bill');
      }
    } else if (itemsWithBilled.length === 1) {
      derivationNotes.push('Only 1 line item with billed amount - not enough to derive totals');
    }
  }
  
  // ===== STEP 3: Get patient balance (for display only, NOT for multiples) =====
  // Priority: balanceDue > amountDue > patientResponsibility
  const balanceCandidates: Array<{ 
    total: DetectedTotal; 
    source: SelectedBalanceSource;
    priority: number;
  }> = [];
  
  if (extractedTotals?.amountDue && extractedTotals.amountDue.value > 0) {
    const ad = extractedTotals.amountDue;
    // Check if this looks like a balance label vs charges label
    const isBalanceLabel = /balance|due|owe|pay|amount due/i.test(ad.label || '');
    if (isBalanceLabel || ad.label?.toLowerCase().includes('due')) {
      balanceCandidates.push({ total: ad, source: 'balance_due', priority: 1 });
    } else {
      balanceCandidates.push({ total: ad, source: 'amount_due', priority: 2 });
    }
  }
  
  if (extractedTotals?.patientResponsibility && extractedTotals.patientResponsibility.value > 0) {
    balanceCandidates.push({ 
      total: extractedTotals.patientResponsibility, 
      source: 'patient_responsibility', 
      priority: 3 
    });
  }
  
  // Sort by priority and take best
  balanceCandidates.sort((a, b) => a.priority - b.priority);
  
  if (balanceCandidates.length > 0) {
    const best = balanceCandidates[0];
    patientBalance = best.total.value;
    patientBalanceConfidence = best.total.confidence;
    patientBalanceLabel = best.total.label || 'Amount Due';
    selectedBalanceSource = best.source;
    balanceEvidence = best.total.evidence || 'Extracted from document';
    
    derivationNotes.push(
      `Patient balance: ${best.total.label} = $${best.total.value.toFixed(2)} (source: ${best.source})`
    );
  }
  
  // ===== STEP 4: Get insurance/adjustment info if available =====
  if (extractedTotals?.insurancePaid && extractedTotals.insurancePaid.value > 0) {
    insurancePaid = extractedTotals.insurancePaid.value;
    derivationNotes.push(`Insurance paid: $${insurancePaid.toFixed(2)}`);
  }
  
  if (extractedTotals?.totalPaymentsAndAdjustments && extractedTotals.totalPaymentsAndAdjustments.value !== 0) {
    adjustments = extractedTotals.totalPaymentsAndAdjustments.value;
    derivationNotes.push(`Adjustments: $${adjustments.toFixed(2)}`);
  }
  
  // ===== STEP 5: Determine if we can compute a multiple =====
  let canUseForMultiple = false;
  let multipleBlockReason: string | null = null;
  
  if (chargesTotal !== null && chargesTotal > 0) {
    if (chargesTotalConfidence === 'high' || chargesTotalConfidence === 'medium') {
      canUseForMultiple = true;
    } else {
      multipleBlockReason = 'Charges confidence too low for reliable comparison';
    }
  } else if (patientBalance !== null && patientBalance > 0) {
    // We have patient balance but NOT charges
    multipleBlockReason = 'Only patient balance detected (not total charges). ' +
      'Medicare reference is based on full service pricing, not post-insurance balance.';
    warnings.push(
      'Patient balance cannot be compared to Medicare reference - these are different scopes.'
    );
  } else {
    multipleBlockReason = 'No totals detected in document';
  }
  
  // ===== STEP 6: Add any warnings from extraction =====
  if (extractedTotals?.notes) {
    for (const note of extractedTotals.notes) {
      if (note.toLowerCase().includes('rejected') || note.toLowerCase().includes('warning')) {
        warnings.push(note);
      } else {
        derivationNotes.push(note);
      }
    }
  }
  
  return {
    chargesTotal,
    chargesTotalConfidence,
    chargesTotalLabel,
    selectedChargesSource,
    chargesEvidence,
    
    patientBalance,
    patientBalanceConfidence,
    patientBalanceLabel,
    selectedBalanceSource,
    balanceEvidence,
    
    insurancePaid,
    adjustments,
    
    warnings,
    derivationNotes,
    canUseForMultiple,
    multipleBlockReason
  };
}

/**
 * Format resolved totals for UI display
 */
export function formatResolvedTotalsForUI(resolved: ResolvedTotals): {
  chargesDisplay: string;
  balanceDisplay: string;
  comparisonStatus: 'ready' | 'limited' | 'blocked';
  statusMessage: string;
} {
  const formatCurrency = (amount: number | null) => 
    amount !== null 
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
      : 'Not detected';
  
  return {
    chargesDisplay: resolved.chargesTotal !== null 
      ? `${formatCurrency(resolved.chargesTotal)} (${resolved.chargesTotalLabel})`
      : 'Not detected',
    balanceDisplay: resolved.patientBalance !== null
      ? `${formatCurrency(resolved.patientBalance)} (${resolved.patientBalanceLabel})`
      : 'Not detected',
    comparisonStatus: resolved.canUseForMultiple 
      ? 'ready' 
      : (resolved.chargesTotal !== null ? 'limited' : 'blocked'),
    statusMessage: resolved.multipleBlockReason || 'Ready for comparison'
  };
}
