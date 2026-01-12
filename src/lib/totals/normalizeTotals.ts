/**
 * Totals Normalization and Derivation Module
 *
 * Handles:
 * 1. Parsing/cleaning currency values from AI output
 * 2. Validating totals (rejecting invalid 0s, negative values, etc.)
 * 3. Deriving totals from line items when not extracted
 * 4. Guardrails: never output $0 unless explicitly stated with high confidence
 * 5. Guardrails: never let "Amount Due / Balance Due" be treated as totalCharges
 * 6. Units-aware line-item summation
 */

export type TotalsConfidence = "high" | "medium" | "low";
export type TotalsSource = "ai" | "derived_line_items" | "user_input" | "document_label" | "normalized_guardrail";

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

  // Parentheses negative: (123.45)
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

// ============= Label Guardrails =============

const CHARGES_LABEL_HINTS = [
  "total charges",
  "total billed",
  "gross charges",
  "charges",
  "amount billed",
  "total amount billed",
  "statement total",
  "hospital charges",
];

const AMOUNT_DUE_LABEL_HINTS = [
  "amount due",
  "balance due",
  "current balance",
  "you owe",
  "payment due",
  "pay this amount",
  "your balance",
];

const INSURANCE_PAID_LABEL_HINTS = [
  "insurance paid",
  "plan paid",
  "paid by insurance",
  "paid by plan",
  "insurance payment",
  "plan payment",
];

