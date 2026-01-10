/**
 * Totals Extraction and Reconciliation
 * 
 * This module handles:
 * 1. Document type classification
 * 2. Totals candidate extraction with label anchoring
 * 3. Line item extraction and sum calculation
 * 4. Reconciliation and comparison total selection
 * 
 * The goal is to reliably extract what the user actually owes and provide
 * transparent reasoning for the comparison total used.
 */

// ============= Type Definitions =============

export type DocumentClassification = 
  | 'itemized_statement'
  | 'eob'
  | 'portal_summary'
  | 'payment_receipt'
  | 'unknown';

export type TotalType = 
  | 'charges'
  | 'allowed'
  | 'patient_responsibility'
  | 'insurance_paid'
  | 'unknown';

export interface TotalCandidate {
  type: TotalType;
  amount: number;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
  nearbyContext?: string;
}

export interface LineItemExtraction {
  description: string;
  chargeAmount?: number;
  allowedAmount?: number;
  patientAmount?: number;
  code?: string;
}

export interface TotalsReconciliation {
  lineItems: LineItemExtraction[];
  sumLineCharges: number;
  sumLineAllowed: number | null;
  sumLinePatient: number | null;
  
  // Candidates for each total type
  chargesCandidates: TotalCandidate[];
  allowedCandidates: TotalCandidate[];
  patientCandidates: TotalCandidate[];
  
  // Chosen comparison total
  comparisonTotal: {
    value: number;
    type: TotalType;
    confidence: 'high' | 'medium' | 'low';
    explanation: string;
    limitedComparability: boolean;
  } | null;
  
  // Document classification
  documentType: DocumentClassification;
  
  // Reconciliation status
  reconciliationStatus: 'matched' | 'mismatch' | 'insufficient_data';
  reconciliationNote?: string;
}

// ============= Label Patterns =============

const CHARGES_LABELS = [
  'total charges', 'total billed', 'charges', 'total amount', 
  'amount billed', 'billed amount', 'gross charges', 'total due',
  'statement total', 'hospital charges'
];

const ALLOWED_LABELS = [
  'allowed', 'allowed amount', 'negotiated', 'contracted', 
  'plan discounted', 'insurance allowed', 'your plan rate',
  'contracted rate', 'plan rate'
];

const PATIENT_LABELS = [
  'amount due', 'balance', 'your balance', 'patient responsibility',
  'you owe', 'amount you owe', 'your responsibility', 'pay this amount',
  'total patient', 'patient due', 'payment due', 'balance due',
  'current balance'
];

const INSURANCE_LABELS = [
  'insurance paid', 'plan paid', 'insurance payment', 'payments',
  'amount paid', 'paid by insurance', 'paid by plan'
];

// Document type indicators
const EOB_INDICATORS = [
  'explanation of benefits', 'eob', 'allowed amount', 'plan paid',
  'member responsibility', 'claim number', 'processed date',
  'coinsurance', 'copay', 'deductible applied'
];

const PORTAL_INDICATORS = [
  'mychart', 'patient portal', 'online balance', 'your balance',
  'quick pay', 'make a payment', 'payment options'
];

const STATEMENT_INDICATORS = [
  'statement', 'itemized bill', 'service date', 'procedure',
  'charges', 'billing statement', 'date of service', 'quantity'
];

// ============= Helper Functions =============

/**
 * Clean and parse a currency string to number
 */
