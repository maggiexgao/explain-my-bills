/**
 * Totals Normalization and Derivation Module
 *
 * Handles:
 * 1. Parsing/cleaning currency values from AI output
 * 2. Validating totals (rejecting invalid 0s, negative values, etc.)
 * 3. Deriving totals from line items when not extracted
 * 4. Prefer AI "lineItemsSum" when present (it often captures charge-column sums better than per-line extraction)
 * 5. Never outputting $0 unless explicitly stated with high confidence
 */

// ============= Types =============

export type TotalsConfidence = "high" | "medium" | "low";
export type TotalsSource = "ai" | "derived_line_items" | "user_input" | "document_label";

export interface DetectedTotal {
  value: number;
  confidence: TotalsConfidence;
  evidence: string; // Exact text snippet found in document
  label: string; // Label found on document (e.g., "Total Charges", "Balance Due")
  source: TotalsSource;
}

export interface StructuredTotals {
  totalCharges?: DetectedTotal | null;
  totalPaymentsAndAdjustments?: DetectedTotal | null;
  patientResponsibility?: DetectedTotal | null;
  amountDue?: DetectedTotal | null;
  insurancePaid?: DetectedTotal | null;

  /**
   * Sum of billed amounts across extracted line items (best-effort).
   * This is NOT always the full bill, but can be.
   */
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

export function parseCurrencyValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  if (typeof value !== "string") return null;

  const str = String(value).trim();
  if (!str || str.toLowerCase() === "null" || str.toLowerCase() === "n/a") return null;

  let isNegative = false;
  let cleaned = str;

  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith("-")) {
    isNegative = true;
    cleaned = cleaned.slice(1);
  }

  cleaned = cleaned.replace(/[$£€¥,\s]/g, "");

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  return isNegative ? -num : num;
}

// ============= Validation =============

export function validateDetectedTotal(
  total: DetectedTotal | null | undefined,
  allowNegative: boolean = false,
  fieldName: string = "total",
): { valid: DetectedTotal | null; notes: string[] } {
  const notes: string[] = [];
  if (!total) return { valid: null, notes };

  const value = total.value;

  // Reject 0 unless explicitly stated with high confidence
  if (value === 0) {
    const evidenceHasZero = total.evidence?.match(/\$0\b|0\.00\b|\bzero\b/i);
    if (total.confidence !== "high" || !evidenceHasZero) {
      notes.push(`${fieldName}: Rejected $0 (not explicitly stated with high confidence)`);
      return { valid: null, notes };
    }
  }

  // Reject negative unless allowed
  if (value < 0 && !allowNegative) {
    notes.push(`${fieldName}: Rejected negative value $${value.toFixed(2)}`);
    return { valid: null, notes };
  }

  // Reject tiny values unless high confidence
  if (value > 0 && value < 1) {
    if (total.confidence !== "high") {
      notes.push(`${fieldName}: Rejected tiny value $${value.toFixed(2)} (confidence not high)`);
      return { valid: null, notes };
    }
  }

  return { valid: total, notes };
}

// ============= AI Response Normalization =============

