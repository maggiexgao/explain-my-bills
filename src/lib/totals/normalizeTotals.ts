/**
 * Totals Normalization and Derivation Module
 * 
 * Handles:
 * 1. Parsing/cleaning currency values from AI output
 * 2. Validating totals (rejecting invalid 0s, negative values, etc.)
 * 3. Deriving totals from line items when not extracted
 * 4. Never outputting $0 unless explicitly stated with high confidence
 */

// ============= Types =============

export type TotalsConfidence = 'high' | 'medium' | 'low';
export type TotalsSource = 'ai' | 'derived_line_items' | 'user_input' | 'document_label';

export interface DetectedTotal {
  value: number;
  confidence: TotalsConfidence;
  evidence: string;  // Exact text snippet found in document
  label: string;     // Label found on document (e.g., "Total Charges", "Balance Due")
  source: TotalsSource;
}

export interface StructuredTotals {
  totalCharges?: DetectedTotal | null;
  totalPaymentsAndAdjustments?: DetectedTotal | null;
  patientResponsibility?: DetectedTotal | null;
  amountDue?: DetectedTotal | null;
  insurancePaid?: DetectedTotal | null;
  lineItemsSum?: number | null;
  notes: string[];
}

export interface LineItemForTotals {
  description?: string;
  billedAmount?: number | null;
  billedAmountConfidence?: TotalsConfidence;
  billedEvidence?: string;
  code?: string;
  units?: number;
}

// ============= Currency Parsing =============

/**
 * Parse a currency string or number to a clean number value.
 * Handles: $1,234.56, (1,234.56) for negatives, currency symbols, etc.
 */
export function parseCurrencyValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  if (typeof value !== 'string') return null;
  
  const str = String(value).trim();
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'n/a') {
    return null;
  }
  
  // Handle negative in parentheses: (1,234.56) → -1234.56
  let isNegative = false;
  let cleaned = str;
  
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(1);
  }
  
  // Remove currency symbols and separators
  cleaned = cleaned.replace(/[$£€¥,\s]/g, '');
  
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  
  return isNegative ? -num : num;
}

// ============= Validation =============

/**
 * Validate a detected total. Returns null if invalid.
 * 
 * Rules:
 * - Reject 0 unless confidence is high AND evidence contains "0" or "$0"
 * - Reject negative values (except for adjustments/payments)
 * - Reject tiny values (<$1) unless document clearly states them
 */
export function validateDetectedTotal(
  total: DetectedTotal | null | undefined,
  allowNegative: boolean = false,
  fieldName: string = 'total'
): { valid: DetectedTotal | null; notes: string[] } {
  const notes: string[] = [];
  
  if (!total) {
    return { valid: null, notes };
  }
  
  const value = total.value;
  
  // Check for 0 without proper evidence
  if (value === 0) {
    const evidenceHasZero = total.evidence?.match(/\$0|0\.00|zero/i);
    if (total.confidence !== 'high' || !evidenceHasZero) {
      notes.push(`${fieldName}: Rejected $0 (not explicitly stated with high confidence)`);
      return { valid: null, notes };
    }
  }
  
  // Check for negative values
  if (value < 0 && !allowNegative) {
    notes.push(`${fieldName}: Rejected negative value $${value.toFixed(2)}`);
    return { valid: null, notes };
  }
  
  // Check for suspiciously tiny values
  if (value > 0 && value < 1) {
    if (total.confidence !== 'high') {
      notes.push(`${fieldName}: Rejected tiny value $${value.toFixed(2)} (confidence not high)`);
      return { valid: null, notes };
    }
  }
  
  return { valid: total, notes };
}

// ============= AI Response Normalization =============

/**
 * Normalize the extractedTotals object from AI response.
 * Handles both old flat format and new structured format.
 */
