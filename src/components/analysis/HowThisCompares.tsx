/**
 * How This Compares Section
 *
 * Displays Medicare benchmark comparison in a user-friendly,
 * trust-building format following approved language guidelines.
 *
 * Key principles:
 * - Medicare is a REFERENCE ANCHOR, not "what you should pay"
 * - Calm, non-judgmental, educational tone
 * - No raw jargon (RVUs, GPCI) exposed to users
 * - Three distinct empty states for clarity
 * - Debug panel for troubleshooting
 * - Reverse search runs automatically when no valid codes found
 */

import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
  MapPin,
  ExternalLink,
  Bug,
  FileQuestion,
  Search,
  Sparkles,
} from "lucide-react";
import { cn, formatAmount, formatMultiple, formatPercent } from "@/lib/utils";
import {
  calculateMedicareBenchmarks,
  generateBenchmarkStatement,
  generateComparisonSentence,
  generateConfidenceQualifier,
  generateYearFallbackDisclosure,
  generateOverallStatus,
  MedicareBenchmarkOutput,
  BenchmarkLineItem,
  BenchmarkLineResult,
  normalizeCode,
  isValidBillableCode,
  NormalizedCode,
  GeoDebugInfo,
} from "@/lib/medicareBenchmarkService";
import { normalizeAndValidateCode, validateCodeTokens, ValidatedCode, RejectedToken } from "@/lib/cptCodeValidator";
import {
  reverseSearchCodes,
  batchReverseSearch,
  ReverseSearchResult,
  InferredCodeCandidate,
} from "@/lib/reverseCodeSearch";
import { AnalysisResult, CareSetting } from "@/types";
import { DebugCalculationPanel, DebugCalculationData } from "./DebugCalculationPanel";
import { reconcileTotals, TotalsReconciliation } from "@/lib/totalsExtractor";
import { computeComparisonReadiness, formatReadinessForUI, ReadinessResult } from "@/lib/comparisonReadinessGate";
import { normalizeAndDeriveTotals, StructuredTotals } from "@/lib/totals/normalizeTotals";
import { UnmatchedCodesCard } from "./UnmatchedCodesCard";
import { buildBilledAmountByCode } from "@/lib/billedAmountByCode";
import { BillTotalsGrid } from "./BillTotalsGrid";
import { ServiceDetailsTable } from "./ServiceDetailsTable";
import { NegotiabilityCategorySection } from "./NegotiabilityCategorySection";
import { CommonlyAskedQuestionsSection } from "./CommonlyAskedQuestionsSection";
import { PaymentFlowSection } from "./PaymentFlowSection";
import { detectBillType, BillTypeResult } from "@/lib/billTypeDetector";
import { supabase } from "@/integrations/supabase/client";

// ============= Props =============
interface HowThisComparesProps {
  analysis: AnalysisResult;
  state: string;
  zipCode?: string;
  careSetting?: CareSetting;
}

// ============= Status Configuration =============

const statusConfig = {
  fair: {
    icon: CheckCircle,
    label: "Within Typical Range",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    description: "Your charges fall within the range commonly seen with commercial insurance.",
  },
  high: {
    icon: TrendingUp,
    label: "Higher Than Typical",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    description: "Some charges are above typical rates. You may want to ask questions.",
  },
  very_high: {
    icon: AlertTriangle,
    label: "Significantly Above Reference",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    description: "These charges are notably higher than reference prices.",
  },
  mixed: {
    icon: Minus,
    label: "Mixed Results",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    description: "Some charges are fair, others may warrant discussion.",
  },
  unknown: {
    icon: HelpCircle,
    label: "Limited Data",
    color: "text-muted-foreground",
    bg: "bg-muted/10",
    border: "border-border/40",
    description: "Not enough data available for a full comparison.",
  },
};

