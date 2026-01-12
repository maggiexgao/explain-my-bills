/**
 * Totals Extraction and Reconciliation
 *
 * This module handles:
 * 1. Document type classification
 * 2. Totals candidate extraction with label anchoring
 * 3. Line item extraction and sum calculation (UNITS-AWARE)
 * 4. Reconciliation and comparison total selection
 * 5. Integration with normalizeTotals for structured totals
 *
 * The goal is to reliably extract what the user actually owes and provide
 * transparent reasoning for the comparison total used.
 */

import {
  StructuredTotals,
  DetectedTotal,
  LineItemForTotals,
  normalizeAndDeriveTotals,
  selectComparisonTotal as selectStructuredComparisonTotal,
  ComparisonTotalSelection,
  TotalsConfidence,
} from "./totals/normalizeTotals";

// Re-export types for consumers
export type { StructuredTotals, DetectedTotal, LineItemForTotals, ComparisonTotalSelection, TotalsConfidence };

// ============= Type Definitions =============

export type DocumentClassification =
  | "itemized_statement"
  | "summary_statement"
  | "hospital_summary_bill"
  | "revenue_code_only"
  | "eob"
  | "portal_summary"
  | "payment_receipt"
  | "unknown";

export type TotalType = "charges" | "allowed" | "patient_responsibility" | "insurance_paid" | "unknown";

export interface TotalCandidate {
  type: TotalType;
  amount: number;
  label: string;
  confidence: "high" | "medium" | "low";
  evidence: string;
  nearbyContext?: string;
}

export interface LineItemExtraction {
  description: string;
  chargeAmount?: number;
  chargeAmountConfidence?: TotalsConfidence;
  chargeAmountEvidence?: string;
  allowedAmount?: number;
  patientAmount?: number;
  code?: string;
  codeType?: "cpt" | "hcpcs" | "revenue" | "unknown";
  units?: number;
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

  // Insurance paid is NOT allowed; keep separate
  insurancePaidCandidates: TotalCandidate[];

  // Structured totals from normalization module
  structuredTotals?: StructuredTotals;

  // Chosen comparison total
  comparisonTotal: {
    value: number;
    type: TotalType;
    confidence: "high" | "medium" | "low";
    explanation: string;
    limitedComparability: boolean;
    scopeWarnings?: string[];
  } | null;

  // Document classification
  documentType: DocumentClassification;

  // Reconciliation status
  reconciliationStatus: "matched" | "mismatch" | "insufficient_data";
  reconciliationNote?: string;

  // Derivation notes
  derivationNotes?: string[];
}

// ============= Label Patterns =============

const CHARGES_LABELS = [
  "total charges",
  "total billed",
  "charges",
  "total amount",
  "amount billed",
  "billed amount",
  "gross charges",
  "total due",
  "statement total",
  "hospital charges",
];

const ALLOWED_LABELS = [
  "allowed",
  "allowed amount",
  "negotiated",
  "contracted",
  "plan discounted",
  "insurance allowed",
  "your plan rate",
  "contracted rate",
  "plan rate",
];

const PATIENT_LABELS = [
  "amount due",
  "balance",
  "your balance",
  "patient responsibility",
  "you owe",
  "amount you owe",
  "your responsibility",
  "pay this amount",
  "total patient",
  "patient due",
  "payment due",
  "balance due",
  "current balance",
];

const INSURANCE_LABELS = [
  "insurance paid",
  "plan paid",
  "insurance payment",
  "payments",
  "amount paid",
  "paid by insurance",
  "paid by plan",
];

// Document type indicators
const EOB_INDICATORS = [
  "explanation of benefits",
  "eob",
  "allowed amount",
  "plan paid",
  "member responsibility",
  "claim number",
  "processed date",
  "coinsurance",
  "copay",
  "deductible applied",
];

const PORTAL_INDICATORS = [
  "mychart",
  "patient portal",
  "online balance",
  "your balance",
  "quick pay",
  "make a payment",
  "payment options",
];

const STATEMENT_INDICATORS = [
  "statement",
  "itemized bill",
  "service date",
  "procedure",
  "charges",
  "billing statement",
  "date of service",
  "quantity",
  "cpt",
];

const HOSPITAL_SUMMARY_INDICATORS = [
  "hospital",
  "facility",
  "emergency room",
  "er visit",
  "inpatient",
  "outpatient",
  "revenue code",
  "room and board",
  "pharmacy",
  "laboratory",
];

const REVENUE_CODE_INDICATORS = [
  "rev code",
  "revenue code",
  "0100",
  "0110",
  "0120",
  "0250",
  "0260",
  "0270",
  "0300",
  "0320",
  "0450",
  "0636",
  "0730",
  "0760",
];

