/**
 * Totals Extraction and Reconciliation
 *
 * Handles:
 * - Document classification
 * - Total candidate extraction
 * - Line item extraction
 * - Totals normalization + comparison total selection
 */

import {
  StructuredTotals,
  DetectedTotal,
  LineItemForTotals,
  normalizeAndDeriveTotals,
  selectComparisonTotal as selectStructuredComparisonTotal,
  ComparisonTotalSelection,
  TotalsConfidence,
  TotalsSource,
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

  chargesCandidates: TotalCandidate[];
  allowedCandidates: TotalCandidate[];
  patientCandidates: TotalCandidate[];

  structuredTotals?: StructuredTotals;

  comparisonTotal: {
    value: number;
    type: TotalType;
    confidence: "high" | "medium" | "low";
    explanation: string;
    limitedComparability: boolean;
    scopeWarnings?: string[];
  } | null;

  documentType: DocumentClassification;

  reconciliationStatus: "matched" | "mismatch" | "insufficient_data";
  reconciliationNote?: string;

  derivationNotes?: string[];
}

// ============= Document type indicators =============

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
 * Clean and parse a currency string to number.
 * Supports: $1,234.56 and (1,234.56) negatives.
 */
export function parseCurrency(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;

  const cleaned = String(value)
    .replace(/[$,\s]/g, "")
    .replace(/[()]/g, (match) => (match === "(" ? "-" : ""))
    .trim();

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Classify document type based on content indicators.
 */
export function classifyDocument(content: string): DocumentClassification {
  const lower = content.toLowerCase();

  const eobScore = EOB_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);
  const portalScore = PORTAL_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);
  const statementScore = STATEMENT_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);
  const hospitalScore = HOSPITAL_SUMMARY_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);
  const revenueCodeScore = REVENUE_CODE_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 3 : 0), 0);

  // ✅ ADD THIS LINE
  const postInsuranceScore = POST_INSURANCE_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);

  const isReceipt =
    lower.includes("receipt") ||
    lower.includes("payment received") ||
    (lower.includes("paid") && lower.includes("thank you"));

  if (isReceipt && !lower.includes("charges")) {
    return "payment_receipt";
  }

  if (eobScore >= 6 && eobScore > statementScore) {
    return "eob";
  }

  // CPT: 5 digits; HCPCS: 1 letter + 4 digits
  const hasCpt = /\b\d{5}\b/.test(content) || /\b[A-Z]\d{4}\b/.test(content);

  if (revenueCodeScore >= 6 && !hasCpt) {
    return "revenue_code_only";
  }

  if (hospitalScore >= 6 && revenueCodeScore >= 3) {
    return "hospital_summary_bill";
  }

  if (portalScore >= 4 && !lower.includes("itemized")) {
    return "portal_summary";
  }

  if (statementScore >= 4) {
    // ✅ CHECK FOR POST-INSURANCE STATEMENT
    if (postInsuranceScore >= 6 && hasCpt) {
      return "itemized_statement";
    }
    return hasCpt ? "itemized_statement" : "summary_statement";
  }

  return "unknown";
}

/**
 * Legacy: Extract total candidates from analysisData.
 * (Kept for backward compatibility; structuredTotals is now preferred.)
 */