const lineStatusConfig = {
  fair: {
    icon: CheckCircle,
    label: "Fair",
    color: "text-success",
    bg: "bg-success/10",
  },
  high: {
    icon: AlertTriangle,
    label: "High",
    color: "text-warning",
    bg: "bg-warning/10",
  },
  very_high: {
    icon: AlertCircle,
    label: "Very High",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  unknown: {
    icon: HelpCircle,
    label: "N/A",
    color: "text-muted-foreground",
    bg: "bg-muted/10",
  },
};

// ============= Helper Functions =============

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Extract line items ONLY from analysis.charges
/**
 * Extract line items ONLY from analysis.charges
 * NO validation - accept ALL codes from the backend
 */
function extractLineItems(analysis: AnalysisResult): {
  items: BenchmarkLineItem[];
  rawCodes: string[];
  rejectedTokens: RejectedToken[];
} {
  const items: BenchmarkLineItem[] = [];
  const rawCodes: string[] = [];
  const rejectedTokens: RejectedToken[] = [];
  const seenCodes = new Set<string>();

  // Build billed amounts map from charges
  const billedByCode = buildBilledAmountByCode(analysis.charges || []);
  console.log("[DEBUG extractLineItems] billedByCode map:", billedByCode);
  console.log("[DEBUG extractLineItems] Charges array:", analysis.charges?.length || 0, "items");

  // ONLY extract from analysis.charges - no other sources
  if (!analysis.charges || !Array.isArray(analysis.charges)) {
    console.log("[DEBUG extractLineItems] No charges array found");
    return { items, rawCodes, rejectedTokens };
  }

  for (const charge of analysis.charges) {
    const code = ((charge as any).code || "").trim();

    if (!code) {
      console.log("[DEBUG extractLineItems] Skipping charge with no code:", charge.description);
      continue;
    }

    // Skip duplicates
    if (seenCodes.has(code)) {
      console.log("[DEBUG extractLineItems] Skipping duplicate code:", code);
      continue;
    }

    seenCodes.add(code);
    rawCodes.push(code);

    // Get amount from billedByCode map
    const billedAmount = billedByCode[code] || 0;

    console.log(
      "[DEBUG extractLineItems] Adding code:",
      code,
      "Amount:",
      billedAmount,
      "Description:",
      charge.description,
    );

    items.push({
      hcpcs: code,
      rawCode: code,
      description: charge.description || "Medical service",
      billedAmount,
      units: (charge as any).units || 1,
    });
  }

  console.log("[DEBUG extractLineItems] Final items count:", items.length);
  console.log(
    "[DEBUG extractLineItems] Final items:",
    items.map((i) => `${i.hcpcs}: $${i.billedAmount}`),
  );

  return { items, rawCodes, rejectedTokens };
}

/**
 * Extract service date from analysis
 */
function extractServiceDate(analysis: AnalysisResult): string | null {
  if (analysis.dateOfService) {
    return analysis.dateOfService;
  }
  return null;
}

// ============= Sub-Components =============

function DebugPanel({
  output,
  rawCodes,
  serviceDate,
  state,
  zipCode,
}: {
  output: MedicareBenchmarkOutput;
  rawCodes: string[];
  serviceDate: string | null;
  state?: string;
  zipCode?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showLineDetails, setShowLineDetails] = useState(false);

  // Count codes by match status
  const matchedCount = output.lineItems.filter((i) => i.matchStatus === "matched").length;
  const missingCount = output.lineItems.filter((i) => i.matchStatus === "missing").length;
  const existsNotPricedCount = output.lineItems.filter((i) => i.matchStatus === "exists_not_priced").length;

  // Conversion factor for display
  const CF = 34.6062;

  return (
    <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50 text-xs font-mono">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left text-muted-foreground hover:text-foreground"
      >
        <Bug className="h-3 w-3" />
        <span>Benchmark Debug Info</span>
        <div className="ml-auto flex items-center gap-2">
          {matchedCount > 0 && (
            <Badge variant="outline" className="text-success border-success/30 text-[10px]">
              {matchedCount} priced
            </Badge>
          )}
          {existsNotPricedCount > 0 && (
            <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">
              {existsNotPricedCount} exists/not priced
            </Badge>
          )}
          {missingCount > 0 && (
            <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">
              {missingCount} missing
            </Badge>
          )}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 text-muted-foreground">
          {/* Status summary */}
          <div className="grid grid-cols-2 gap-2 p-2 rounded bg-background/50">
            <div>
              <strong>Status:</strong>{" "}
              <span
                className={
                  output.status === "ok"
                    ? "text-success"
                    : output.status === "no_codes"
                      ? "text-destructive"
                      : "text-warning"
                }
              >
                {output.status}
              </span>
            </div>
            <div>
              <strong>Service Date:</strong> {serviceDate || "Not detected"}
            </div>
            <div>
              <strong>State:</strong> {state || "Not selected"}
            </div>
            <div>
              <strong>ZIP:</strong> {zipCode || "Not provided"}
            </div>
          </div>

          {/* Year info */}
          <div className="p-2 rounded bg-background/50">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <strong>Requested Years:</strong> {output.metadata.requestedYears.join(", ") || "None"}
              </div>
              <div>
                <strong>Benchmark Year Used:</strong>{" "}
                <span className="text-primary">{output.metadata.benchmarkYearUsed}</span>
              </div>
              <div>
                <strong>Latest MPFS Year:</strong> {output.debug.latestMpfsYear}
              </div>
              <div>
                <strong>Year Fallback:</strong>{" "}
                {output.metadata.usedYearFallback ? <span className="text-warning">Yes</span> : "No"}
              </div>
            </div>
            {output.metadata.fallbackReason && (
              <div className="mt-1 text-warning">
                <strong>Fallback Reason:</strong> {output.metadata.fallbackReason}
              </div>
            )}
          </div>

          {/* Locality/GPCI info */}
          <div className="p-2 rounded bg-background/50">
            <div className="mb-1">
              <strong>Geo Resolution:</strong>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <strong>Confidence:</strong>{" "}
                <span
                  className={
                    output.metadata.localityUsed === "local_adjusted"
                      ? "text-success"
                      : output.metadata.localityUsed === "state_estimate"
                        ? "text-warning"
                        : "text-muted-foreground"
                  }
                >
                  {output.metadata.localityUsed}
                </span>
              </div>
              <div>
                <strong>Lookup Method:</strong> {output.debug.gpciLookup?.method || "N/A"}
              </div>
              <div>
                <strong>Locality Name:</strong> {output.metadata.localityName || "National (no locality)"}
              </div>
              <div>
                <strong>Locality Code:</strong> {output.debug.gpciLookup?.localityCode || "N/A"}
              </div>
            </div>
            {output.debug.gpciLookup?.localityFound && (
              <div className="mt-2 p-2 rounded bg-success/5 border border-success/20">
                <strong className="text-success">GPCI Indices Applied:</strong>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <div>
                    Work:{" "}
                    <span className="text-foreground font-semibold">
                      {output.debug.gpciLookup.workGpci?.toFixed(4) || "N/A"}
                    </span>
                  </div>
                  <div>
                    PE:{" "}
                    <span className="text-foreground font-semibold">
                      {output.debug.gpciLookup.peGpci?.toFixed(4) || "N/A"}
                    </span>
                  </div>
                  <div>
                    MP:{" "}
                    <span className="text-foreground font-semibold">
                      {output.debug.gpciLookup.mpGpci?.toFixed(4) || "N/A"}
                    </span>
                  </div>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Formula: Fee = [(Work RVU × Work GPCI) + (PE RVU × PE GPCI) + (MP RVU × MP GPCI)] × {CF}
                </div>
              </div>
            )}
            {!output.debug.gpciLookup?.localityFound && (
              <div className="mt-2 p-2 rounded bg-muted/20 border border-border/30">
                <strong>National Calculation:</strong>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Formula: Fee = (Work RVU + PE RVU + MP RVU) × {CF}
                </div>
              </div>
            )}
          </div>

          {/* Code extraction */}
          <div className="pt-2 border-t border-border/30">
            <strong>Raw Codes Extracted ({rawCodes.length}):</strong>
            <div className="mt-1 flex flex-wrap gap-1">
              {rawCodes.length > 0 ? (
                rawCodes.slice(0, 20).map((c, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {c}
                  </Badge>
                ))
              ) : (
                <span className="text-destructive">None found in bill</span>
              )}
              {rawCodes.length > 20 && <span className="text-muted-foreground">+{rawCodes.length - 20} more</span>}
            </div>
          </div>

          {/* Match results with classification */}
          <div className="pt-2 border-t border-border/30">
            <div className="mb-2">
              <strong>Classification Results:</strong>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-success/5 border border-success/20">
                <strong className="text-success">✓ Priced ({matchedCount})</strong>
                <div className="text-[10px] mt-1">{output.debug.codesMatched.slice(0, 5).join(", ") || "None"}</div>
              </div>
              <div className="p-2 rounded bg-warning/5 border border-warning/20">
                <strong className="text-warning">⚠ Exists, Not Priced ({existsNotPricedCount})</strong>
                <div className="text-[10px] mt-1">
                  {output.debug.codesExistsNotPriced.slice(0, 5).join(", ") || "None"}
                </div>
              </div>
              <div className="p-2 rounded bg-destructive/5 border border-destructive/20">
                <strong className="text-destructive">✗ Missing ({missingCount})</strong>
                <div className="text-[10px] mt-1">{output.debug.codesMissing.slice(0, 5).join(", ") || "None"}</div>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="p-2 rounded bg-background/50">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <strong>Billed Total:</strong> {formatAmount(output.totals.billedTotal)}
              </div>
              <div>
                <strong>Medicare Ref:</strong>{" "}
                {formatAmount(output.totals.medicareReferenceTotal, { placeholder: "N/A" })}
              </div>
              <div>
                <strong>Multiple:</strong>{" "}
                {output.totals.multipleOfMedicare ? `${output.totals.multipleOfMedicare}×` : "N/A"}
              </div>
            </div>
          </div>

          {/* Per-line item details toggle */}
          <div className="pt-2 border-t border-border/30">
            <button
              onClick={() => setShowLineDetails(!showLineDetails)}
              className="flex items-center gap-2 text-primary hover:underline"
            >
              {showLineDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>Per-Line Item Debug ({output.lineItems.length} items)</span>
            </button>

            {showLineDetails && (
              <div className="mt-2 max-h-80 overflow-y-auto space-y-2">
                {output.lineItems.map((item, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-2 rounded text-[10px] border",
                      item.matchStatus === "matched"
                        ? "bg-success/5 border-success/20"
                        : item.matchStatus === "exists_not_priced"
                          ? "bg-warning/5 border-warning/20"
                          : "bg-destructive/5 border-destructive/20",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <code className="font-semibold text-foreground">{item.hcpcs}</code>
                      {item.modifier && <span className="text-muted-foreground">-{item.modifier}</span>}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[8px]",
                          item.matchStatus === "matched"
                            ? "text-success border-success/30"
                            : item.matchStatus === "exists_not_priced"
                              ? "text-warning border-warning/30"
                              : "text-destructive border-destructive/30",
                        )}
                      >
                        {item.matchStatus === "matched"
                          ? "PRICED"
                          : item.matchStatus === "exists_not_priced"
                            ? "EXISTS/NOT PRICED"
                            : "MISSING"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <strong>Billed:</strong> {formatAmount(item.billedAmount, { placeholder: "—" })}
                      </div>
                      <div>
                        <strong>Medicare Ref:</strong>{" "}
                        {formatAmount(item.medicareReferencePerUnit, { placeholder: "N/A" })}
                      </div>
                      <div>
                        <strong>Fee Source:</strong> {item.feeSource || "N/A"}
                      </div>
                      <div>
                        <strong>GPCI Applied:</strong> {item.gpciAdjusted ? "Yes" : "No"}
                      </div>
                      {item.notPricedReason && (
                        <div className="col-span-2">
                          <strong>Not Priced Reason:</strong>{" "}
                          <span className="text-warning">{item.notPricedReason}</span>
                        </div>
                      )}
                      <div className="col-span-2">
                        <strong>Year:</strong> {item.benchmarkYearUsed || "N/A"}
                      </div>
                    </div>

                    {item.notes.length > 0 && (
                      <div className="mt-1 text-muted-foreground">
                        <strong>Notes:</strong> {item.notes.join(" | ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Query details */}
          <div className="pt-2 border-t border-border/30">
            <strong>MPFS Queries Attempted ({output.debug.queriesAttempted.length}):</strong>
            <div className="mt-1 max-h-40 overflow-y-auto space-y-1">
              {output.debug.queriesAttempted.map((q, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-xs p-1 rounded",
                    q.row_exists ? (q.has_fee || q.has_rvu ? "bg-success/10" : "bg-warning/10") : "bg-destructive/10",
                  )}
                >
                  <span className="font-semibold">{q.hcpcs}</span>
                  {q.modifier && <span className="text-muted-foreground">-{q.modifier}</span>} (year: {q.year}, qp:{" "}
                  {q.qp_status}) →
                  {q.row_exists ? (
                    <span className={q.has_fee || q.has_rvu ? "text-success" : "text-warning"}>
                      {" "}
                      ✓ Row found {q.has_fee ? "(has fee)" : q.has_rvu ? "(has RVU)" : "(no fee/RVU)"}
                      {q.status_code && <span className="text-muted-foreground"> [status: {q.status_code}]</span>}
                    </span>
                  ) : (
                    <span className="text-destructive"> ✗ Not in MPFS</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Example query for manual verification */}
          {output.debug.queriesAttempted.length > 0 && (
            <div className="pt-2 border-t border-border/30">
              <strong>Example SQL Query:</strong>
              <pre className="mt-1 p-2 rounded bg-background/80 text-[10px] overflow-x-auto">
                {`SELECT hcpcs, modifier, status, nonfac_fee, fac_fee, 
       work_rvu, nonfac_pe_rvu, fac_pe_rvu, mp_rvu, conversion_factor
FROM mpfs_benchmarks 
WHERE hcpcs = '${output.debug.queriesAttempted[0]?.hcpcs || "99213"}' 
  AND year = ${output.metadata.benchmarkYearUsed}
  AND qp_status = 'nonQP'
  AND source = 'CMS MPFS';`}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LineItemCard({ item }: { item: BenchmarkLineResult }) {
  const [expanded, setExpanded] = useState(false);
  const config = lineStatusConfig[item.status];
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        "border rounded-lg transition-all",
        item.status === "very_high" && "border-destructive/20 bg-destructive/5",
        item.status === "high" && "border-warning/20 bg-warning/5",
        item.status === "fair" && "border-border/30 bg-card",
        item.status === "unknown" && "border-border/20 bg-muted/5",
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-muted/10 transition-colors"
      >
        {/* CPT Code - Compact */}
        <code className="text-xs font-mono bg-muted/50 px-1.5 py-0.5 rounded w-14 text-center shrink-0">
          {item.hcpcs}
          {item.modifier && <span className="text-muted-foreground">-{item.modifier}</span>}
        </code>

        {/* Description - Flexible */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate">{item.description || "Medical service"}</p>
        </div>

        {/* Amounts - Compact Grid */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Billed */}
          <div className="text-right w-20">
            <p className="text-sm font-semibold text-foreground">
              {item.billedAmount > 0 ? formatCurrency(item.billedAmount) : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">billed</p>
          </div>

          {/* Medicare Reference */}
          <div className="text-right w-20">
            <p className="text-sm text-muted-foreground">
              {item.medicareReferenceTotal ? formatCurrency(item.medicareReferenceTotal) : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">reference</p>
          </div>

          {/* Multiple - Only show if meaningful */}
          {item.multiple && item.multiple > 0 && (
            <div className="w-12 text-right">
              <p className={cn("text-sm font-semibold", config.color)}>{item.multiple}×</p>
            </div>
          )}
        </div>

        {/* Status Icon - Minimal */}
        <div className={cn("shrink-0 p-1 rounded", config.bg)}>
          <StatusIcon className={cn("h-3.5 w-3.5", config.color)} />
        </div>

        {/* Expand Icon */}
        {item.notes.length > 0 &&
          (expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ))}
      </button>

      {/* Expanded Details - Compact */}
      {expanded && item.notes.length > 0 && (
        <div className="px-3 pb-2.5 pt-0">
          <div className={cn("p-2 rounded text-xs", config.bg)}>
            {item.notes.map((note, idx) => (
              <p key={idx} className="text-muted-foreground leading-relaxed">
                {note}
              </p>
            ))}
            {item.isBundled && (
              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Info className="h-3 w-3" />
                May include related follow-up services
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  output,
  totalsReconciliation,
  readinessResult,
}: {
  output: MedicareBenchmarkOutput;
  totalsReconciliation?: TotalsReconciliation | null;
  readinessResult?: ReadinessResult | null;
}) {
  const { status, message } = generateOverallStatus(output);
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const benchmarkStatement = generateBenchmarkStatement(output);
  const comparisonSentence = generateComparisonSentence(output);
  const confidenceQualifier = generateConfidenceQualifier(output);
  const yearFallbackDisclosure = generateYearFallbackDisclosure(output);

  const flaggedCount = output.lineItems.filter((i) => i.status === "high" || i.status === "very_high").length;

  // Determine if we're comparing patient balance (limited comparability)
  const isPatientBalanceComparison = totalsReconciliation?.comparisonTotal?.type === "patient_responsibility";
  const comparisonTotalLabel =
    totalsReconciliation?.comparisonTotal?.type === "charges"
      ? "Total Charges"
      : totalsReconciliation?.comparisonTotal?.type === "patient_responsibility"
        ? "Patient Balance"
        : totalsReconciliation?.comparisonTotal?.type === "allowed"
          ? "Allowed Amount"
          : "Matched Items Billed";

  return (
    <Card className={cn("p-6 border-2", config.border, config.bg)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className={cn("p-3 rounded-xl", config.bg, config.color)}>
            <StatusIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">How This Compares</h3>
            <p className="text-sm text-muted-foreground max-w-md">{message}</p>
          </div>
        </div>
        <Badge className={cn("shrink-0 text-sm px-3 py-1", config.bg, config.color)}>{config.label}</Badge>
      </div>

      {/* Benchmark Statements */}
      <div className="space-y-3 mb-6 p-4 rounded-lg bg-background/60 border border-border/30">
        <p className="text-base text-foreground">{benchmarkStatement}</p>
        {comparisonSentence && <p className="text-base font-medium text-foreground">{comparisonSentence}</p>}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{confidenceQualifier}</span>
          {output.metadata.localityUsed === "local_adjusted" && (
            <Badge variant="outline" className="text-[10px] bg-success/10 border-success/30 text-success">
              Location-adjusted
            </Badge>
          )}
        </div>

        {/* Year Fallback Disclosure */}
        {yearFallbackDisclosure && (
          <div className="mt-3 p-3 rounded bg-warning/10 border border-warning/20">
            <p className="text-sm text-warning-foreground flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              {yearFallbackDisclosure}
            </p>
          </div>
        )}
      </div>

      {/* Patient Balance Warning - Never compare patient balance to Medicare as "your bill is X× Medicare" */}
      {isPatientBalanceComparison && (
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Limited Comparison</p>
              <p className="text-xs text-muted-foreground">
                Only a patient balance was detected on this document (not total charges). Medicare reference prices are
                based on full service pricing before insurance. Comparing your remaining balance to Medicare rates isn't
                meaningful since insurance has already adjusted and paid a portion.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scope Warning Banner (if mismatch detected) */}
      {output.matchedItemsComparison.scopeWarning && !isPatientBalanceComparison && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Comparison Scope Note</p>
              <p className="text-xs text-muted-foreground">{output.matchedItemsComparison.scopeWarning}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid - Use matched-items comparison when valid, skip if patient balance only */}
      {!isPatientBalanceComparison && (
        <div className="space-y-4 mb-6">
          {/* NEW: Clear "What We Compared" explanation */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">What We Compared</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {output.matchedItemsComparison.isValidComparison
                ? `We compared the billed amounts for ${output.matchedItemsComparison.matchedItemsCount} items that we could match to Medicare pricing (${output.matchedItemsComparison.coveragePercent}% of detected items). This ensures an apples-to-apples comparison.`
                : output.totals.billedTotal && output.totals.billedTotal > 0
                  ? `Total charges detected (${formatCurrency(output.totals.billedTotal)}) include items we couldn't match to Medicare pricing, so the multiple may not be fully accurate.`
                  : "We couldn't detect enough billed amounts to compute a meaningful comparison."}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-background/60 border border-border/30">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                {output.matchedItemsComparison.isValidComparison ? `Matched Charges` : comparisonTotalLabel}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {output.matchedItemsComparison.isValidComparison
                  ? formatCurrency(output.matchedItemsComparison.matchedBilledTotal!)
                  : output.totals.billedTotal
                    ? formatCurrency(output.totals.billedTotal)
                    : "—"}
              </p>
              {output.matchedItemsComparison.isValidComparison && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {output.matchedItemsComparison.matchedItemsCount}/{output.matchedItemsComparison.totalItemsCount}{" "}
                  items
                </p>
              )}
            </div>
            <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Medicare Reference</p>
              <p className="text-2xl font-bold text-primary">
                {output.matchedItemsComparison.matchedMedicareTotal
                  ? formatCurrency(output.matchedItemsComparison.matchedMedicareTotal)
                  : output.totals.medicareReferenceTotal
                    ? formatCurrency(output.totals.medicareReferenceTotal)
                    : "N/A"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{output.metadata.benchmarkYearUsed} rates</p>
            </div>
            <div
              className={cn(
                "text-center p-4 rounded-xl border",
                output.matchedItemsComparison.isValidComparison
                  ? "bg-background/60 border-border/30"
                  : "bg-warning/5 border-warning/20",
              )}
            >
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                {output.matchedItemsComparison.isValidComparison ? "Multiple" : "Estimated"}
              </p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  output.matchedItemsComparison.isValidComparison ? config.color : "text-warning",
                )}
              >
                {output.matchedItemsComparison.isValidComparison && output.matchedItemsComparison.matchedItemsMultiple
                  ? `${output.matchedItemsComparison.matchedItemsMultiple}×`
                  : output.totals.multipleOfMedicare
                    ? `${output.totals.multipleOfMedicare}×`
                    : "N/A"}
              </p>
              {!output.matchedItemsComparison.isValidComparison && output.totals.multipleOfMedicare && (
                <p className="text-[10px] text-warning mt-1">⚠ Scope mismatch</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Flagged Items & Potential Savings */}
      <div className="flex items-center justify-between pt-4 border-t border-border/30">
        {output.matchedItemsComparison.isValidComparison &&
        output.matchedItemsComparison.matchedItemsMultiple &&
        output.matchedItemsComparison.matchedItemsMultiple > 1.5 &&
        output.matchedItemsComparison.matchedMedicareTotal ? (
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-success" />
            <span className="text-sm">
              <span className="font-semibold text-success">
                Potential savings:{" "}
                {formatCurrency(
                  output.matchedItemsComparison.matchedBilledTotal! -
                    output.matchedItemsComparison.matchedMedicareTotal * 1.5,
                )}
              </span>
              <span className="text-muted-foreground ml-1">if negotiated to 150% of reference (matched items)</span>
            </span>
          </div>
        ) : output.matchedItemsComparison.isValidComparison ? (
          <span className="text-sm text-muted-foreground">
            Matched charges appear reasonable relative to Medicare reference
          </span>
        ) : (
          <span className="text-sm text-warning flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            Limited comparison — some items not matched
          </span>
        )}

        {flaggedCount > 0 && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            {flaggedCount} item{flaggedCount > 1 ? "s" : ""} to review
          </Badge>
        )}
      </div>
    </Card>
  );
}

/**
 * Estimate commercial rate from Medicare reference or provide fallback messaging
 */
function getCommercialEstimate(
  billedAmount: number,
  reason: string | null,
): {
  lowEstimate: number;
  highEstimate: number;
  explanation: string;
} | null {
  // For bundled/packaged services, we can't provide a meaningful estimate
  if (reason === "packaged" || reason === "bundled") {
    return null;
  }

  // Use the billed amount to estimate if commercial rate is reasonable
  // Commercial rates are typically 150-300% of Medicare
  // If we had Medicare rate, we could compare. Without it, just note the billing context.
  return {
    lowEstimate: billedAmount * 0.4, // Lower bound estimate (if billed at 250% of Medicare)
    highEstimate: billedAmount * 0.67, // Upper bound estimate (if billed at 150% of Medicare)
    explanation: "Typical commercial insurance pays 150-300% of Medicare rates for similar services",
  };
}

/**
 * Section for codes that exist in MPFS but have no payable Medicare amount
 * Now with commercial rate fallback estimates
 */
function CodesExistsNotPricedSection({ items }: { items: BenchmarkLineResult[] }) {
  const existsNotPricedItems = items.filter((i) => i.matchStatus === "exists_not_priced");
  if (existsNotPricedItems.length === 0) return null;

  const getReasonLabel = (reason: string | null): string => {
    switch (reason) {
      case "rvus_zero_or_missing":
        return "Carrier-priced";
      case "fees_missing":
        return "No fee schedule";
      case "status_indicator_nonpayable":
        return "Bundled/Add-on";
      case "packaged":
        return "Packaged (OPPS)";
      default:
        return "No reference";
    }
  };

  const getReasonExplanation = (reason: string | null): string => {
    switch (reason) {
      case "rvus_zero_or_missing":
        return "Payment set by individual insurance carriers, not Medicare";
      case "fees_missing":
        return "Lab/pathology test - typically priced through CLFS or private contracts";
      case "status_indicator_nonpayable":
        return "Usually billed with a primary service; Medicare bundles payment";
      case "packaged":
        return "Payment included in facility fee under OPPS";
      default:
        return "No separate Medicare benchmark available";
    }
  };

  // Calculate totals for non-priced items
  const totalBilledNonPriced = existsNotPricedItems.reduce((sum, item) => sum + (item.billedAmount || 0), 0);

  return (
    <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
      {/* Compact Header */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {existsNotPricedItems.length} service{existsNotPricedItems.length > 1 ? "s" : ""} without benchmark reference
          </span>
        </div>
        {totalBilledNonPriced > 0 && (
          <span className="text-sm text-muted-foreground">{formatCurrency(totalBilledNonPriced)} billed</span>
        )}
      </div>

      {/* Compact Table */}
      <div className="divide-y divide-border/30">
        {existsNotPricedItems.slice(0, 6).map((item) => {
          const estimate = item.billedAmount ? getCommercialEstimate(item.billedAmount, item.notPricedReason) : null;

          return (
            <div
              key={item.hcpcs}
              className="px-4 py-2.5 flex items-center gap-4 text-sm hover:bg-muted/20 transition-colors"
            >
              {/* Code */}
              <code className="font-mono text-xs bg-muted/50 px-2 py-0.5 rounded w-16 text-center shrink-0">
                {item.hcpcs}
              </code>

              {/* Description */}
              <div className="flex-1 min-w-0">
                <p className="text-foreground truncate text-sm">{item.description || "Medical service"}</p>
                <p className="text-xs text-muted-foreground">{getReasonExplanation(item.notPricedReason)}</p>
              </div>

              {/* Billed Amount */}
              <div className="text-right shrink-0 w-20">
                <p className="font-medium">{item.billedAmount ? formatCurrency(item.billedAmount) : "—"}</p>
              </div>

              {/* Status Badge - more subtle */}
              <Badge
                variant="outline"
                className="text-[10px] shrink-0 bg-muted/30 text-muted-foreground border-border/50"
              >
                {getReasonLabel(item.notPricedReason)}
              </Badge>
            </div>
          );
        })}

        {existsNotPricedItems.length > 6 && (
          <div className="px-4 py-2 text-xs text-muted-foreground text-center bg-muted/10">
            +{existsNotPricedItems.length - 6} more services
          </div>
        )}
      </div>

      {/* Compact Footer with context */}
      <div className="px-4 py-2.5 bg-muted/20 border-t border-border/30">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Note:</strong> These services exist in CMS databases but don't have separate payment rates.
          Commercial insurance typically pays <span className="font-medium">150-300%</span> of benchmark for similar
          services.
        </p>
      </div>
    </div>
  );
}

/**
 * Section for codes that do NOT exist in any Medicare dataset
 * Now uses UnmatchedCodesCard with external description lookup
 */
function CodesMissingSection({ codes }: { codes: string[] }) {
  if (codes.length === 0) return null;

  // Use the new UnmatchedCodesCard which fetches descriptions from NLM
  return <UnmatchedCodesCard unmatchedCodes={codes} />;
}

function EducationalFooter() {
  return (
    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
      <p className="text-sm text-muted-foreground leading-relaxed">
        <strong className="text-foreground">About these comparisons:</strong> Benchmark reference prices are set by the
        federal government (CMS) and are used by insurers, employers, and courts as the foundation for healthcare pricing. Commercial insurance
        typically pays 150-300% of benchmark rates. These comparisons help you understand your charges in context — not
        what you "should" pay, but how they relate to a widely-used reference point for negotiation.
      </p>
    </div>
  );
}

// ============= Empty State Components =============

function NoCodesEmptyState({
  reverseSearchTriggered,
  reverseSearchResults,
}: {
  reverseSearchTriggered: boolean;
  reverseSearchResults?: DebugCalculationData["reverseSearchResults"];
}) {
  return (
    <div className="p-6 rounded-xl bg-muted/20 border border-border/30">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-muted/30">
          <FileQuestion className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-base font-medium text-foreground mb-2">No CPT/HCPCS codes detected</p>
          <p className="text-sm text-muted-foreground mb-3">
            We couldn't detect any CPT or HCPCS codes in this bill, so we can't compute benchmark comparisons yet. This
            might happen if:
          </p>
          <ul className="text-sm text-muted-foreground list-disc ml-4 mb-4 space-y-1">
            <li>The bill image is blurry or partially cut off</li>
            <li>This is a summary bill without itemized procedure codes</li>
            <li>The codes are in a format we don't recognize yet</li>
          </ul>

          {/* Reverse search status */}
          {reverseSearchTriggered && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Reverse Search Attempted</span>
              </div>
              {reverseSearchResults && reverseSearchResults.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Inferred codes from service descriptions:</p>
                  <div className="flex flex-wrap gap-1">
                    {reverseSearchResults.map((r, i) => (
                      <Badge key={i} variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                        {r.matchedCode} <span className="text-[10px] opacity-70">({(r.score * 100).toFixed(0)}%)</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No matching codes found from service descriptions.</p>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            <strong>Try:</strong> Uploading a clearer image or a more detailed itemized statement.
          </p>
        </div>
      </div>
    </div>
  );
}

function NoMatchesEmptyState({ output, rawCodes }: { output: MedicareBenchmarkOutput; rawCodes: string[] }) {
  const sampleCodes = output.debug.normalizedCodes
    .filter((c) => isValidBillableCode(c))
    .slice(0, 8)
    .map((c) => c.hcpcs);

  const allUnmatchedCodes = output.debug.normalizedCodes.filter((c) => isValidBillableCode(c)).map((c) => c.hcpcs);

  return (
    <div className="space-y-4">
      <div className="p-6 rounded-xl bg-muted/20 border border-border/30">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-warning/10">
            <Search className="h-6 w-6 text-warning" />
          </div>
          <div>
            <p className="text-base font-medium text-foreground mb-2">Codes detected, but no benchmark matches found</p>
            <p className="text-sm text-muted-foreground mb-3">
              CPT/HCPCS codes were detected, but we couldn't find benchmark reference pricing for them in our current
              dataset.
            </p>

            <div className="text-sm text-muted-foreground space-y-1 mb-4">
              <p>
                <strong>Year requested:</strong> {output.metadata.requestedYears.join(", ") || "Unknown"}
              </p>
              <p>
                <strong>Year searched:</strong> {output.metadata.benchmarkYearUsed}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              <strong>Possible reasons:</strong> These may be newer codes, DME codes, private payer codes (S-codes), or
              services outside the standard fee schedules.
            </p>
          </div>
        </div>
      </div>

      {/* Show unmatched codes with descriptions fetched from NLM */}
      {allUnmatchedCodes.length > 0 && <UnmatchedCodesCard unmatchedCodes={allUnmatchedCodes} />}
    </div>
  );
}

// ============= Main Component =============

export function HowThisCompares({ analysis, state, zipCode, careSetting = "office" }: HowThisComparesProps) {
  const [output, setOutput] = useState<MedicareBenchmarkOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllItems, setShowAllItems] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [rawCodes, setRawCodes] = useState<string[]>([]);
  const [serviceDate, setServiceDate] = useState<string | null>(null);
  const [rejectedTokens, setRejectedTokens] = useState<RejectedToken[]>([]);
  const [reverseSearchTriggered, setReverseSearchTriggered] = useState(false);
  const [reverseSearchReason, setReverseSearchReason] = useState<string | undefined>();
  const [reverseSearchResults, setReverseSearchResults] = useState<DebugCalculationData["reverseSearchResults"]>([]);
  const [totalsReconciliation, setTotalsReconciliation] = useState<TotalsReconciliation | null>(null);
  const [structuredTotals, setStructuredTotals] = useState<StructuredTotals | null>(null);
  const [readinessResult, setReadinessResult] = useState<ReadinessResult | null>(null);
  const [billTypeResult, setBillTypeResult] = useState<BillTypeResult | null>(null);

  // Check OPPS data availability on mount
  useEffect(() => {
    const checkOppsData = async () => {
      const { count, error } = await supabase.from("opps_addendum_b").select("*", { count: "exact", head: true });
      console.log(`[OPPS Check] Table has ${count} rows. Error: ${error?.message || "none"}`);
      if (count === 0 || count === null) {
        console.warn("[OPPS Check] WARNING: opps_addendum_b table is EMPTY! OPPS rates will not work.");
      }
    };
    checkOppsData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchBenchmarks() {
      setLoading(true);
      setError(null);
      setReverseSearchTriggered(false);
      setReverseSearchReason(undefined);
      setReverseSearchResults([]);

      try {
        // Extract service date
        const extractedDate = extractServiceDate(analysis);
        setServiceDate(extractedDate);

        // Reconcile totals from analysis
        const reconciledTotals = reconcileTotals(analysis);
        setTotalsReconciliation(reconciledTotals);

        // Extract line items with improved logic and strict validation
        const { items: lineItems, rawCodes: extractedRawCodes, rejectedTokens: rejected } = extractLineItems(analysis);
        setRawCodes(extractedRawCodes);
        setRejectedTokens(rejected);

        console.log("[HowThisCompares] Extracted line items:", lineItems.length);
        console.log("[HowThisCompares] Raw codes found:", extractedRawCodes);
        console.log("[HowThisCompares] Rejected tokens:", rejected);
        console.log("[HowThisCompares] Service date:", extractedDate);

        let finalLineItems = lineItems;

        // === REVERSE SEARCH LOGIC ===
        // ONLY trigger reverse search when we have ZERO valid codes
        // DO NOT override valid codes from analysis.charges with inferred codes
        const needsReverseSearch = lineItems.length === 0;

        if (needsReverseSearch) {
          console.log("[HowThisCompares] No codes found, triggering reverse search...");
          setReverseSearchTriggered(true);
          setReverseSearchReason("No valid CPT/HCPCS codes detected");

          // Extract service descriptions from charges
          const descriptions: string[] = [];
          if (analysis.charges) {
            for (const charge of analysis.charges) {
              if (charge.description && charge.description.length > 8) {
                descriptions.push(charge.description);
              }
            }
          }

          // Also extract from chargeMeanings
          if (analysis.chargeMeanings) {
            for (const cm of analysis.chargeMeanings) {
              if (cm.procedureName && cm.procedureName.length > 8) {
                descriptions.push(cm.procedureName);
              }
            }
          }

          if (descriptions.length > 0) {
            // Perform batch reverse search
            const reverseResults = await batchReverseSearch(descriptions.slice(0, 10));

            // Collect inferred codes
            const inferredCodes: BenchmarkLineItem[] = [];
            const searchResultsForDebug: DebugCalculationData["reverseSearchResults"] = [];

            for (const result of reverseResults) {
              if (result.primaryCandidate && result.primaryCandidate.confidence !== "low") {
                inferredCodes.push({
                  hcpcs: result.primaryCandidate.hcpcs,
                  description: result.sourceText,
                  billedAmount: 0, // Inferred codes don't have amounts
                  units: 1,
                });

                searchResultsForDebug.push({
                  description: result.sourceText.substring(0, 50),
                  matchedCode: result.primaryCandidate.hcpcs,
                  score: result.primaryCandidate.score,
                  source: result.searchMethod,
                });
              }
            }

            setReverseSearchResults(searchResultsForDebug);

            // Use inferred codes ONLY if we had no codes to begin with
            if (inferredCodes.length > 0) {
              console.log("[HowThisCompares] Reverse search found:", inferredCodes.length, "codes");
              finalLineItems = inferredCodes;
            }
          }
        } else {
          console.log("[HowThisCompares] Using", lineItems.length, "codes from analysis.charges");
        }

        // Detect bill type based on codes and location
        const extractedCodes = finalLineItems.map((item) => item.hcpcs);
        const detectedBillType = detectBillType(
          extractedCodes,
          analysis.issuer || (analysis as any).providerName || '',
          undefined,
          undefined,
          (analysis as any).rawText
        );
        setBillTypeResult(detectedBillType);
        console.log("[HowThisCompares] Bill type detected:", detectedBillType);

        // Apply service date and facility flag based on detected bill type
        const itemsWithDate = finalLineItems.map((item) => ({
          ...item,
          dateOfService: item.dateOfService || extractedDate || undefined,
          isFacility: detectedBillType.recommendedFeeSchedule === 'OPPS' || careSetting === "facility" ? true : item.isFacility,
        }));

        const result = await calculateMedicareBenchmarks(itemsWithDate, state, zipCode);

        console.log("[HowThisCompares] Benchmark result:", result.status);
        console.log("[HowThisCompares] Debug info:", result.debug);

        // Compute structured totals from analysis for readiness gate
        const lineItemsForTotals = itemsWithDate.map((item) => ({
          description: item.description,
          billedAmount: item.billedAmount,
          code: item.hcpcs,
          units: item.units,
        }));
        // Use reconciled totals as input to normalize, or empty object if not available
        const rawTotalsFromReconciliation = reconciledTotals?.comparisonTotal
          ? {
              totalCharges:
                reconciledTotals.comparisonTotal.type === "charges"
                  ? {
                      value: reconciledTotals.comparisonTotal.value,
                      confidence: reconciledTotals.comparisonTotal.confidence,
                      evidence: reconciledTotals.comparisonTotal.explanation,
                      label: "Total Charges",
                    }
                  : undefined,
              patientResponsibility:
                reconciledTotals.comparisonTotal.type === "patient_responsibility"
                  ? {
                      value: reconciledTotals.comparisonTotal.value,
                      confidence: reconciledTotals.comparisonTotal.confidence,
                      evidence: reconciledTotals.comparisonTotal.explanation,
                      label: "Patient Responsibility",
                    }
                  : undefined,
            }
          : {};
        const derivedTotals = normalizeAndDeriveTotals(rawTotalsFromReconciliation, lineItemsForTotals);

        // Compute comparison readiness using the gate
        const readiness = computeComparisonReadiness(result, derivedTotals);
        console.log("[HowThisCompares] Readiness result:", readiness.status, readiness.reasons);

        if (!cancelled) {
          setOutput(result);
          setStructuredTotals(derivedTotals);
          setReadinessResult(readiness);
        }
      } catch (err) {
        console.error("[HowThisCompares] Benchmark error:", err);
        if (!cancelled) {
          setError("Unable to load benchmark comparison data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (state) {
      fetchBenchmarks();
    } else {
      setLoading(false);
      setError("Select a state to see benchmark comparisons");
    }

    return () => {
      cancelled = true;
    };
  }, [analysis, state, zipCode, careSetting]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !output) {
    return (
      <div className="p-6 rounded-xl bg-muted/20 border border-border/30 text-center">
        <HelpCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  // No output at all
  if (!output) {
    return (
      <div className="p-6 rounded-xl bg-muted/20 border border-border/30 text-center">
        <HelpCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Benchmark comparison not available</p>
      </div>
    );
  }

  // === DISTINCT EMPTY STATES ===

  // State 1: NO codes extracted at all
  if (output.status === "no_codes") {
    return (
      <div className="space-y-4">
        <NoCodesEmptyState
          reverseSearchTriggered={reverseSearchTriggered}
          reverseSearchResults={reverseSearchResults}
        />

        {/* Debug toggle */}
        <div className="flex items-center gap-2">
          <Switch id="debug-mode" checked={showDebug} onCheckedChange={setShowDebug} />
          <Label htmlFor="debug-mode" className="text-xs text-muted-foreground">
            Show debug info
          </Label>
        </div>

        {showDebug && (
          <DebugPanel output={output} rawCodes={rawCodes} serviceDate={serviceDate} state={state} zipCode={zipCode} />
        )}
      </div>
    );
  }

  // State 2: Codes extracted but NO MPFS matches
  if (output.status === "no_matches") {
    return (
      <div className="space-y-4">
        <NoMatchesEmptyState output={output} rawCodes={rawCodes} />
        <EducationalFooter />

        {/* Debug toggle */}
        <div className="flex items-center gap-2">
          <Switch id="debug-mode" checked={showDebug} onCheckedChange={setShowDebug} />
          <Label htmlFor="debug-mode" className="text-xs text-muted-foreground">
            Show debug info
          </Label>
        </div>

        {showDebug && (
          <DebugPanel output={output} rawCodes={rawCodes} serviceDate={serviceDate} state={state} zipCode={zipCode} />
        )}
      </div>
    );
  }

  // State 3 & 4: We have SOME or ALL matches - show the comparison

  // Determine how many items to show
  const displayItems = showAllItems ? output.lineItems : output.lineItems.slice(0, 5);

  // Extract insurance paid and patient responsibility from totals reconciliation
  const insurancePaid = totalsReconciliation?.structuredTotals?.insurancePaid?.value ?? null;
  const patientResponsibility =
    totalsReconciliation?.comparisonTotal?.type === "patient_responsibility"
      ? totalsReconciliation.comparisonTotal.value
      : (totalsReconciliation?.structuredTotals?.patientResponsibility?.value ?? null);

  return (
    <div className="space-y-6">
      {/* Bill Totals Grid - New 2-row layout with dynamic bill type message */}
      <BillTotalsGrid
        totalBilled={output.totals.billedTotal || null}
        insurancePaid={insurancePaid}
        youMayOwe={patientResponsibility}
        matchedCharges={output.matchedItemsComparison.matchedBilledTotal || 0}
        medicareReference={output.matchedItemsComparison.matchedMedicareTotal || 0}
        matchedCount={output.matchedItemsComparison.matchedItemsCount || 0}
        totalCount={output.matchedItemsComparison.totalItemsCount || output.lineItems.length}
        careSetting={billTypeResult?.recommendedFeeSchedule === 'OPPS' ? 'facility' : careSetting}
        billTypeMessage={billTypeResult?.message}
      />

      {/* Payment Flow Section - Shows HOW bills actually get paid */}
      <PaymentFlowSection
        chargemasterTotal={output.matchedItemsComparison.matchedBilledTotal || output.totals.billedTotal || 0}
        benchmarkTotal={output.matchedItemsComparison.matchedMedicareTotal || 0}
      />

      {/* Service Details Table - Default collapsed, full descriptions, status column */}
      <ServiceDetailsTable
        lineItems={output.lineItems}
        chargeMeanings={analysis.chargeMeanings}
        defaultExpanded={false}
      />

      {/* Negotiability by Category - NEW */}
      <NegotiabilityCategorySection lineItems={output.lineItems} />

      {/* Commonly Asked Questions - NEW */}
      <CommonlyAskedQuestionsSection lineItems={output.lineItems} />

      {/* Educational Footer */}
      <EducationalFooter />

      {/* Debug toggle */}
      <div className="flex items-center gap-2">
        <Switch id="debug-mode" checked={showDebug} onCheckedChange={setShowDebug} />
        <Label htmlFor="debug-mode" className="text-xs text-muted-foreground">
          Show benchmark debug info
        </Label>
      </div>

      {showDebug && (
        <DebugPanel output={output} rawCodes={rawCodes} serviceDate={serviceDate} state={state} zipCode={zipCode} />
      )}
    </div>
  );
}