function normalizeLabel(s: unknown): string {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function labelLooksLikeCharges(label: string): boolean {
  const l = normalizeLabel(label);
  return CHARGES_LABEL_HINTS.some((h) => l.includes(h));
}

function labelLooksLikeAmountDue(label: string): boolean {
  const l = normalizeLabel(label);
  return AMOUNT_DUE_LABEL_HINTS.some((h) => l.includes(h));
}

function labelLooksLikeInsurancePaid(label: string): boolean {
  const l = normalizeLabel(label);
  return INSURANCE_PAID_LABEL_HINTS.some((h) => l.includes(h));
}

// ============= Validation =============

export function validateDetectedTotal(
  total: DetectedTotal | null | undefined,
  opts?: {
    allowNegative?: boolean;
    fieldName?: string;
    // If true, enforce that this field’s label MUST resemble charges labels.
    requireChargesLikeLabel?: boolean;
    // If true, explicitly reject "amount due" style labels for this field.
    rejectAmountDueLikeLabel?: boolean;
  },
): { valid: DetectedTotal | null; notes: string[] } {
  const notes: string[] = [];
  const fieldName = opts?.fieldName || "total";
  const allowNegative = !!opts?.allowNegative;

  if (!total) return { valid: null, notes };

  const value = total.value;
  const label = normalizeLabel(total.label);
  const evidence = String(total.evidence || "");

  // Guardrail: block wrong-label totals (critical for totalCharges)
  if (opts?.requireChargesLikeLabel && total.label) {
    if (!labelLooksLikeCharges(label)) {
      notes.push(
        `${fieldName}: Rejected because label "${total.label}" does not look like a charges/total-billed label`,
      );
      return { valid: null, notes };
    }
  }

  if (opts?.rejectAmountDueLikeLabel && total.label) {
    if (labelLooksLikeAmountDue(label)) {
      notes.push(`${fieldName}: Rejected because label "${total.label}" looks like an amount due/balance label`);
      return { valid: null, notes };
    }
  }

  // Reject 0 unless explicitly stated with high confidence
  if (value === 0) {
    const evidenceHasZero = /\$0\b|0\.00\b|\bzero\b/i.test(evidence);
    if (total.confidence !== "high" || !evidenceHasZero) {
      notes.push(`${fieldName}: Rejected $0 (not explicitly stated with high confidence)`);
      return { valid: null, notes };
    }
  }

  // Reject negative values unless allowed
  if (value < 0 && !allowNegative) {
    notes.push(`${fieldName}: Rejected negative value $${value.toFixed(2)}`);
    return { valid: null, notes };
  }

  // Reject suspiciously tiny values unless high confidence
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

      const label = String(obj.label || defaultLabel);
      const evidence = String(obj.evidence || "");

      return {
        value,
        confidence: (obj.confidence as TotalsConfidence) || "medium",
        evidence,
        label,
        source,
      };
    }

    // Old flat format: number/string
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

  // ---- totalCharges (STRICT) ----
  const tcRaw = parseTotal(data.totalCharges, "Total Charges");

  // Guardrail: totalCharges cannot be "Amount Due"/"Balance Due"
  // If the AI accidentally put a balance under totalCharges, we reject it.
  const { valid: totalCharges, notes: tcNotes } = validateDetectedTotal(tcRaw, {
    allowNegative: false,
    fieldName: "totalCharges",
    requireChargesLikeLabel: true, // MUST look like charges label
    rejectAmountDueLikeLabel: true, // and MUST NOT look like amount due label
  });
  result.totalCharges = totalCharges;
  result.notes.push(...tcNotes);

  // ---- payments/adjustments (allow negative) ----
  const paRaw = parseTotal(data.totalPaymentsAndAdjustments, "Payments/Adjustments");
  const { valid: totalPaymentsAndAdjustments, notes: paNotes } = validateDetectedTotal(paRaw, {
    allowNegative: true,
    fieldName: "totalPaymentsAndAdjustments",
  });
  result.totalPaymentsAndAdjustments = totalPaymentsAndAdjustments;
  result.notes.push(...paNotes);

  // ---- patient responsibility ----
  const prRaw = parseTotal(data.patientResponsibility, "Patient Responsibility");
  const { valid: patientResponsibility, notes: prNotes } = validateDetectedTotal(prRaw, {
    allowNegative: false,
    fieldName: "patientResponsibility",
  });
  result.patientResponsibility = patientResponsibility;
  result.notes.push(...prNotes);

  // ---- amount due ----
  const adRaw = parseTotal(data.amountDue, "Amount Due");
  const { valid: amountDue, notes: adNotes } = validateDetectedTotal(adRaw, {
    allowNegative: false,
    fieldName: "amountDue",
  });
  result.amountDue = amountDue;
  result.notes.push(...adNotes);

  // ---- insurance paid (NOT allowed) ----
  const ipRaw = parseTotal(data.insurancePaid, "Insurance Paid");
  // Still validate, but do not allow negative (payments shown as positive on most docs)
  const { valid: insurancePaid, notes: ipNotes } = validateDetectedTotal(ipRaw, {
    allowNegative: false,
    fieldName: "insurancePaid",
  });
  result.insurancePaid = insurancePaid;
  result.notes.push(...ipNotes);

  // ---- lineItemsSum ----
  const lis = parseCurrencyValue(data.lineItemsSum);
  result.lineItemsSum = lis && lis > 0 ? lis : null;

  // AI notes
  if (Array.isArray(data.notes)) {
    result.notes.push(...data.notes.filter((n): n is string => typeof n === "string"));
  }

  // Additional sanity notes
  if (result.totalCharges && labelLooksLikeAmountDue(result.totalCharges.label)) {
    // Should be impossible due to guardrail, but keep defensive note
    result.notes.push(`Guardrail: totalCharges label resembled amount due. totalCharges may be unreliable.`);
  }
  if (result.insurancePaid && labelLooksLikeCharges(result.insurancePaid.label)) {
    result.notes.push(`Note: insurancePaid label resembled charges. Verify extraction.`);
  }

  return result;
}

// ============= Line Item Summation (UNITS-AWARE) =============

function safeUnits(u: unknown): number {
  if (typeof u !== "number") return 1;
  if (!isFinite(u) || u <= 0) return 1;
  return u;
}