export function extractTotalCandidates(analysisData: any): {
  chargesCandidates: TotalCandidate[];
  allowedCandidates: TotalCandidate[];
  patientCandidates: TotalCandidate[];
} {
  const chargesCandidates: TotalCandidate[] = [];
  const allowedCandidates: TotalCandidate[] = [];
  const patientCandidates: TotalCandidate[] = [];

  // atAGlance totals
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
        label: "Amount You May Owe (at a glance)",
        confidence: "high",
        evidence: "Extracted from document summary",
      });
    }
  }

  // sum charges array
  if (analysisData.charges && Array.isArray(analysisData.charges)) {
    const chargesWithAmounts = analysisData.charges
      .map((c: any) => ({ ...c, parsed: parseCurrency(c.amount) }))
      .filter((c: any) => c.parsed !== null && c.parsed > 0);

    const chargeSum = chargesWithAmounts.reduce((sum: number, c: any) => sum + (c.parsed || 0), 0);

    if (chargeSum > 0) {
      chargesCandidates.push({
        type: "charges",
        amount: chargeSum,
        label: "Sum of line items",
        confidence: chargesWithAmounts.length >= 2 ? "medium" : "low",
        evidence: `Calculated from ${chargesWithAmounts.length} line items`,
      });
    }
  }

  // extractedTotals (AI)
  if (analysisData.extractedTotals) {
    const et = analysisData.extractedTotals;

    const tc =
      typeof et.totalCharges === "object" && et.totalCharges?.value != null ? et.totalCharges.value : et.totalCharges;
    if (typeof tc === "number" && tc > 0) {
      chargesCandidates.push({
        type: "charges",
        amount: tc,
        label: et.totalCharges?.label || "Total Charges (extracted)",
        confidence: et.totalCharges?.confidence || "high",
        evidence: et.totalCharges?.evidence || "From extractedTotals",
      });
    }

    const ad = typeof et.amountDue === "object" && et.amountDue?.value != null ? et.amountDue.value : et.amountDue;
    if (typeof ad === "number" && ad > 0) {
      patientCandidates.push({
        type: "patient_responsibility",
        amount: ad,
        label: et.amountDue?.label || "Amount Due (extracted)",
        confidence: et.amountDue?.confidence || "high",
        evidence: et.amountDue?.evidence || "From extractedTotals",
      });
    }
  }

  const sortByConfidence = (a: TotalCandidate, b: TotalCandidate) => {
    const order = { high: 0, medium: 1, low: 2 };
    if (order[a.confidence] !== order[b.confidence]) return order[a.confidence] - order[b.confidence];
    return b.amount - a.amount;
  };

  chargesCandidates.sort(sortByConfidence);
  allowedCandidates.sort(sortByConfidence);
  patientCandidates.sort(sortByConfidence);

  return { chargesCandidates, allowedCandidates, patientCandidates };
}

/**
 * Legacy fallback selection.
 */
export function selectComparisonTotal(
  candidates: ReturnType<typeof extractTotalCandidates>,
): TotalsReconciliation["comparisonTotal"] {
  const { allowedCandidates, chargesCandidates, patientCandidates } = candidates;

  if (allowedCandidates.length > 0 && allowedCandidates[0].confidence !== "low") {
    const best = allowedCandidates[0];
    return {
      value: best.amount,
      type: "allowed",
      confidence: best.confidence,
      explanation: `Using the allowed amount (${best.label}) as this represents what insurance agreed to pay.`,
      limitedComparability: false,
    };
  }

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

  if (patientCandidates.length > 0) {
    const best = patientCandidates[0];
    return {
      value: best.amount,
      type: "patient_responsibility",
      confidence: best.confidence,
      explanation: `Only a patient balance was available. This may already include insurance adjustments.`,
      limitedComparability: true,
    };
  }

  return null;
}

/**
 * Inject atAGlance totals into structuredTotals when AI missed totalCharges.
 * This is the critical fix that prevents "amount due" ($118) from becoming "total charges".
 */
/**
 * Inject atAGlance totals into structuredTotals when AI missed totalCharges.
 *
 * CRITICAL FIX: This version adds document type validation to prevent
 * patient balances from being misinterpreted as total charges.
 */