// ============= Helper Functions =============

/**
 * Clean and parse a currency string to number
 */
export function parseCurrency(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;

  const cleaned = String(value)
    .replace(/[$,\s]/g, "")
    .replace(/[()]/g, (match) => (match === "(" ? "-" : ""))
    .trim();

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Classify document type based on content indicators
 */
export function classifyDocument(content: string): DocumentClassification {
  const lower = content.toLowerCase();

  // Score each type
  const eobScore = EOB_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);
  const portalScore = PORTAL_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);
  const statementScore = STATEMENT_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);
  const hospitalScore = HOSPITAL_SUMMARY_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);
  const revenueCodeScore = REVENUE_CODE_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 3 : 0), 0);

  const isReceipt =
    lower.includes("receipt") ||
    lower.includes("payment received") ||
    (lower.includes("paid") && lower.includes("thank you"));

  if (isReceipt && !lower.includes("charges")) return "payment_receipt";

  if (eobScore >= 6 && eobScore > statementScore) return "eob";

  const hasCpt = /\b\d{5}\b/.test(content) || /\b[A-Z]\d{4}\b/.test(content);

  if (revenueCodeScore >= 6 && !hasCpt) return "revenue_code_only";

  if (hospitalScore >= 6 && revenueCodeScore >= 3) return "hospital_summary_bill";

  if (portalScore >= 4 && !lower.includes("itemized")) return "portal_summary";

  if (statementScore >= 4) return hasCpt ? "itemized_statement" : "summary_statement";

  return "unknown";
}

/**
 * Extract total candidates from analysis data with enhanced detection.
 * IMPORTANT: insurancePaid is NOT an allowed amount, so we keep it separate.
 */