export function normalizeExtractedTotals(raw: unknown): StructuredTotals {
  const result: StructuredTotals = { notes: [] };
  
  if (!raw || typeof raw !== 'object') {
    result.notes.push('No extractedTotals in AI response');
    return result;
  }
  
  const data = raw as Record<string, unknown>;
  
  // Helper to parse a total field (handles both formats)
  const parseTotal = (
    field: unknown,
    defaultLabel: string,
    source: TotalsSource = 'ai'
  ): DetectedTotal | null => {
    if (!field) return null;
    
    // New structured format: { value, confidence, evidence, label }
    if (typeof field === 'object' && field !== null) {
      const obj = field as Record<string, unknown>;
      const value = parseCurrencyValue(obj.value);
      if (value === null) return null;
      
      return {
        value,
        confidence: (obj.confidence as TotalsConfidence) || 'medium',
        evidence: String(obj.evidence || ''),
        label: String(obj.label || defaultLabel),
        source
      };
    }
    
    // Old flat format: just a number
    if (typeof field === 'number' || typeof field === 'string') {
      const value = parseCurrencyValue(field);
      if (value === null) return null;
      
      return {
        value,
        confidence: 'medium',
        evidence: `Extracted value: ${field}`,
        label: defaultLabel,
        source
      };
    }
    
    return null;
  };
  
  // Parse each total type
  const tcRaw = parseTotal(data.totalCharges, 'Total Charges');
  const { valid: totalCharges, notes: tcNotes } = validateDetectedTotal(tcRaw, false, 'totalCharges');
  result.totalCharges = totalCharges;
  result.notes.push(...tcNotes);
  
  const paRaw = parseTotal(data.totalPaymentsAndAdjustments, 'Payments/Adjustments');
  const { valid: totalPaymentsAndAdjustments, notes: paNotes } = validateDetectedTotal(paRaw, true, 'payments');
  result.totalPaymentsAndAdjustments = totalPaymentsAndAdjustments;
  result.notes.push(...paNotes);
  
  const prRaw = parseTotal(data.patientResponsibility, 'Patient Responsibility');
  const { valid: patientResponsibility, notes: prNotes } = validateDetectedTotal(prRaw, false, 'patientResponsibility');
  result.patientResponsibility = patientResponsibility;
  result.notes.push(...prNotes);
  
  const adRaw = parseTotal(data.amountDue, 'Amount Due');
  const { valid: amountDue, notes: adNotes } = validateDetectedTotal(adRaw, false, 'amountDue');
  result.amountDue = amountDue;
  result.notes.push(...adNotes);
  
  const ipRaw = parseTotal(data.insurancePaid, 'Insurance Paid');
  const { valid: insurancePaid, notes: ipNotes } = validateDetectedTotal(ipRaw, false, 'insurancePaid');
  result.insurancePaid = insurancePaid;
  result.notes.push(...ipNotes);
  
  // Parse lineItemsSum if present
  const lis = parseCurrencyValue(data.lineItemsSum);
  result.lineItemsSum = lis && lis > 0 ? lis : null;
  
  // Add any notes from AI
  if (Array.isArray(data.notes)) {
    result.notes.push(...data.notes.filter((n): n is string => typeof n === 'string'));
  }
  
  return result;
}

// ============= Derivation from Line Items =============

/**
 * Derive totalCharges from line items when not extracted.
 * 
 * Rules:
 * - Only derive if totalCharges is null/undefined
 * - Need at least 2 line items with billed amounts
 * - Confidence is 'medium' for 3+ items, 'low' for 2 items
 * - Never overwrite a high-confidence totalCharges
 */
export function deriveTotalsFromLineItems(
  lineItems: LineItemForTotals[],
  existingTotals: StructuredTotals
): StructuredTotals {
  const result = { ...existingTotals, notes: [...existingTotals.notes] };
  
  // Don't derive if we already have totalCharges with high confidence
  if (existingTotals.totalCharges?.confidence === 'high') {
    return result;
  }
  
  // Filter line items with valid billed amounts
  const itemsWithBilled = lineItems.filter(item => {
    const amt = item.billedAmount;
    return amt !== null && amt !== undefined && amt > 0;
  });
  
  // Need at least 2 items
  if (itemsWithBilled.length < 2) {
    if (itemsWithBilled.length === 1 && !existingTotals.totalCharges) {
      result.notes.push('Only 1 line item with billed amount - not enough to derive totals');
    }
    return result;
  }
  
  // Sum the billed amounts
  const sum = itemsWithBilled.reduce((acc, item) => acc + (item.billedAmount || 0), 0);
  
  // Only derive if we don't have totalCharges OR it's low confidence
  if (!existingTotals.totalCharges || existingTotals.totalCharges.confidence === 'low') {
    const confidence: TotalsConfidence = itemsWithBilled.length >= 3 ? 'medium' : 'low';
    
    result.totalCharges = {
      value: sum,
      confidence,
      evidence: `Derived by summing ${itemsWithBilled.length} line items`,
      label: 'Sum of line-item charges',
      source: 'derived_line_items'
    };
    
    result.notes.push(
      `Derived totalCharges ($${sum.toFixed(2)}) from ${itemsWithBilled.length} line items (confidence: ${confidence})`
    );
  }
  
  // Update lineItemsSum
  result.lineItemsSum = sum;
  
  return result;
}

