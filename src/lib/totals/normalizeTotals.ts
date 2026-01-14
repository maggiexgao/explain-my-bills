/**
 * Totals Normalization and Derivation Module
 *
 * Handles:
 * 1. Parsing/cleaning currency values from AI output
 * 2. Validating totals (reject invalid 0s, negative values, etc.)
 * 3. Deriving totals from line items when not extracted
 * 4. Never outputting $0 unless explicitly stated with high confidence
 */

// ============= Types =============

export type TotalsConfidence = "high" | "medium" | "low";
export type TotalsSource = "ai" | "derived_line_items" | "user_input" | "document_label";

export interface DetectedTotal {
  value: number;
  confidence: TotalsConfidence;
  evidence: string;
  label: string;
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

function evidenceExplicitlyShowsZero(evidence: string | undefined): boolean {
  if (!evidence) return false;
  return /\$0(\.00)?\b|0\.00\b|\bzero\b/i.test(evidence);
}

export function validateDetectedTotal(
  total: DetectedTotal | null | undefined,
  allowNegative: boolean = false,
  fieldName: string = "total",
): { valid: DetectedTotal | null; notes: string[] } {
  const notes: string[] = [];
  if (!total) return { valid: null, notes };

  const value = total.value;

  if (value === 0) {
    if (total.confidence !== "high" || !evidenceExplicitlyShowsZero(total.evidence)) {
      notes.push(`${fieldName}: Rejected $0 (not explicitly stated with high confidence)`);
      return { valid: null, notes };
    }
  }

  if (value < 0 && !allowNegative) {
    notes.push(`${fieldName}: Rejected negative value $${value.toFixed(2)}`);
    return { valid: null, notes };
  }

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

  const tcRaw = parseTotal(data.totalCharges, "Total Charges");
  const tcValidated = validateDetectedTotal(tcRaw, false, "totalCharges");
  result.totalCharges = tcValidated.valid;
  result.notes.push(...tcValidated.notes);

  const paRaw = parseTotal(data.totalPaymentsAndAdjustments, "Payments/Adjustments");
  const paValidated = validateDetectedTotal(paRaw, true, "payments");
  result.totalPaymentsAndAdjustments = paValidated.valid;
  result.notes.push(...paValidated.notes);

  const prRaw = parseTotal(data.patientResponsibility, "Patient Responsibility");
  const prValidated = validateDetectedTotal(prRaw, false, "patientResponsibility");
  result.patientResponsibility = prValidated.valid;
  result.notes.push(...prValidated.notes);

  const adRaw = parseTotal(data.amountDue, "Amount Due");
  const adValidated = validateDetectedTotal(adRaw, false, "amountDue");
  result.amountDue = adValidated.valid;
  result.notes.push(...adValidated.notes);

  const ipRaw = parseTotal(data.insurancePaid, "Insurance Paid");
  const ipValidated = validateDetectedTotal(ipRaw, false, "insurancePaid");
  result.insurancePaid = ipValidated.valid;
  result.notes.push(...ipValidated.notes);

  const lis = parseCurrencyValue(data.lineItemsSum);
  result.lineItemsSum = lis && lis > 0 ? lis : null;

  if (Array.isArray(data.notes)) {
    result.notes.push(...data.notes.filter((n): n is string => typeof n === "string"));
  }

  return result;
}

// ============= Derivation from Line Items =============

export function deriveTotalsFromLineItems(
  lineItems: LineItemForTotals[],
  existingTotals: StructuredTotals,
): StructuredTotals {
  const result = { ...existingTotals, notes: [...existingTotals.notes] };

  if (existingTotals.totalCharges?.confidence === "high") return result;

  const itemsWithBilled = lineItems.filter((item) => {
    const amt = item.billedAmount;
    return amt !== null && amt !== undefined && amt > 0;
  });

  if (itemsWithBilled.length < 2) {
    if (itemsWithBilled.length === 1 && !existingTotals.totalCharges) {
      result.notes.push("Only 1 line item with billed amount - not enough to derive totals");
    }
    return result;
  }

  const sum = itemsWithBilled.reduce((acc, item) => acc + (item.billedAmount || 0), 0);

  if (!existingTotals.totalCharges || existingTotals.totalCharges.confidence === "low") {
    const confidence: TotalsConfidence = itemsWithBilled.length >= 3 ? "medium" : "low";

    result.totalCharges = {
      value: sum,
      confidence,
      evidence: `Derived by summing ${itemsWithBilled.length} line items`,
      label: "Sum of line-item charges",
      source: "derived_line_items",
    };

    result.notes.push(
      `Derived totalCharges ($${sum.toFixed(2)}) from ${itemsWithBilled.length} line items (confidence: ${confidence})`,
    );
  }

  result.lineItemsSum = sum;
  return result;
}

// ============= Full Normalization Pipeline =============

export function normalizeAndDeriveTotals(aiExtractedTotals: unknown, lineItems: LineItemForTotals[]): StructuredTotals {
  let totals = normalizeExtractedTotals(aiExtractedTotals);
  totals = deriveTotalsFromLineItems(lineItems, totals);

  // Extra guard: if totalCharges exists but is wildly smaller than lineItemsSum, it's likely wrong.
  if (
    totals.totalCharges &&
    totals.lineItemsSum &&
    totals.lineItemsSum > 0 &&
    totals.totalCharges.value > 0 &&
    totals.totalCharges.value < totals.lineItemsSum * 0.5
  ) {
    totals.notes.push(
      `totalCharges looked too small vs lineItemsSum (charges=${totals.totalCharges.value}, sum=${totals.lineItemsSum}). Ignoring totalCharges.`,
    );
    totals.totalCharges = null;
  }

  const hasAnyTotal = !!(
    totals.totalCharges ||
    totals.patientResponsibility ||
    totals.amountDue ||
    totals.insurancePaid
  );
  if (!hasAnyTotal && lineItems.length > 0) {
    totals.notes.push("Warning: No valid totals extracted or derived from document");
  }

  return totals;
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

export function selectComparisonTotal(
  totals: StructuredTotals,
  matchedBilledTotal?: number,
  matchedItemsCount?: number,
): ComparisonTotalSelection | null {
  const scopeWarnings: string[] = [];

  if (totals.totalCharges && totals.totalCharges.value > 0) {
    return {
      type: "totalCharges",
      value: totals.totalCharges.value,
      label: totals.totalCharges.label,
      confidence: totals.totalCharges.confidence,
      explanation: `Using "${totals.totalCharges.label}" (${totals.totalCharges.confidence} confidence) as the comparison basis.`,
      limitedComparability: false,
      scopeWarnings,
    };
  }

  if (matchedBilledTotal && matchedBilledTotal > 0 && matchedItemsCount && matchedItemsCount > 0) {
    return {
      type: "matchedLineItemsOnly",
      value: matchedBilledTotal,
      label: `Matched Items (${matchedItemsCount} priced)`,
      confidence: matchedItemsCount >= 3 ? "medium" : "low",
      explanation: `Using sum of ${matchedItemsCount} line items that could be priced.`,
      limitedComparability: false,
      scopeWarnings: ["Comparison based on matched line items only, not total bill."],
    };
  }

  const patientTotal = totals.patientResponsibility || totals.amountDue;
  if (patientTotal && patientTotal.value > 0) {
    return {
      type: patientTotal === totals.patientResponsibility ? "patientResponsibility" : "amountDue",
      value: patientTotal.value,
      label: patientTotal.label,
      confidence: patientTotal.confidence,
      explanation: `Only a patient balance was detected ("${patientTotal.label}"). This represents what you owe after insurance, not total charges.`,
      limitedComparability: true,
      scopeWarnings: [
        "Patient balance detected instead of total charges.",
        "Medicare reference is based on full service pricing, not post-insurance balance.",
      ],
    };
  }

  return null;
}