export function computeLineItemsSum(lineItems: LineItemForTotals[]): {
  sum: number | null;
  counted: number;
  notes: string[];
} {
  const notes: string[] = [];

  const itemsWithBilled = lineItems.filter((item) => {
    const amt = item.billedAmount;
    return amt !== null && amt !== undefined && typeof amt === "number" && isFinite(amt) && amt > 0;
  });

  if (itemsWithBilled.length < 1) {
    return { sum: null, counted: 0, notes };
  }

  const sum = itemsWithBilled.reduce((acc, item) => {
    const units = safeUnits(item.units);
    return acc + (item.billedAmount || 0) * units;
  }, 0);

  const anyUnitsNotOne = itemsWithBilled.some((i) => safeUnits(i.units) !== 1);
  if (anyUnitsNotOne) {
    notes.push(`Line-items sum is units-aware (amount × units).`);
  }

  return { sum, counted: itemsWithBilled.length, notes };
}

// ============= Derivation from Line Items =============

export function deriveTotalsFromLineItems(
  lineItems: LineItemForTotals[],
  existingTotals: StructuredTotals,
): StructuredTotals {
  const result: StructuredTotals = {
    ...existingTotals,
    notes: [...(existingTotals.notes || [])],
  };

  // If we have high-confidence totalCharges from the doc, don't override
  if (existingTotals.totalCharges?.confidence === "high") {
    // Still compute lineItemsSum for debugging + mismatch notes later
    const computed = computeLineItemsSum(lineItems);
    if (computed.sum !== null) {
      result.lineItemsSum = computed.sum;
      result.notes.push(...computed.notes);
    }
    return result;
  }

  const computed = computeLineItemsSum(lineItems);
  if (computed.sum === null) {
    if (!existingTotals.totalCharges && lineItems.length > 0) {
      result.notes.push("No usable billed amounts found in line items to compute a sum.");
    }
    return result;
  }

  result.lineItemsSum = computed.sum;
  result.notes.push(...computed.notes);

  // Need at least 2 line items to derive a totalCharges candidate
  if (computed.counted < 2) {
    if (!existingTotals.totalCharges) {
      result.notes.push("Only 1 line item with a billed amount — not enough to derive total charges.");
    }
    return result;
  }

  // Only derive if missing or low confidence
  if (!existingTotals.totalCharges || existingTotals.totalCharges.confidence === "low") {
    const confidence: TotalsConfidence = computed.counted >= 3 ? "medium" : "low";

    result.totalCharges = {
      value: computed.sum,
      confidence,
      evidence: `Derived by summing ${computed.counted} line items (units-aware)`,
      label: "Sum of line-item charges",
      source: "derived_line_items",
    };

    result.notes.push(
      `Derived totalCharges ($${computed.sum.toFixed(2)}) from ${computed.counted} line items (confidence: ${confidence}).`,
    );
  }

  return result;
}

// ============= Cross-check Notes (Totals vs Line Items) =============

function pctDiff(a: number, b: number): number {
  if (a === 0 || b === 0) return 1;
  return Math.abs(a - b) / Math.max(a, b);
}

function addMismatchNotes(totals: StructuredTotals): StructuredTotals {
  const result: StructuredTotals = { ...totals, notes: [...(totals.notes || [])] };

  const lineSum = totals.lineItemsSum ?? null;
  const tc = totals.totalCharges?.value ?? null;

  if (lineSum && tc) {
    const diff = pctDiff(lineSum, tc);
    if (diff <= 0.03) {
      result.notes.push(`Line-item sum matches Total Charges within ~3%.`);
    } else {
      result.notes.push(
        `Line-item sum ($${lineSum.toFixed(2)}) does not match Total Charges ($${tc.toFixed(
          2,
        )}). Difference ~${(diff * 100).toFixed(1)}%.`,
      );
      result.notes.push(
        `Possible reasons: missing lines in the image, page cut off, separate professional/facility bills, or the bill shows partial charges.`,
      );

      // If AI said high but mismatch is large, downgrade in notes (we won’t mutate confidence silently)
      if (totals.totalCharges?.confidence === "high" && diff > 0.08) {
        result.notes.push(
          `Note: Total Charges was marked high confidence, but mismatch is large. Consider treating it as less reliable.`,
        );
      }
    }
  }

  return result;
}