export function parseCurrency(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  
  const cleaned = String(value)
    .replace(/[$,\s]/g, '')
    .replace(/[()]/g, match => match === '(' ? '-' : '')
    .trim();
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Score how well a label matches our target patterns
 */
function scoreLabelMatch(text: string, patterns: string[]): number {
  const lower = text.toLowerCase().trim();
  let score = 0;
  
  for (const pattern of patterns) {
    if (lower === pattern) {
      score += 10; // Exact match
    } else if (lower.includes(pattern)) {
      score += 5; // Contains pattern
    } else {
      // Check word overlap
      const patternWords = pattern.split(' ');
      const textWords = lower.split(/\s+/);
      const overlap = patternWords.filter(w => textWords.includes(w)).length;
      score += overlap * 2;
    }
  }
  
  return score;
}

/**
 * Classify document type based on content indicators
 */
export function classifyDocument(content: string): DocumentClassification {
  const lower = content.toLowerCase();
  
  // Score each type
  const eobScore = EOB_INDICATORS.reduce((acc, ind) => 
    acc + (lower.includes(ind) ? 2 : 0), 0);
  const portalScore = PORTAL_INDICATORS.reduce((acc, ind) => 
    acc + (lower.includes(ind) ? 2 : 0), 0);
  const statementScore = STATEMENT_INDICATORS.reduce((acc, ind) => 
    acc + (lower.includes(ind) ? 2 : 0), 0);
  
  // Check for payment receipt indicators
  const isReceipt = lower.includes('receipt') || lower.includes('payment received') ||
                    (lower.includes('paid') && lower.includes('thank you'));
  
  if (isReceipt && !lower.includes('charges')) {
    return 'payment_receipt';
  }
  
  if (eobScore >= 6 && eobScore > statementScore) {
    return 'eob';
  }
  
  if (portalScore >= 4 && !lower.includes('itemized')) {
    return 'portal_summary';
  }
  
  if (statementScore >= 4) {
    return 'itemized_statement';
  }
  
  return 'unknown';
}

/**
 * Extract total candidates from analysis data
 */
export function extractTotalCandidates(
  analysisData: any,
  documentContent?: string
): {
  chargesCandidates: TotalCandidate[];
  allowedCandidates: TotalCandidate[];
  patientCandidates: TotalCandidate[];
} {
  const chargesCandidates: TotalCandidate[] = [];
  const allowedCandidates: TotalCandidate[] = [];
  const patientCandidates: TotalCandidate[] = [];
  
  // Extract from atAGlance if available
  if (analysisData.atAGlance) {
    if (analysisData.atAGlance.totalBilled && analysisData.atAGlance.totalBilled > 0) {
      chargesCandidates.push({
        type: 'charges',
        amount: analysisData.atAGlance.totalBilled,
        label: 'Total Billed (at a glance)',
        confidence: 'high',
        evidence: 'Extracted from document summary'
      });
    }
    
    if (analysisData.atAGlance.amountYouMayOwe && analysisData.atAGlance.amountYouMayOwe > 0) {
      patientCandidates.push({
        type: 'patient_responsibility',
        amount: analysisData.atAGlance.amountYouMayOwe,
        label: 'Amount You May Owe',
        confidence: 'high',
        evidence: 'Extracted from document summary'
      });
    }
  }
  
  // Extract from charges array sum
  if (analysisData.charges && Array.isArray(analysisData.charges)) {
    const chargeSum = analysisData.charges.reduce((sum: number, c: any) => {
      const amount = parseCurrency(c.amount);
      return sum + (amount || 0);
    }, 0);
    
    if (chargeSum > 0) {
      chargesCandidates.push({
        type: 'charges',
        amount: chargeSum,
        label: 'Sum of line items',
        confidence: 'medium',
        evidence: `Calculated from ${analysisData.charges.length} line items`
      });
    }
  }
  
  // Extract from EOB data if present
  if (analysisData.eobData) {
    const eob = analysisData.eobData;
    
    if (eob.billedAmount > 0) {
      chargesCandidates.push({
        type: 'charges',
        amount: eob.billedAmount,
        label: 'EOB Billed Amount',
        confidence: 'high',
        evidence: 'From Explanation of Benefits'
      });
    }
    
    if (eob.allowedAmount > 0) {
      allowedCandidates.push({
        type: 'allowed',
        amount: eob.allowedAmount,
        label: 'EOB Allowed Amount',
        confidence: 'high',
        evidence: 'From Explanation of Benefits'
      });
    }
    
    if (eob.patientResponsibility > 0) {
      patientCandidates.push({
        type: 'patient_responsibility',
        amount: eob.patientResponsibility,
        label: 'EOB Patient Responsibility',
        confidence: 'high',
        evidence: 'From Explanation of Benefits'
      });
    }
  }
  
  // Extract from billingEducation
  if (analysisData.billingEducation?.billedVsAllowed) {
    const text = analysisData.billingEducation.billedVsAllowed;
    const amountMatch = text.match(/\$([0-9,]+(?:\.[0-9]{2})?)/);
    if (amountMatch) {
      const amount = parseCurrency(amountMatch[1]);
      if (amount && amount > 0) {
        chargesCandidates.push({
          type: 'charges',
          amount,
          label: 'From billing education text',
          confidence: 'medium',
          evidence: text.substring(0, 100)
        });
      }
    }
  }
  
  // Sort candidates by confidence
  const sortByConfidence = (a: TotalCandidate, b: TotalCandidate) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.confidence] - order[b.confidence];
  };
  
  chargesCandidates.sort(sortByConfidence);
  allowedCandidates.sort(sortByConfidence);
  patientCandidates.sort(sortByConfidence);
  
  return { chargesCandidates, allowedCandidates, patientCandidates };
}

/**
 * Select the best comparison total based on available data
 */