function injectAtAGlanceFallbacks(structured: StructuredTotals, analysisData: any): StructuredTotals {
  const result: StructuredTotals = {
    ...structured,
    notes: [...(structured.notes || [])],
  };

  const totalBilled = analysisData?.atAGlance?.totalBilled;
  const amountYouMayOwe = analysisData?.atAGlance?.amountYouMayOwe;
  const documentType = analysisData?.atAGlance?.documentClassification;

  // ✅ NEW: Identify document types that likely show balance only (not charges)
  const isBalanceOnlyDoc =
    documentType === "eob" || documentType === "portal_summary" || documentType === "payment_receipt";

  // ✅ NEW: Additional validation - if totalBilled <= amountYouMayOwe, they're likely swapped
  const likelySwapped =
    typeof totalBilled === "number" &&
    typeof amountYouMayOwe === "number" &&
    totalBilled > 0 &&
    amountYouMayOwe > 0 &&
    totalBilled <= amountYouMayOwe;

  if (likelySwapped) {
    result.notes.push(
      "⚠️ WARNING: atAGlance.totalBilled ($" +
        totalBilled +
        ") is less than or equal to amountYouMayOwe ($" +
        amountYouMayOwe +
        "). These values may be swapped. Using amountYouMayOwe for comparisons.",
    );
  }

  // Only use totalBilled as charges fallback if:
  // 1. NOT a balance-only document type, AND
  // 2. Values aren't likely swapped
  if (!isBalanceOnlyDoc && !likelySwapped && typeof totalBilled === "number" && totalBilled > 0) {
    const existing = result.totalCharges;
    const shouldOverride =
      !existing ||
      existing.confidence === "low" ||
      existing.value <= 0 ||
      // If existing is tiny compared to summary total, it's almost certainly wrong (e.g., amount due misread)
      existing.value < totalBilled * 0.5;

    if (shouldOverride) {
      result.totalCharges = {
        value: totalBilled,
        confidence: "high",
        evidence: `atAGlance.totalBilled = ${totalBilled}`,
        label: "Total billed (summary)",
        source: "document_label" as TotalsSource,
      };
      result.notes.push("Used atAGlance.totalBilled as totalCharges fallback (AI totalCharges missing/weak).");
    }
  } else if (isBalanceOnlyDoc && typeof totalBilled === "number" && totalBilled > 0) {
    // ✅ NEW: If balance-only doc, warn that totalBilled likely represents balance
    result.notes.push(
      `Document type '${documentType}' typically shows balance, not original charges. ` +
        `The value labeled as 'totalBilled' ($${totalBilled}) may actually be the current balance. ` +
        `Using amountYouMayOwe for comparisons instead.`,
    );
  }

  // If AI missed amountDue but atAGlance has it, inject it.
  // ✅ ENHANCED: Handle zero-dollar bills correctly
  if (!result.amountDue || result.amountDue.value === undefined || result.amountDue.value === null) {
    if (typeof amountYouMayOwe === "number" && amountYouMayOwe >= 0) {
      // Note: We allow 0 here because $0.00 balance is valid (fully covered)
      result.amountDue = {
        value: amountYouMayOwe,
        confidence: "high",
        evidence: `atAGlance.amountYouMayOwe = ${amountYouMayOwe}`,
        label: amountYouMayOwe === 0 ? "Amount due (fully covered)" : "Amount due / you may owe (summary)",
        source: "document_label" as TotalsSource,
      };

      if (amountYouMayOwe === 0) {
        result.notes.push("Used atAGlance.amountYouMayOwe as amountDue fallback. Balance is $0 (fully covered).");
      } else {
        result.notes.push("Used atAGlance.amountYouMayOwe as amountDue fallback.");
      }
    }
  }

  return result;
}

/**
 * Full reconciliation pipeline.
 */