export function extractTotalCandidates(
  analysisData: any,
  documentContent?: string,
): {
  chargesCandidates: TotalCandidate[];
  allowedCandidates: TotalCandidate[];
  patientCandidates: TotalCandidate[];
  insurancePaidCandidates: TotalCandidate[];
} {
  const chargesCandidates: TotalCandidate[] = [];
  const allowedCandidates: TotalCandidate[] = [];
  const patientCandidates: TotalCandidate[] = [];
  const insurancePaidCandidates: TotalCandidate[] = [];

  // From atAGlance
  if (analysisData.atAGlance) {
    if (analysisData.atAGlance.totalBilled && analysisData.atAGlance.totalBilled > 0) {
      chargesCandidates.push({
        type: "charges",
        amount: analysisData.atAGlance.totalBilled,
        label: "Total Billed (at a glance)",
        confidence: "high",
        evidence: "Extracted from document summary",
      });
    }

    if (analysisData.atAGlance.amountYouMayOwe && analysisData.atAGlance.amountYouMayOwe > 0) {
      patientCandidates.push({
        type: "patient_responsibility",
        amount: analysisData.atAGlance.amountYouMayOwe,
        label: "Amount You May Owe",
        confidence: "high",
        evidence: "Extracted from document summary",
      });
    }
  }

  // From charges[] sum (UNITS-AWARE)
  if (analysisData.charges && Array.isArray(analysisData.charges)) {
    const chargesWithAmounts = analysisData.charges.filter((c: any) => {
      const amount = parseCurrency(c.amount);
      return amount !== null && amount > 0;
    });

    const chargeSum = chargesWithAmounts.reduce((sum: number, c: any) => {
      const amount = parseCurrency(c.amount) || 0;
      const units = typeof c.units === "number" && c.units > 0 ? c.units : 1;
      return sum + amount * units;
    }, 0);

    if (chargeSum > 0) {
      chargesCandidates.push({
        type: "charges",
        amount: chargeSum,
        label: "Sum of line items",
        confidence: chargesWithAmounts.length >= 2 ? "medium" : "low",
        evidence: `Calculated from ${chargesWithAmounts.length} line items (units-aware)`,
      });
    }
  }

  // From extractedTotals (structured or legacy)
  if (analysisData.extractedTotals) {
    const et = analysisData.extractedTotals;

    const tcValue =
      typeof et.totalCharges === "object" && et.totalCharges?.value
        ? et.totalCharges.value
        : typeof et.totalCharges === "number"
          ? et.totalCharges
          : null;

    if (tcValue && tcValue > 0) {
      const tcObj = typeof et.totalCharges === "object" ? et.totalCharges : null;
      chargesCandidates.push({
        type: "charges",
        amount: tcValue,
        label: tcObj?.label || "Total Charges (extracted)",
        confidence: (tcObj?.confidence as "high" | "medium" | "low") || "high",
        evidence: tcObj?.evidence || et.totalsSource || "From extractedTotals",
      });
    }

    const prValue =
      typeof et.patientResponsibility === "object" && et.patientResponsibility?.value
        ? et.patientResponsibility.value
        : typeof et.patientResponsibility === "number"
          ? et.patientResponsibility
          : null;

    if (prValue && prValue > 0) {
      const prObj = typeof et.patientResponsibility === "object" ? et.patientResponsibility : null;
      patientCandidates.push({
        type: "patient_responsibility",
        amount: prValue,
        label: prObj?.label || "Patient Responsibility (extracted)",
        confidence: (prObj?.confidence as "high" | "medium" | "low") || "high",
        evidence: prObj?.evidence || et.totalsSource || "From extractedTotals",
      });
    }

    // amountDue -> patient_responsibility bucket (balance due)
    const adValue =
      typeof et.amountDue === "object" && et.amountDue?.value
        ? et.amountDue.value
        : typeof et.amountDue === "number"
          ? et.amountDue
          : null;

    if (adValue && adValue > 0) {
      const adObj = typeof et.amountDue === "object" ? et.amountDue : null;
      patientCandidates.push({
        type: "patient_responsibility",
        amount: adValue,
        label: adObj?.label || "Amount Due (extracted)",
        confidence: (adObj?.confidence as "high" | "medium" | "low") || "high",
        evidence: adObj?.evidence || et.totalsSource || "From extractedTotals",
      });
    }

    // insurancePaid -> separate bucket
    const ipValue =
      typeof et.insurancePaid === "object" && et.insurancePaid?.value
        ? et.insurancePaid.value
        : typeof et.insurancePaid === "number"
          ? et.insurancePaid
          : null;

    if (ipValue && ipValue > 0) {
      const ipObj = typeof et.insurancePaid === "object" ? et.insurancePaid : null;
      insurancePaidCandidates.push({
        type: "insurance_paid",
        amount: ipValue,
        label: ipObj?.label || "Insurance Paid (extracted)",
        confidence: (ipObj?.confidence as "high" | "medium" | "low") || "medium",
        evidence: ipObj?.evidence || et.totalsSource || "From extractedTotals",
      });
    }
  }

  // Direct total-ish fields (avoid dupes)
  const totalFieldNames = [
    "totalCharges",
    "total_charges",
    "totalBilled",
    "total_billed",
    "grandTotal",
    "grand_total",
    "statementTotal",
    "statement_total",
  ];

  for (const fieldName of totalFieldNames) {
    const value = analysisData[fieldName];
    if (value) {
      const amount = parseCurrency(value);
      if (amount && amount > 0 && !chargesCandidates.some((c) => Math.abs(c.amount - amount) < 1)) {
        chargesCandidates.push({
          type: "charges",
          amount,
          label: `From ${fieldName}`,
          confidence: "high",
          evidence: `Direct field: ${fieldName}`,
        });
      }
    }
  }

  const balanceFieldNames = [
    "amountDue",
    "amount_due",
    "balanceDue",
    "balance_due",
    "patientBalance",
    "patient_balance",
    "youOwe",
    "you_owe",
  ];

  for (const fieldName of balanceFieldNames) {
    const value = analysisData[fieldName];
    if (value) {
      const amount = parseCurrency(value);
      if (amount && amount > 0) {
        patientCandidates.push({
          type: "patient_responsibility",
          amount,
          label: `From ${fieldName}`,
          confidence: "high",
          evidence: `Direct field: ${fieldName}`,
        });
      }
    }
  }

  // From EOB data
  if (analysisData.eobData) {
    const eob = analysisData.eobData;

    if (eob.billedAmount > 0) {
      chargesCandidates.push({
        type: "charges",
        amount: eob.billedAmount,
        label: "EOB Billed Amount",
        confidence: "high",
        evidence: "From Explanation of Benefits",
      });
    }

    if (eob.allowedAmount > 0) {
      allowedCandidates.push({
        type: "allowed",
        amount: eob.allowedAmount,
        label: "EOB Allowed Amount",
        confidence: "high",
        evidence: "From Explanation of Benefits",
      });
    }

    if (eob.insurancePaid > 0) {
      insurancePaidCandidates.push({
        type: "insurance_paid",
        amount: eob.insurancePaid,
        label: "EOB Insurance Paid",
        confidence: "high",
        evidence: "From Explanation of Benefits",
      });
    }

    if (eob.patientResponsibility > 0) {
      patientCandidates.push({
        type: "patient_responsibility",
        amount: eob.patientResponsibility,
        label: "EOB Patient Responsibility",
        confidence: "high",
        evidence: "From Explanation of Benefits",
      });
    }
  }

  // Sort by confidence then amount
  const sortByConfidenceAndAmount = (a: TotalCandidate, b: TotalCandidate) => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    if (order[a.confidence] !== order[b.confidence]) return order[a.confidence] - order[b.confidence];
    return b.amount - a.amount;
  };

  chargesCandidates.sort(sortByConfidenceAndAmount);
  allowedCandidates.sort(sortByConfidenceAndAmount);
  patientCandidates.sort(sortByConfidenceAndAmount);
  insurancePaidCandidates.sort(sortByConfidenceAndAmount);

  return { chargesCandidates, allowedCandidates, patientCandidates, insurancePaidCandidates };
}