export function normalizeExtractedTotals(raw: unknown): StructuredTotals {
  const result: StructuredTotals = { notes: [] };

  if (!raw || typeof raw !== "object") {
    result.notes.push("No extractedTotals in AI response");
    return result;
  }

  const data = raw as Record<string, unknown>;

  const parseTotal = (field: unknown, defaultLabel: string, source: TotalsSource = "ai"): DetectedTotal | null => {
    if (!field) return null;

    // New structured format: { value, confidence, evidence, label }
    if (typeof field === "object" && field !== null) {
      const obj = field as Record<string, unknown>;
      const value = parseCurrencyValue(obj.value);
      if (value === null) return null;

      return {
        value,
        confidence: (obj.confidence as TotalsConfidence) || "medium",
        evidence: String(obj.evidence || ""),
        label: String(obj.label || defaultLabel),
        source,
      };
    }

    // Old flat format
    if (typeof field === "number" || typeof field === "string") {
      const value = parseCurrencyValue(field);
      if (value === null) return null;

      return {
        value,
        confidence: "medium",
        evidence: `Extracted value: ${field}`,
        label: defaultLabel,
        source,
      };
    }

    return null;
  };

  // Parse AI-provided lineItemsSum first (very important fallback)
  const lis = parseCurrencyValue(data.lineItemsSum);
  result.lineItemsSum = lis && lis > 0 ? lis : null;

  // Totals
  const tcRaw = parseTotal(data.totalCharges, "Total Charges");
  const { valid: totalCharges, notes: tcNotes } = validateDetectedTotal(tcRaw, false, "totalCharges");
  result.totalCharges = totalCharges;
  result.notes.push(...tcNotes);

  const paRaw = parseTotal(data.totalPaymentsAndAdjustments, "Payments/Adjustments");
  const { valid: totalPaymentsAndAdjustments, notes: paNotes } = validateDetectedTotal(
    paRaw,
    true,
    "totalPaymentsAndAdjustments",
  );
  result.totalPaymentsAndAdjustments = totalPaymentsAndAdjustments;
  result.notes.push(...paNotes);

  const prRaw = parseTotal(data.patientResponsibility, "Patient Responsibility");
  const { valid: patientResponsibility, notes: prNotes } = validateDetectedTotal(prRaw, false, "patientResponsibility");
  result.patientResponsibility = patientResponsibility;
  result.notes.push(...prNotes);

  const adRaw = parseTotal(data.amountDue, "Amount Due");
  const { valid: amountDue, notes: adNotes } = validateDetectedTotal(adRaw, false, "amountDue");
  result.amountDue = amountDue;
  result.notes.push(...adNotes);

  const ipRaw = parseTotal(data.insurancePaid, "Insurance Paid");
  const { valid: insurancePaid, notes: ipNotes } = validateDetectedTotal(ipRaw, false, "insurancePaid");
  result.insurancePaid = insurancePaid;
  result.notes.push(...ipNotes);

  // Include any notes from AI
  if (Array.isArray(data.notes)) {
    result.notes.push(...data.notes.filter((n): n is string => typeof n === "string"));
  }

  /**
   * CRITICAL FALLBACK:
   * If the AI computed lineItemsSum and we do NOT have a reliable labeled totalCharges,
   * use lineItemsSum as derived totalCharges.
   *
   * This prevents the system from mistakenly using "Amount Due" (e.g., $118) as "Total Charges".
   */
  if (result.lineItemsSum && result.lineItemsSum > 0) {
    const shouldPromoteLineItemsSum = !result.totalCharges || result.totalCharges.confidence === "low";

    if (shouldPromoteLineItemsSum) {
      result.totalCharges = {
        value: result.lineItemsSum,
        confidence: "medium",
        evidence: "Derived from extractedTotals.lineItemsSum (sum of charge-column line items)",
        label: "Sum of line-item charges",
        source: "derived_line_items",
      };
      result.notes.push(`Promoted lineItemsSum ($${result.lineItemsSum.toFixed(2)}) to totalCharges fallback.`);
    }
  }

  return result;
}

// ============= Derivation from Line Items =============

export function deriveTotalsFromLineItems(
  lineItems: LineItemForTotals[],
  existingTotals: StructuredTotals,
): StructuredTotals {
  const result: StructuredTotals = { ...existingTotals, notes: [...existingTotals.notes] };

  // Don't overwrite a high-confidence labeled totalCharges
  if (existingTotals.totalCharges?.confidence === "high") return result;

  const itemsWithBilled = lineItems.filter((item) => {
    const amt = item.billedAmount;
    return amt !== null && amt !== undefined && amt > 0;
  });

  // Need at least 2 items to derive
  if (itemsWithBilled.length < 2) {
    if (itemsWithBilled.length === 1 && !existingTotals.totalCharges) {
      result.notes.push("Only 1 line item with billed amount - not enough to derive totals");
    }
    return result;
  }

  const sum = itemsWithBilled.reduce((acc, item) => acc + (item.billedAmount || 0), 0);

  // Update lineItemsSum
  result.lineItemsSum = sum;

  // Only derive if we don't have totalCharges OR it's low confidence
  if (!existingTotals.totalCharges || existingTotals.totalCharges.confidence === "low") {
    const confidence: TotalsConfidence = itemsWithBilled.length >= 3 ? "medium" : "low";

    result.totalCharges = {
      value: sum,
      confidence,
      evidence: `Derived by summing ${itemsWithBilled.length} extracted line items`,
      label: "Sum of line-item charges",
      source: "derived_line_items",
    };

    result.notes.push(
      `Derived totalCharges ($${sum.toFixed(2)}) from ${itemsWithBilled.length} extracted line items (confidence: ${confidence}).`,
    );
  }

  return result;
}