export function reconcileTotals(analysisData: any, documentContent?: string): TotalsReconciliation {
  const documentType = documentContent
    ? classifyDocument(documentContent)
    : ((analysisData.atAGlance?.documentClassification || "unknown") as DocumentClassification);

  // Extract line items
  const lineItems: LineItemExtraction[] = [];
  if (analysisData.charges && Array.isArray(analysisData.charges)) {
    for (const charge of analysisData.charges) {
      const chargeAmt = parseCurrency(charge.amount);
      lineItems.push({
        description: charge.description || "",
        chargeAmount: chargeAmt !== null && chargeAmt > 0 ? chargeAmt : undefined,
        chargeAmountConfidence: (charge.amountConfidence as TotalsConfidence) || "medium",
        chargeAmountEvidence: charge.amountEvidence || undefined,
        code: charge.code,
        codeType: charge.codeType || "unknown",
        units: charge.units || 1,
      });
    }
  }

  // Convert to LineItemForTotals
  const lineItemsForNorm: LineItemForTotals[] = lineItems.map((li) => ({
    description: li.description,
    billedAmount: li.chargeAmount ?? null,
    billedAmountConfidence: li.chargeAmountConfidence,
    billedEvidence: li.chargeAmountEvidence,
    code: li.code,
    units: li.units,
  }));

  // Normalize totals from AI + line items
  let structuredTotals = normalizeAndDeriveTotals(analysisData.extractedTotals, lineItemsForNorm);

  // ✅ CRITICAL: inject atAGlance fallback so we don't treat $118 as total charges
  structuredTotals = injectAtAGlanceFallbacks(structuredTotals, analysisData);

  // Sums
  const sumLineCharges = lineItems.reduce((sum, item) => sum + (item.chargeAmount || 0), 0);

  const hasAllowed = lineItems.some((i) => i.allowedAmount !== undefined);
  const sumLineAllowed = hasAllowed ? lineItems.reduce((sum, item) => sum + (item.allowedAmount || 0), 0) : null;

  const hasPatient = lineItems.some((i) => i.patientAmount !== undefined);
  const sumLinePatient = hasPatient ? lineItems.reduce((sum, item) => sum + (item.patientAmount || 0), 0) : null;

  // Legacy candidates (backward compatibility)
  const candidates = extractTotalCandidates(analysisData);

  // Select comparison total (structured)
  const structuredSelection = selectStructuredComparisonTotal(
    structuredTotals,
    sumLineCharges > 0 ? sumLineCharges : undefined,
    lineItems.filter((li) => li.code && li.chargeAmount).length,
  );

  const comparisonTotal: TotalsReconciliation["comparisonTotal"] = structuredSelection
    ? {
        value: structuredSelection.value,
        type:
          structuredSelection.type === "totalCharges"
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
    : selectComparisonTotal(candidates);

  // Reconciliation status
  let reconciliationStatus: TotalsReconciliation["reconciliationStatus"] = "insufficient_data";
  let reconciliationNote: string | undefined;

  if (comparisonTotal && lineItems.length > 0 && sumLineCharges > 0) {
    const tolerance = 0.03;
    const diff = Math.abs(comparisonTotal.value - sumLineCharges);
    const percentDiff = diff / sumLineCharges;

    if (percentDiff <= tolerance) {
      reconciliationStatus = "matched";
      reconciliationNote = "Line item sum matches the total within 3% tolerance.";
    } else {
      reconciliationStatus = "mismatch";
      reconciliationNote = `Line item sum ($${sumLineCharges.toFixed(2)}) differs from total ($${comparisonTotal.value.toFixed(
        2,
      )}) by ${(percentDiff * 100).toFixed(1)}%.`;
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
    structuredTotals,
    comparisonTotal,
    documentType,
    reconciliationStatus,
    reconciliationNote,
    derivationNotes: structuredTotals.notes,
  };
}

export function formatComparisonTotalLabel(type: TotalType): string {
  switch (type) {
    case "charges":
      return "TOTAL (Charges)";
    case "allowed":
      return "TOTAL (Allowed)";
    case "patient_responsibility":
      return "TOTAL (Patient Responsibility)";
    case "insurance_paid":
      return "TOTAL (Insurance Paid)";
    default:
      return "TOTAL";
  }
}

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