/**
 * Select the best comparison total based on available data.
 * IMPORTANT: Never treat insurancePaid as allowed.
 */
export function selectComparisonTotal(
  candidates: ReturnType<typeof extractTotalCandidates>,
  documentType: DocumentClassification,
): TotalsReconciliation["comparisonTotal"] {
  const { chargesCandidates, allowedCandidates, patientCandidates } = candidates;

  const allowedOnly = allowedCandidates.filter((c) => c.type === "allowed");

  // 1) Allowed amount (best if present)
  if (allowedOnly.length > 0 && allowedOnly[0].confidence !== "low") {
    const best = allowedOnly[0];
    return {
      value: best.amount,
      type: "allowed",
      confidence: best.confidence,
      explanation: `Using the plan/insurance allowed amount (${best.label}) as the comparison basis.`,
      limitedComparability: false,
    };
  }

  // 2) Total charges / total billed
  if (chargesCandidates.length > 0 && chargesCandidates[0].confidence !== "low") {
    const best = chargesCandidates[0];
    return {
      value: best.amount,
      type: "charges",
      confidence: best.confidence,
      explanation: `Using total charges (${best.label}) as the comparison basis.`,
      limitedComparability: false,
    };
  }

  // 3) Balance due / patient responsibility (comparability limited)
  if (patientCandidates.length > 0) {
    const best = patientCandidates[0];
    return {
      value: best.amount,
      type: "patient_responsibility",
      confidence: best.confidence,
      explanation: `Only a balance due / amount you may owe was found. This can include insurance adjustments and sometimes older balances, so comparisons may be less direct.`,
      limitedComparability: true,
    };
  }

  return null;
}

/**
 * Full reconciliation pipeline
 */