// ============= Full Normalization Pipeline =============

export function normalizeAndDeriveTotals(aiExtractedTotals: unknown, lineItems: LineItemForTotals[]): StructuredTotals {
  // Step 1: Normalize AI-extracted totals
  let totals = normalizeExtractedTotals(aiExtractedTotals);

  // Step 2: Derive from extracted line items if needed
  totals = deriveTotalsFromLineItems(lineItems, totals);

  // Step 3: Final sanity notes
  const finalNotes: string[] = [...totals.notes];

  const hasAnyTotal = !!(
    totals.totalCharges ||
    totals.patientResponsibility ||
    totals.amountDue ||
    totals.insurancePaid
  );

  if (!hasAnyTotal && lineItems.length > 0) {
    finalNotes.push("Warning: No valid totals extracted or derived from document");
  }

  return { ...totals, notes: finalNotes };
}

// ============= Comparison Total Selection =============

export type ComparisonTotalType = "totalCharges" | "patientResponsibility" | "amountDue" | "matchedLineItemsOnly";

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
 * Select the best total for pricing benchmark comparison.
 *
 * Priority:
 * 1. totalCharges (pre-insurance, best for comparison)
 * 2. matchedLineItemsOnly (if no total charges but we have priced items)
 * 3. patientResponsibility / amountDue (limited comparability - post insurance)
 */
export function selectComparisonTotal(
  totals: StructuredTotals,
  matchedBilledTotal?: number,
  matchedItemsCount?: number,
): ComparisonTotalSelection | null {
  // Priority 1: Total Charges
  if (totals.totalCharges && totals.totalCharges.value > 0) {
    return {
      type: "totalCharges",
      value: totals.totalCharges.value,
      label: totals.totalCharges.label,
      confidence: totals.totalCharges.confidence,
      explanation: `Using "${totals.totalCharges.label}" as the sticker price (the provider’s total charges before insurance).`,
      limitedComparability: false,
      scopeWarnings: [],
    };
  }

  // Priority 2: Matched/ priced line items only
  if (matchedBilledTotal && matchedBilledTotal > 0 && matchedItemsCount && matchedItemsCount > 0) {
    const confidence: TotalsConfidence = matchedItemsCount >= 3 ? "medium" : "low";
    return {
      type: "matchedLineItemsOnly",
      value: matchedBilledTotal,
      label: `Priced line items only (${matchedItemsCount})`,
      confidence,
      explanation: `Using the sum of ${matchedItemsCount} line items that could be priced (not necessarily the full bill).`,
      limitedComparability: false,
      scopeWarnings: ["Comparison is based only on the line items we could price, not the full bill."],
    };
  }

  // Priority 3: Patient balance (limited)
  const patientTotal = totals.patientResponsibility || totals.amountDue;
  if (patientTotal && patientTotal.value > 0) {
    return {
      type: patientTotal === totals.patientResponsibility ? "patientResponsibility" : "amountDue",
      value: patientTotal.value,
      label: patientTotal.label,
      confidence: patientTotal.confidence,
      explanation: `Only an amount-you-may-owe number was detected ("${patientTotal.label}"). This is what you may owe after insurance, not the total charges.`,
      limitedComparability: true,
      scopeWarnings: [
        "Only a balance due / amount owed was detected.",
        "This is not the full price of services, so pricing comparisons may be misleading.",
      ],
    };
  }

  return null;
}
