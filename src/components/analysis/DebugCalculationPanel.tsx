/**
 * Debug Calculation Panel
 *
 * Visual, expandable debug panel showing step-by-step:
 * 1. Location Resolution (ZIP → Locality → GPCI)
 * 2. Code Detection (extracted, rejected, reverse search)
 * 3. Billed Amount Extraction (totals candidates, selection)
 * 4. Medicare Reference Calculation (per code breakdown)
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAmount, formatMultiple } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Code,
  DollarSign,
  Calculator,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Search,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MedicareBenchmarkOutput, GeoDebugInfo } from "@/lib/medicareBenchmarkService";
import { RejectedToken } from "@/lib/cptCodeValidator";
import { TotalsReconciliation, TotalCandidate } from "@/lib/totalsExtractor";

// ============= Types =============

export interface CalculationChainStep {
  step: number;
  label: string;
  status: "success" | "warning" | "error" | "info";
  value?: string;
  details?: string;
}

export interface DebugCalculationData {
  // Location resolution
  geoDebug?: GeoDebugInfo;

  // Code detection
  rawCodesExtracted: string[];
  validCodes: string[];
  rejectedTokens: RejectedToken[];
  reverseSearchTriggered: boolean;
  reverseSearchReason?: string;
  reverseSearchResults?: {
    description: string;
    matchedCode: string;
    score: number;
    source: string;
  }[];

  // Billed amounts
  totalsReconciliation?: TotalsReconciliation;
  comparisonTotalType?: string;
  comparisonTotalValue?: number;
  comparisonTotalExplanation?: string;

  // Medicare calculation
  benchmarkOutput?: MedicareBenchmarkOutput;

  // Calculation chain (NEW - compact summary)
  calculationChain?: CalculationChainStep[];
}

interface DebugCalculationPanelProps {
  data: DebugCalculationData;
}

// ============= Sub-Components =============

function SectionHeader({
  title,
  icon,
  status,
  expanded,
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  status?: "success" | "warning" | "error" | "info";
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusColors = {
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    error: "text-destructive bg-destructive/10",
    info: "text-primary bg-primary/10",
  };

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors rounded-lg"
    >
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", status ? statusColors[status] : "bg-muted")}>{icon}</div>
        <span className="font-medium text-sm">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {status && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              status === "success" && "bg-success/10 text-success border-success/30",
              status === "warning" && "bg-warning/10 text-warning border-warning/30",
              status === "error" && "bg-destructive/10 text-destructive border-destructive/30",
              status === "info" && "bg-primary/10 text-primary border-primary/30",
            )}
          >
            {status === "success" ? "OK" : status === "warning" ? "Partial" : status === "error" ? "Issue" : "Info"}
          </Badge>
        )}
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </div>
    </button>
  );
}

function LocationResolutionSection({ geoDebug }: { geoDebug?: GeoDebugInfo }) {
  if (!geoDebug) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No location data available. Provide a ZIP code for location-adjusted pricing.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Flow visualization */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1">
          <span className="text-muted-foreground">Input:</span>
          {geoDebug.zipInput || geoDebug.stateInput || "None"}
        </Badge>
        <span className="text-muted-foreground">→</span>
        <Badge
          variant="outline"
          className={cn(
            geoDebug.localityFound
              ? "bg-success/10 text-success border-success/30"
              : "bg-warning/10 text-warning border-warning/30",
          )}
        >
          {geoDebug.method === "zip_exact"
            ? "Exact Locality"
            : geoDebug.method === "zip_to_state_avg"
              ? "State Avg (from ZIP)"
              : geoDebug.method === "state_avg"
                ? "State Average"
                : "National Default"}
        </Badge>
        <span className="text-muted-foreground">→</span>
        <Badge variant="outline">GPCI Applied: {geoDebug.localityFound ? "Yes" : "No"}</Badge>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded bg-muted/30">
          <div className="text-muted-foreground">ZIP Input</div>
          <div className="font-mono">{geoDebug.zipInput || "—"}</div>
        </div>
        <div className="p-2 rounded bg-muted/30">
          <div className="text-muted-foreground">State</div>
          <div className="font-mono">{geoDebug.stateInput || "—"}</div>
        </div>
        <div className="p-2 rounded bg-muted/30">
          <div className="text-muted-foreground">Locality</div>
          <div className="font-mono">{geoDebug.localityName || "—"}</div>
        </div>
        <div className="p-2 rounded bg-muted/30">
          <div className="text-muted-foreground">Confidence</div>
          <div
            className={cn(
              "font-semibold",
              geoDebug.confidence === "high"
                ? "text-success"
                : geoDebug.confidence === "medium"
                  ? "text-warning"
                  : "text-muted-foreground",
            )}
          >
            {geoDebug.confidence}
          </div>
        </div>
      </div>

      {/* GPCI indices if available */}
      {geoDebug.localityFound && (
        <div className="p-3 rounded-lg bg-success/5 border border-success/20">
          <div className="text-xs text-muted-foreground mb-2">GPCI Indices Applied:</div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold">{geoDebug.workGpci?.toFixed(3) || "1.000"}</div>
              <div className="text-xs text-muted-foreground">Work</div>
            </div>
            <div>
              <div className="text-lg font-semibold">{geoDebug.peGpci?.toFixed(3) || "1.000"}</div>
              <div className="text-xs text-muted-foreground">PE</div>
            </div>
            <div>
              <div className="text-lg font-semibold">{geoDebug.mpGpci?.toFixed(3) || "1.000"}</div>
              <div className="text-xs text-muted-foreground">MP</div>
            </div>
          </div>
        </div>
      )}

      {/* User message */}
      <div className="text-xs text-muted-foreground italic">{geoDebug.messageToUser}</div>
    </div>
  );
}