export function reconcileTotals(analysisData: any, documentContent?: string): TotalsReconciliation {
  // Classify document
  const documentType = documentContent
    ? classifyDocument(documentContent)
    : ((analysisData.atAGlance?.documentClassification || "unknown") as DocumentClassification);

  // Build line items
  const lineItems: LineItemExtraction[] = [];
  if (analysisData.charges && Array.isArray(analysisData.charges)) {
    for (const charge of analysisData.charges) {
      const chargeAmt = parseCurrency(charge.amount);
      const units = typeof charge.units === "number" && charge.units > 0 ? charge.units : 1;

      lineItems.push({
        description: charge.description || "",
        chargeAmount: chargeAmt !== null && chargeAmt > 0 ? chargeAmt : undefined,
        chargeAmountConfidence: charge.amountConfidence || "medium",
        chargeAmountEvidence: charge.amountEvidence || undefined,
        allowedAmount: parseCurrency(charge.allowedAmount) ?? undefined,
        patientAmount: parseCurrency(charge.patientAmount) ?? undefined,
        code: charge.code,
        codeType: charge.codeType || "unknown",
        units,
      });
    }
  }

  // Convert to normalization shape
  const lineItemsForNorm: LineItemForTotals[] = lineItems.map((li) => ({
    description: li.description,
    billedAmount: li.chargeAmount ?? null,
    billedAmountConfidence: li.chargeAmountConfidence,
    billedEvidence: li.chargeAmountEvidence,
    code: li.code,
    units: li.units,
  }));

  // Structured totals module
  const structuredTotals = normalizeAndDeriveTotals(analysisData.extractedTotals, lineItemsForNorm);

  // Sums (UNITS-AWARE)
  const sumLineCharges = lineItems.reduce((sum, item) => {
    const units = typeof item.units === "number" && item.units > 0 ? item.units : 1;
    return sum + (item.chargeAmount || 0) * units;
  }, 0);

  const hasAllowed = lineItems.some((i) => i.allowedAmount !== undefined);
  const sumLineAllowed = hasAllowed
    ? lineItems.reduce((sum, item) => {
        const units = typeof item.units === "number" && item.units > 0 ? item.units : 1;
        return sum + (item.allowedAmount || 0) * units;
      }, 0)
    : null;

  const hasPatient = lineItems.some((i) => i.patientAmount !== undefined);
  const sumLinePatient = hasPatient
    ? lineItems.reduce((sum, item) => {
        const units = typeof item.units === "number" && item.units > 0 ? item.units : 1;
        return sum + (item.patientAmount || 0) * units;
      }, 0)
    : null;

  // Legacy candidates (still useful)
  const candidates = extractTotalCandidates(analysisData, documentContent);

  // Select comparison total (prefer structured selection)
  const structuredSelection = selectStructuredComparisonTotal(
    structuredTotals,
    sumLineCharges > 0 ? sumLineCharges : undefined,
    lineItems.filter((li) => li.code && li.chargeAmount).length,
  );

  const comparisonTotal: TotalsReconciliation["comparisonTotal"] = structuredSelection
    ? {
        value: structuredSelection.value,
        type:
          structuredSelection.type === "allowedAmount"
            ? "allowed"
            : structuredSelection.type === "totalCharges"
              ? "charges"
              : structuredSelection.type === "patientResponsibility"
                ? "patient_responsibility"
                : structuredSelection.type === "amountDue"
                  ? "patient_responsibility"
                  : "charges",
        confidence: structuredSelection.confidence,
        explanation: structuredSelection.explanation,
        limitedComparability: structuredSelection.limitedComparability,
        scopeWarnings: structuredSelection.scopeWarnings,
      }
    : selectComparisonTotal(candidates, documentType);

  // Reconciliation status (compare like-with-like)
  let reconciliationStatus: TotalsReconciliation["reconciliationStatus"] = "insufficient_data";
  let reconciliationNote: string | undefined;

  const tolerance = 0.03; // 3%

  if (comparisonTotal) {
    let basisSum: number | null = null;
    if (comparisonTotal.type === "charges") basisSum = sumLineCharges > 0 ? sumLineCharges : null;
    if (comparisonTotal.type === "allowed")
      basisSum = sumLineAllowed !== null && sumLineAllowed > 0 ? sumLineAllowed : null;
    if (comparisonTotal.type === "patient_responsibility")
      basisSum = sumLinePatient !== null && sumLinePatient > 0 ? sumLinePatient : null;

    if (basisSum !== null) {
      const diff = Math.abs(comparisonTotal.value - basisSum);
      const percentDiff = basisSum > 0 ? diff / basisSum : 1;

      if (percentDiff <= tolerance) {
        reconciliationStatus = "matched";
        reconciliationNote = `Line item sum matches the selected total within ${(tolerance * 100).toFixed(0)}% tolerance.`;
      } else {
        reconciliationStatus = "mismatch";
        reconciliationNote =
          `Line item sum ($${basisSum.toFixed(2)}) differs from selected total ` +
          `($${comparisonTotal.value.toFixed(2)}) by ${(percentDiff * 100).toFixed(1)}%.`;
      }
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
    insurancePaidCandidates: candidates.insurancePaidCandidates,
    structuredTotals,
    comparisonTotal,
    documentType,
    reconciliationStatus,
    reconciliationNote,
    derivationNotes: structuredTotals.notes,
  };
}

/**
 * Generate user-friendly label for the comparison total
 */
export function formatComparisonTotalLabel(type: TotalType): string {
  switch (type) {
    case "charges":
      return "TOTAL (Charges)";
    case "allowed":
      return "TOTAL (Plan Allowed)";
    case "patient_responsibility":
      return "TOTAL (Balance / You May Owe)";
    case "insurance_paid":
      return "TOTAL (Insurance Paid)";
    default:
      return "TOTAL";
  }
}

/**
 * Convenience wrapper
 */
export function extractTotals(analysisData: any):
  | (TotalsReconciliation & {
      comparisonTotalValue?: number;
      comparisonTotalType?: string;
      comparisonTotalExplanation?: string;
    })
  | null {
  try {
    const reconciliation = reconcileTotals(analysisData);

    return {
      ...reconciliation,
      comparisonTotalValue: reconciliation.comparisonTotal?.value,
      comparisonTotalType: reconciliation.comparisonTotal?.type,
      comparisonTotalExplanation: reconciliation.comparisonTotal?.explanation,
    };
  } catch (error) {
    console.error("[TotalsExtractor] Error extracting totals:", error);
    return null;
  }
}