// ============= Full Normalization Pipeline =============

export function normalizeAndDeriveTotals(aiExtractedTotals: unknown, lineItems: LineItemForTotals[]): StructuredTotals {
  let totals = normalizeExtractedTotals(aiExtractedTotals);

  // Always compute/refresh lineItemsSum from the actual line items we have
  totals = deriveTotalsFromLineItems(lineItems, totals);

  // Cross-check and add mismatch notes (if both exist)
  totals = addMismatchNotes(totals);

  const finalNotes: string[] = [...(totals.notes || [])];

  const hasAnyTotal = !!(
    totals.totalCharges ||
    totals.patientResponsibility ||
    totals.amountDue ||
    totals.insurancePaid
  );

  if (!hasAnyTotal && lineItems.length > 0) {
    finalNotes.push("Warning: No valid totals extracted or derived from document.");
  }

  return { ...totals, notes: finalNotes };
}

// ============= Comparison Total Selection =============

export type ComparisonTotalType = "totalCharges" | "matchedLineItemsOnly" | "patientResponsibility" | "amountDue";

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
 * Select the best total for benchmark comparison.
 *
 * Priority:
 * 1) totalCharges (best: full pre-insurance charges)
 * 2) matchedLineItemsOnly (if we can price only some items)
 * 3) patientResponsibility / amountDue (limited: post-insurance / may include older balance)
 *
 * IMPORTANT:
 * - insurancePaid is NEVER used as a comparison total.
 */
export function selectComparisonTotal(
  totals: StructuredTotals,
  matchedBilledTotal?: number,
  matchedItemsCount?: number,
): ComparisonTotalSelection | null {
  const scopeWarnings: string[] = [];

  // 1) Total Charges
  if (totals.totalCharges && totals.totalCharges.value > 0) {
    // Add warning if it differs from lineItemsSum significantly
    if (totals.lineItemsSum && pctDiff(totals.lineItemsSum, totals.totalCharges.value) > 0.08) {
      scopeWarnings.push(
        "The line-item sum does not closely match the document’s Total Charges. Some lines may be missing or the bill may be incomplete.",
      );
    }

    return {
      type: "totalCharges",
      value: totals.totalCharges.value,
      label: totals.totalCharges.label,
      confidence: totals.totalCharges.confidence,
      explanation: `Using "${totals.totalCharges.label}" as the total to compare.`,
      limitedComparability: false,
      scopeWarnings,
    };
  }

  // 2) Matched line items only
  if (matchedBilledTotal && matchedBilledTotal > 0 && matchedItemsCount && matchedItemsCount > 0) {
    return {
      type: "matchedLineItemsOnly",
      value: matchedBilledTotal,
      label: `Matched line items (${matchedItemsCount} priced)`,
      confidence: matchedItemsCount >= 3 ? "medium" : "low",
      explanation: `Using the sum of the line items we could price (${matchedItemsCount} items).`,
      limitedComparability: false,
      scopeWarnings: ["This total includes only the items we could match and price, not the full bill total."],
    };
  }

  // 3) Patient totals (limited)
  const patientTotal = totals.patientResponsibility || totals.amountDue;
  if (patientTotal && patientTotal.value > 0) {
    const label =
      patientTotal.label || (patientTotal === totals.patientResponsibility ? "Patient Responsibility" : "Amount Due");

    return {
      type: patientTotal === totals.patientResponsibility ? "patientResponsibility" : "amountDue",
      value: patientTotal.value,
      label,
      confidence: patientTotal.confidence,
      explanation: `Only a balance/amount-you-owe number was found ("${label}"). This is what you may owe after insurance, not the full charges.`,
      limitedComparability: true,
      scopeWarnings: [
        "A balance/amount-due number was found instead of total charges.",
        "Balances can include insurance adjustments, partial billing, or older amounts.",
        "A benchmark comparison may be less direct for this type of total.",
      ],
    };
  }

  return null;
}