export function selectComparisonTotal(
  candidates: ReturnType<typeof extractTotalCandidates>,
  documentType: DocumentClassification
): TotalsReconciliation['comparisonTotal'] {
  const { chargesCandidates, allowedCandidates, patientCandidates } = candidates;
  
  // Priority 1: Allowed amount (best for comparison)
  if (allowedCandidates.length > 0 && allowedCandidates[0].confidence !== 'low') {
    const best = allowedCandidates[0];
    return {
      value: best.amount,
      type: 'allowed',
      confidence: best.confidence,
      explanation: `Using the allowed amount (${best.label}) as this represents what insurance agreed to pay for these services.`,
      limitedComparability: false
    };
  }
  
  // Priority 2: Charges/Total Billed
  if (chargesCandidates.length > 0 && chargesCandidates[0].confidence !== 'low') {
    const best = chargesCandidates[0];
    return {
      value: best.amount,
      type: 'charges',
      confidence: best.confidence,
      explanation: `Using total charges (${best.label}) as the comparison basis.`,
      limitedComparability: false
    };
  }
  
  // Priority 3: Patient Responsibility (limited comparability)
  if (patientCandidates.length > 0) {
    const best = patientCandidates[0];
    return {
      value: best.amount,
      type: 'patient_responsibility',
      confidence: best.confidence,
      explanation: `Only patient responsibility amount was available. This may already include insurance adjustments, making direct Medicare comparison less meaningful.`,
      limitedComparability: true
    };
  }
  
  // No valid total found
  return null;
}

/**
 * Full reconciliation pipeline
 */
export function reconcileTotals(
  analysisData: any,
  documentContent?: string
): TotalsReconciliation {
  // Classify document
  const documentType = documentContent 
    ? classifyDocument(documentContent) 
    : 'unknown';
  
  // Extract line items
  const lineItems: LineItemExtraction[] = [];
  if (analysisData.charges && Array.isArray(analysisData.charges)) {
    for (const charge of analysisData.charges) {
      lineItems.push({
        description: charge.description || '',
        chargeAmount: parseCurrency(charge.amount) || undefined,
        code: charge.code
      });
    }
  }
  
  // Calculate sums
  const sumLineCharges = lineItems.reduce((sum, item) => 
    sum + (item.chargeAmount || 0), 0);
  
  const hasAllowed = lineItems.some(i => i.allowedAmount !== undefined);
  const sumLineAllowed = hasAllowed 
    ? lineItems.reduce((sum, item) => sum + (item.allowedAmount || 0), 0)
    : null;
  
  const hasPatient = lineItems.some(i => i.patientAmount !== undefined);
  const sumLinePatient = hasPatient
    ? lineItems.reduce((sum, item) => sum + (item.patientAmount || 0), 0)
    : null;
  
  // Extract total candidates
  const candidates = extractTotalCandidates(analysisData, documentContent);
  
  // Select comparison total
  const comparisonTotal = selectComparisonTotal(candidates, documentType);
  
  // Determine reconciliation status
  let reconciliationStatus: TotalsReconciliation['reconciliationStatus'] = 'insufficient_data';
  let reconciliationNote: string | undefined;
  
  if (comparisonTotal && lineItems.length > 0 && sumLineCharges > 0) {
    const tolerance = 0.03; // 3% tolerance
    const diff = Math.abs(comparisonTotal.value - sumLineCharges);
    const percentDiff = diff / sumLineCharges;
    
    if (percentDiff <= tolerance) {
      reconciliationStatus = 'matched';
      reconciliationNote = 'Line item sum matches the total within 3% tolerance.';
    } else {
      reconciliationStatus = 'mismatch';
      reconciliationNote = `Line item sum ($${sumLineCharges.toFixed(2)}) differs from total ($${comparisonTotal.value.toFixed(2)}) by ${(percentDiff * 100).toFixed(1)}%.`;
    }
  }
  
  return {
    lineItems,
    sumLineCharges,
    sumLineAllowed,
    sumLinePatient,
    chargesCandidates: candidates.chargesCandidates,
    allowedCandidates: candidates.allowedCandidates,
    patientCandidates: candidates.patientCandidates,
    comparisonTotal,
    documentType,
    reconciliationStatus,
    reconciliationNote
  };
}

/**
 * Generate user-friendly label for the comparison total
 */
export function formatComparisonTotalLabel(type: TotalType): string {
  switch (type) {
    case 'charges':
      return 'TOTAL (Charges)';
    case 'allowed':
      return 'TOTAL (Allowed)';
    case 'patient_responsibility':
      return 'TOTAL (Patient Responsibility)';
    case 'insurance_paid':
      return 'TOTAL (Insurance Paid)';
    default:
      return 'TOTAL';
  }
}