// ============= Full Normalization Pipeline =============

/**
 * Full pipeline to normalize totals from AI response + line items.
 * 
 * 1. Parse and validate AI-extracted totals
 * 2. Derive from line items if needed
 * 3. Add guardrails (never $0 unless explicitly stated)
 */
export function normalizeAndDeriveTotals(
  aiExtractedTotals: unknown,
  lineItems: LineItemForTotals[]
): StructuredTotals {
  // Step 1: Normalize AI-extracted totals
  let totals = normalizeExtractedTotals(aiExtractedTotals);
  
  // Step 2: Derive from line items if needed
  totals = deriveTotalsFromLineItems(lineItems, totals);
  
  // Step 3: Final validation - ensure no invalid $0s
  const finalNotes: string[] = [...totals.notes];
  
  // Check if we have ANY valid total
  const hasAnyTotal = !!(
    totals.totalCharges ||
    totals.patientResponsibility ||
    totals.amountDue ||
    totals.insurancePaid
  );
  
  if (!hasAnyTotal && lineItems.length > 0) {
    finalNotes.push('Warning: No valid totals extracted or derived from document');
  }
  
  return {
    ...totals,
    notes: finalNotes
  };
}

// ============= Comparison Total Selection =============

export type ComparisonTotalType = 'totalCharges' | 'patientResponsibility' | 'amountDue' | 'matchedLineItemsOnly';

export interface ComparisonTotalSelection {
  type: ComparisonTotalType;
  value: number;
  label: string;
  confidence: TotalsConfidence;
  explanation: string;
  limitedComparability: boolean;
  scopeWarnings: string[];
}

/**
 * Select the best total for Medicare comparison.
 * 
 * Priority:
 * 1. totalCharges (pre-insurance, best for comparison)
 * 2. matchedLineItemsOnly (if no charges but have priced items)
 * 3. patientResponsibility / amountDue (limited comparability - these are POST insurance)
 */
export function selectComparisonTotal(
  totals: StructuredTotals,
  matchedBilledTotal?: number,
  matchedItemsCount?: number
): ComparisonTotalSelection | null {
  const scopeWarnings: string[] = [];
  
  // Priority 1: Total Charges (pre-insurance)
  if (totals.totalCharges && totals.totalCharges.value > 0) {
    return {
      type: 'totalCharges',
      value: totals.totalCharges.value,
      label: totals.totalCharges.label,
      confidence: totals.totalCharges.confidence,
      explanation: `Using "${totals.totalCharges.label}" (${totals.totalCharges.confidence} confidence) as the comparison basis.`,
      limitedComparability: false,
      scopeWarnings
    };
  }
  
  // Priority 2: Matched line items total
  if (matchedBilledTotal && matchedBilledTotal > 0 && matchedItemsCount && matchedItemsCount > 0) {
    return {
      type: 'matchedLineItemsOnly',
      value: matchedBilledTotal,
      label: `Matched Items (${matchedItemsCount} priced)`,
      confidence: matchedItemsCount >= 3 ? 'medium' : 'low',
      explanation: `Using sum of ${matchedItemsCount} line items that could be priced.`,
      limitedComparability: false,
      scopeWarnings: ['Comparison based on matched line items only, not total bill.']
    };
  }
  
  // Priority 3: Patient Responsibility / Amount Due (limited!)
  const patientTotal = totals.patientResponsibility || totals.amountDue;
  if (patientTotal && patientTotal.value > 0) {
    return {
      type: patientTotal === totals.patientResponsibility ? 'patientResponsibility' : 'amountDue',
      value: patientTotal.value,
      label: patientTotal.label,
      confidence: patientTotal.confidence,
      explanation: `Only a patient balance was detected ("${patientTotal.label}"). This represents what you owe after insurance, not total charges.`,
      limitedComparability: true,
      scopeWarnings: [
        'Patient balance detected instead of total charges.',
        'Medicare reference is based on full service pricing, not post-insurance balance.',
        'Cannot compute a meaningful multiple from this.'
      ]
    };
  }
  
  return null;
}