function CodeDetectionSection({
  rawCodes,
  validCodes,
  rejectedTokens,
  reverseSearchTriggered,
  reverseSearchReason,
  reverseSearchResults,
}: {
  rawCodes: string[];
  validCodes: string[];
  rejectedTokens: RejectedToken[];
  reverseSearchTriggered: boolean;
  reverseSearchReason?: string;
  reverseSearchResults?: DebugCalculationData["reverseSearchResults"];
}) {
  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Code counts */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="bg-muted/30">
          {rawCodes.length} tokens found
        </Badge>
        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
          {validCodes.length} valid codes
        </Badge>
        {rejectedTokens.length > 0 && (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            {rejectedTokens.length} rejected
          </Badge>
        )}
      </div>

      {/* Valid codes */}
      {validCodes.length > 0 && (
        <div className="p-3 rounded-lg bg-success/5 border border-success/20">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Valid CPT/HCPCS Codes
          </div>
          <div className="flex flex-wrap gap-1">
            {validCodes.map((code, i) => (
              <code key={i} className="px-2 py-1 rounded bg-success/10 text-success text-xs font-mono">
                {code}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Rejected tokens */}
      {rejectedTokens.length > 0 && (
        <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Rejected Tokens (not valid codes)
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {rejectedTokens.slice(0, 10).map((token, i) => (
              <div key={i} className="flex justify-between text-xs">
                <code className="font-mono text-warning">{token.token}</code>
                <span className="text-muted-foreground truncate ml-2">{token.reason}</span>
              </div>
            ))}
            {rejectedTokens.length > 10 && (
              <div className="text-xs text-muted-foreground">+{rejectedTokens.length - 10} more...</div>
            )}
          </div>
        </div>
      )}

      {/* Reverse search */}
      <div
        className={cn(
          "p-3 rounded-lg border",
          reverseSearchTriggered ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border/30",
        )}
      >
        <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
          <Search className="h-3 w-3" />
          Reverse Search (code inference from descriptions)
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(reverseSearchTriggered ? "bg-primary/10 text-primary border-primary/30" : "bg-muted/50")}
          >
            {reverseSearchTriggered ? "Triggered" : "Not triggered"}
          </Badge>
          {reverseSearchReason && <span className="text-xs text-muted-foreground">{reverseSearchReason}</span>}
        </div>

        {reverseSearchTriggered && reverseSearchResults && reverseSearchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-muted-foreground">Inferred codes:</div>
            {reverseSearchResults.map((result, i) => (
              <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-background/50">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-primary">{result.matchedCode}</code>
                  <span className="text-muted-foreground truncate max-w-40">{result.description}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {result.source}
                  </Badge>
                  <span className="text-muted-foreground">{(result.score * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BilledAmountsSection({
  totalsReconciliation,
  comparisonTotalType,
  comparisonTotalValue,
  comparisonTotalExplanation,
}: {
  totalsReconciliation?: TotalsReconciliation;
  comparisonTotalType?: string;
  comparisonTotalValue?: number;
  comparisonTotalExplanation?: string;
}) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Document type */}
      {totalsReconciliation && (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Document type:</span>
          <Badge variant="outline">{totalsReconciliation.documentType || "unknown"}</Badge>
        </div>
      )}

      {/* Chosen comparison total */}
      <div
        className={cn(
          "p-3 rounded-lg border",
          comparisonTotalValue && comparisonTotalValue > 0
            ? "bg-success/5 border-success/20"
            : "bg-warning/5 border-warning/20",
        )}
      >
        <div className="text-xs text-muted-foreground mb-2">Comparison Total Selected:</div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold">
              {comparisonTotalValue ? formatCurrency(comparisonTotalValue) : "$0"}
            </span>
            <Badge variant="outline" className="ml-2 text-xs">
              {comparisonTotalType || "unknown"}
            </Badge>
          </div>
        </div>
        {comparisonTotalExplanation && (
          <p className="text-xs text-muted-foreground mt-2">{comparisonTotalExplanation}</p>
        )}
      </div>

      {/* Candidates breakdown */}
      {totalsReconciliation && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">All candidates detected:</div>

          {/* Charges candidates */}
          {totalsReconciliation.chargesCandidates.length > 0 && (
            <CandidateList title="Charges" candidates={totalsReconciliation.chargesCandidates} />
          )}

          {/* Allowed candidates */}
          {totalsReconciliation.allowedCandidates.length > 0 && (
            <CandidateList title="Allowed" candidates={totalsReconciliation.allowedCandidates} />
          )}

          {/* Patient responsibility candidates */}
          {totalsReconciliation.patientCandidates.length > 0 && (
            <CandidateList title="Patient Responsibility" candidates={totalsReconciliation.patientCandidates} />
          )}

          {totalsReconciliation.chargesCandidates.length === 0 &&
            totalsReconciliation.allowedCandidates.length === 0 &&
            totalsReconciliation.patientCandidates.length === 0 && (
              <div className="text-xs text-warning p-2 rounded bg-warning/5">
                No amount candidates detected from document
              </div>
            )}
        </div>
      )}

      {/* Line items sum */}
      {totalsReconciliation && totalsReconciliation.lineItems.length > 0 && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="text-xs text-muted-foreground mb-2">Line Items:</div>
          <div className="flex items-center justify-between">
            <span>{totalsReconciliation.lineItems.length} items detected</span>
            <span className="font-mono">Sum: {formatCurrency(totalsReconciliation.sumLineCharges)}</span>
          </div>
          {totalsReconciliation.reconciliationNote && (
            <p className="text-xs text-muted-foreground mt-2">{totalsReconciliation.reconciliationNote}</p>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateList({ title, candidates }: { title: string; candidates: TotalCandidate[] }) {
  return (
    <div className="p-2 rounded bg-muted/20 text-xs">
      <div className="font-medium mb-1">{title}:</div>
      {candidates.map((c, i) => (
        <div key={i} className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">{c.label}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono">${c.amount.toFixed(2)}</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                c.confidence === "high"
                  ? "text-success border-success/30"
                  : c.confidence === "medium"
                    ? "text-warning border-warning/30"
                    : "",
              )}
            >
              {c.confidence}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function MedicareCalculationSection({ output }: { output?: MedicareBenchmarkOutput }) {
  if (!output) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Benchmark not calculated. Need valid CPT/HCPCS codes and state selection.
      </div>
    );
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

  const pricedItems = output.lineItems.filter((i) => i.matchStatus === "matched");
  const notPricedItems = output.lineItems.filter((i) => i.matchStatus === "exists_not_priced");
  const missingItems = output.lineItems.filter((i) => i.matchStatus === "missing");

  // Get matched-items comparison data
  const matched = output.matchedItemsComparison;

  return (
    <div className="p-4 space-y-4 text-sm">
      {/* === NEW: Matched-Items Comparison (prevents scope mismatch) === */}
      {matched && matched.matchedItemsCount > 0 && (
        <div
          className={cn(
            "p-4 rounded-lg border-2",
            matched.isValidComparison ? "border-primary/40 bg-primary/5" : "border-warning/40 bg-warning/5",
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Matched Items Comparison
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                matched.isValidComparison
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-warning/10 text-warning border-warning/30",
              )}
            >
              {matched.matchedItemsCount}/{matched.totalItemsCount} items matched
            </Badge>
          </div>

          {/* Visual scope coverage bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Scope coverage</span>
              <span>{matched.coveragePercent ? `${Math.round(matched.coveragePercent * 100)}%` : "—"}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  matched.coveragePercent && matched.coveragePercent >= 0.8
                    ? "bg-success"
                    : matched.coveragePercent && matched.coveragePercent >= 0.5
                      ? "bg-warning"
                      : "bg-destructive",
                )}
                style={{ width: `${(matched.coveragePercent || 0) * 100}%` }}
              />
            </div>
          </div>

          {/* Matched totals comparison */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="p-3 rounded-lg bg-background/80 text-center">
              <div className="text-xs text-muted-foreground mb-1">Matched Billed</div>
              <div className="text-lg font-bold">
                {matched.matchedBilledTotal !== null ? formatCurrency(matched.matchedBilledTotal) : "—"}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 text-center">
              <div className="text-xs text-muted-foreground mb-1">Medicare Reference</div>
              <div className="text-lg font-bold text-primary">
                {matched.matchedMedicareTotal !== null ? formatCurrency(matched.matchedMedicareTotal) : "N/A"}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-background/80 text-center">
              <div className="text-xs text-muted-foreground mb-1">Multiple</div>
              <div
                className={cn(
                  "text-lg font-bold",
                  matched.matchedItemsMultiple && matched.matchedItemsMultiple > 3
                    ? "text-destructive"
                    : matched.matchedItemsMultiple && matched.matchedItemsMultiple > 2
                      ? "text-warning"
                      : "",
                )}
              >
                {matched.matchedItemsMultiple !== null
                  ? formatMultiple(matched.matchedBilledTotal, matched.matchedMedicareTotal)
                  : "—"}
              </div>
            </div>
          </div>

          {/* Scope warning */}
          {matched.scopeWarning && (
            <div className="text-xs text-warning bg-warning/10 p-2 rounded border border-warning/30">
              ⚠ {matched.scopeWarning}
            </div>
          )}
        </div>
      )}

      {/* Summary totals (legacy) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="text-xs text-muted-foreground">Billed</div>
          <div className="text-lg font-bold">
            {output.totals.billedTotal ? formatCurrency(output.totals.billedTotal) : "—"}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-primary/10 text-center">
          <div className="text-xs text-muted-foreground">Medicare Ref</div>
          <div className="text-lg font-bold text-primary">
            {output.totals.medicareReferenceTotal ? formatCurrency(output.totals.medicareReferenceTotal) : "N/A"}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <div className="text-xs text-muted-foreground">Multiple</div>
          <div
            className={cn(
              "text-lg font-bold",
              output.totals.multipleOfMedicare && output.totals.multipleOfMedicare > 3
                ? "text-destructive"
                : output.totals.multipleOfMedicare && output.totals.multipleOfMedicare > 2
                  ? "text-warning"
                  : "",
            )}
          >
            {output.totals.multipleOfMedicare ? `${output.totals.multipleOfMedicare}×` : "—"}
          </div>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
          {pricedItems.length} priced
        </Badge>
        {notPricedItems.length > 0 && (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            {notPricedItems.length} exists (not priced)
          </Badge>
        )}
        {missingItems.length > 0 && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            {missingItems.length} not in MPFS
          </Badge>
        )}
      </div>

      {/* Per-item breakdown */}
      {pricedItems.length > 0 && (
        <div className="rounded-lg border border-border/30 overflow-hidden">
          <div className="bg-muted/30 p-2 text-xs font-medium">Per-Code Breakdown</div>
          <div className="divide-y divide-border/30">
            {pricedItems.slice(0, 10).map((item, i) => (
              <div key={i} className="p-2 text-xs grid grid-cols-4 gap-2">
                <div>
                  <code className="font-mono text-primary">{item.hcpcs}</code>
                  {item.modifier && <span className="text-muted-foreground">-{item.modifier}</span>}
                </div>
                <div className="text-muted-foreground">
                  {item.feeSource === "rvu_calc_local"
                    ? "GPCI adjusted"
                    : item.feeSource === "rvu_calc_national"
                      ? "National RVU"
                      : item.feeSource === "direct_fee"
                        ? "Direct fee"
                        : "—"}
                </div>
                <div className="text-right">${item.medicareReferencePerUnit?.toFixed(2) || "—"}</div>
                <div className="text-right text-muted-foreground">
                  {item.billedAmount ? `$${item.billedAmount.toFixed(2)}` : "—"} billed
                </div>
              </div>
            ))}
            {pricedItems.length > 10 && (
              <div className="p-2 text-xs text-muted-foreground text-center">
                +{pricedItems.length - 10} more items...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Formula explanation */}
      <div className="p-3 rounded-lg bg-muted/20 border border-border/30 text-xs">
        <div className="font-medium mb-2">Calculation Formula:</div>
        <code className="text-[10px] text-muted-foreground">
          Fee = [(Work RVU × Work GPCI) + (PE RVU × PE GPCI) + (MP RVU × MP GPCI)] ×{" "}
          {output.metadata.benchmarkYearUsed === 2026 ? "34.6062" : "CF"}
        </code>
        <div className="mt-2 text-muted-foreground">
          Data year: {output.metadata.benchmarkYearUsed} | Locality: {output.metadata.localityName || "National"} |
          Confidence: {output.metadata.localityUsed}
        </div>
      </div>
    </div>
  );
}

// ============= Calculation Chain Section (NEW) =============

function CalculationChainSection({ data }: { data: DebugCalculationData }) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  // Build calculation chain from available data
  const chain: CalculationChainStep[] = [];

  // Step 1: Geo resolution
  if (data.geoDebug) {
    chain.push({
      step: 1,
      label: "Location",
      status:
        data.geoDebug.confidence === "high" ? "success" : data.geoDebug.confidence === "medium" ? "warning" : "info",
      value: data.geoDebug.localityName || data.geoDebug.stateInput || "National",
      details: `Method: ${data.geoDebug.method}`,
    });
  }

  // Step 2: Codes detected
  chain.push({
    step: 2,
    label: "Codes",
    status: data.validCodes.length > 0 ? "success" : "error",
    value: `${data.validCodes.length} valid`,
    details: data.rejectedTokens.length > 0 ? `${data.rejectedTokens.length} rejected` : undefined,
  });

  // Step 3: Billed amount
  chain.push({
    step: 3,
    label: "Billed",
    status: data.comparisonTotalValue && data.comparisonTotalValue > 0 ? "success" : "warning",
    value: data.comparisonTotalValue ? formatCurrency(data.comparisonTotalValue) : "Not detected",
    details: data.comparisonTotalType || undefined,
  });

  // Step 4: Medicare sources
  if (data.benchmarkOutput) {
    const sources = new Set<string>();
    data.benchmarkOutput.lineItems.forEach((item) => {
      if (item.matchStatus === "matched") {
        if (item.feeSource === "rvu_calc_local") sources.add("MPFS+GPCI");
        else if (item.feeSource === "rvu_calc_national") sources.add("MPFS");
        else if (item.feeSource === "direct_fee") sources.add("Direct");
      }
    });

    chain.push({
      step: 4,
      label: "Sources",
      status: sources.size > 0 ? "success" : "warning",
      value: sources.size > 0 ? Array.from(sources).join(", ") : "None",
      details: `${data.benchmarkOutput.debug.codesMatched.length} priced`,
    });
  }

  // Step 5: Coverage & multiple
  if (data.benchmarkOutput?.matchedItemsComparison) {
    const mc = data.benchmarkOutput.matchedItemsComparison;
    const coveragePct = mc.coveragePercent || 0;

    chain.push({
      step: 5,
      label: "Coverage",
      status: coveragePct >= 80 ? "success" : coveragePct >= 50 ? "warning" : "error",
      value: `${coveragePct}%`,
      details: `${mc.matchedItemsCount}/${mc.totalItemsCount} items`,
    });

    if (mc.isValidComparison && mc.matchedItemsMultiple !== null) {
      chain.push({
        step: 6,
        label: "Multiple",
        status: mc.matchedItemsMultiple <= 2 ? "success" : mc.matchedItemsMultiple <= 3 ? "warning" : "error",
        value: `${mc.matchedItemsMultiple.toFixed(2)}×`,
        details:
          mc.matchedBilledTotal && mc.matchedMedicareTotal
            ? `${formatCurrency(mc.matchedBilledTotal)} ÷ ${formatCurrency(mc.matchedMedicareTotal)}`
            : undefined,
      });
    }
  }

  const statusIcons = {
    success: <CheckCircle className="h-3 w-3 text-success" />,
    warning: <AlertTriangle className="h-3 w-3 text-warning" />,
    error: <AlertCircle className="h-3 w-3 text-destructive" />,
    info: <HelpCircle className="h-3 w-3 text-muted-foreground" />,
  };

  return (
    <div className="p-4 space-y-3">
      {/* Compact chain visualization */}
      <div className="flex flex-wrap gap-2 items-center">
        {chain.map((step, i) => (
          <div key={step.step} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
                step.status === "success" && "bg-success/10 text-success",
                step.status === "warning" && "bg-warning/10 text-warning",
                step.status === "error" && "bg-destructive/10 text-destructive",
                step.status === "info" && "bg-muted text-muted-foreground",
              )}
            >
              {statusIcons[step.status]}
              <span className="font-medium">{step.label}:</span>
              <span>{step.value}</span>
            </div>
            {i < chain.length - 1 && <span className="text-muted-foreground">→</span>}
          </div>
        ))}
      </div>

      {/* Final equation if valid */}
      {data.benchmarkOutput?.matchedItemsComparison?.isValidComparison && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="text-xs font-medium text-primary mb-1">Final Calculation:</div>
          <code className="text-xs text-foreground">
            Multiple = Matched Billed ({formatCurrency(data.benchmarkOutput.matchedItemsComparison.matchedBilledTotal!)}
            ) ÷ Medicare Reference ({formatCurrency(data.benchmarkOutput.matchedItemsComparison.matchedMedicareTotal!)})
            ={" "}
            <span className="font-bold text-primary">
              {data.benchmarkOutput.matchedItemsComparison.matchedItemsMultiple?.toFixed(2)}×
            </span>
          </code>
        </div>
      )}

      {/* Warnings if not valid */}
      {data.benchmarkOutput?.matchedItemsComparison &&
        !data.benchmarkOutput.matchedItemsComparison.isValidComparison && (
          <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
            <div className="text-xs text-warning flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {data.benchmarkOutput.matchedItemsComparison.scopeWarning ||
                "Multiple calculation not available due to scope mismatch"}
            </div>
          </div>
        )}
    </div>
  );
}

// ============= Main Component =============

export function DebugCalculationPanel({ data }: DebugCalculationPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getLocationStatus = () => {
    if (!data.geoDebug) return "info";
    if (data.geoDebug.confidence === "high") return "success";
    if (data.geoDebug.confidence === "medium") return "warning";
    return "info";
  };

  const getCodeStatus = () => {
    if (data.validCodes.length > 0) return "success";
    if (data.reverseSearchTriggered) return "warning";
    return "error";
  };

  const getAmountsStatus = () => {
    if (data.comparisonTotalValue && data.comparisonTotalValue > 0) return "success";
    return "warning";
  };

  const getMedicareStatus = () => {
    if (!data.benchmarkOutput) return "info";
    if (data.benchmarkOutput.status === "ok") return "success";
    if (data.benchmarkOutput.status === "partial") return "warning";
    return "error";
  };

  return (
    <Card className="mt-4 overflow-hidden border-dashed">
      <div className="p-3 bg-muted/30 border-b border-border/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calculator className="h-4 w-4" />
          How This Was Calculated
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Step-by-step breakdown of the benchmark calculation
        </p>
      </div>

      {/* NEW: Compact Calculation Chain Summary */}
      <div className="border-b border-border/30">
        <CalculationChainSection data={data} />
      </div>

      <div className="divide-y divide-border/30">
        {/* Section 1: Location Resolution */}
        <div>
          <SectionHeader
            title="1. Location Resolution"
            icon={<MapPin className="h-4 w-4" />}
            status={getLocationStatus()}
            expanded={expandedSections.has("location")}
            onToggle={() => toggleSection("location")}
          />
          {expandedSections.has("location") && <LocationResolutionSection geoDebug={data.geoDebug} />}
        </div>

        {/* Section 2: Code Detection */}
        <div>
          <SectionHeader
            title="2. Code Detection"
            icon={<Code className="h-4 w-4" />}
            status={getCodeStatus()}
            expanded={expandedSections.has("codes")}
            onToggle={() => toggleSection("codes")}
          />
          {expandedSections.has("codes") && (
            <CodeDetectionSection
              rawCodes={data.rawCodesExtracted}
              validCodes={data.validCodes}
              rejectedTokens={data.rejectedTokens}
              reverseSearchTriggered={data.reverseSearchTriggered}
              reverseSearchReason={data.reverseSearchReason}
              reverseSearchResults={data.reverseSearchResults}
            />
          )}
        </div>

        {/* Section 3: Billed Amount Extraction */}
        <div>
          <SectionHeader
            title="3. Billed Amount Extraction"
            icon={<DollarSign className="h-4 w-4" />}
            status={getAmountsStatus()}
            expanded={expandedSections.has("amounts")}
            onToggle={() => toggleSection("amounts")}
          />
          {expandedSections.has("amounts") && (
            <BilledAmountsSection
              totalsReconciliation={data.totalsReconciliation}
              comparisonTotalType={data.comparisonTotalType}
              comparisonTotalValue={data.comparisonTotalValue}
              comparisonTotalExplanation={data.comparisonTotalExplanation}
            />
          )}
        </div>

        {/* Section 4: Medicare Calculation */}
        <div>
          <SectionHeader
            title="4. Medicare Reference Calculation"
            icon={<Calculator className="h-4 w-4" />}
            status={getMedicareStatus()}
            expanded={expandedSections.has("medicare")}
            onToggle={() => toggleSection("medicare")}
          />
          {expandedSections.has("medicare") && <MedicareCalculationSection output={data.benchmarkOutput} />}
        </div>
      </div>
    </Card>
  );
}
