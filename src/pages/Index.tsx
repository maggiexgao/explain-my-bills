// src/components/analysis/ImmediateCalloutsSection.tsx

import React, { useMemo } from "react";
import type { AnalysisResult } from "@/types";

type ImmediateCalloutsSectionProps = {
  analysis: AnalysisResult | null;
  hasEOB: boolean;
};

const PATIENT_TOTAL_TOLERANCE = 0.01;

export const ImmediateCalloutsSection: React.FC<ImmediateCalloutsSectionProps> = ({ analysis, hasEOB }) => {
  // Safely read totals
  const billTotal = analysis?.billTotal;
  const eobPatientResponsibility = analysis?.eobData?.patientResponsibility;

  // Compute simple totals match flag
  const patientTotalsMatch =
    typeof billTotal === "number" &&
    typeof eobPatientResponsibility === "number" &&
    Math.abs(billTotal - eobPatientResponsibility) <= PATIENT_TOTAL_TOLERANCE;

  // Derive callouts data (you already have potentialErrors / needsAttention)
  const potentialErrors = analysis?.potentialErrors ?? [];
  const needsAttention = analysis?.needsAttention ?? [];

  const hasWarningsOrErrors = potentialErrors.length > 0 || needsAttention.length > 0;

  // High‑level comparison flags for the section
  const totalsMismatch = hasEOB && !patientTotalsMatch;
  const totalsMatchButWarnings = hasEOB && patientTotalsMatch && hasWarningsOrErrors;
  const overallClean = hasEOB && patientTotalsMatch && !hasWarningsOrErrors;

  // Visible callouts list + badge count
  const visibleCallouts = useMemo(() => [...potentialErrors, ...needsAttention], [potentialErrors, needsAttention]);
  const visibleCount = visibleCallouts.length;

  console.log("ImmediateCallouts DEBUG", {
    billTotal,
    eobPatientResponsibility,
    patientTotalsMatch,
    totalsMismatch,
    totalsMatchButWarnings,
    overallClean,
    visibleCount,
  });

  if (!analysis) {
    return null;
  }

  return (
    <section className="rounded-3xl bg-white/80 shadow-sm p-5 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Immediate Callouts</h2>
          <p className="text-xs text-slate-500">Potential errors or areas that may need further review</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
          {visibleCount} {visibleCount === 1 ? "item" : "items"}
        </div>
      </header>

      {/* Yellow intro strip – branch on totals flags */}
      {hasEOB && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {totalsMismatch && (
            <p>
              The total on your bill does not match your EOB&apos;s &quot;patient responsibility&quot; amount. Review
              the discrepancies below and consider contacting your provider or insurer to resolve the difference.
            </p>
          )}

          {totalsMatchButWarnings && (
            <p>
              Even though your total patient responsibility matches your Explanation of Benefits (EOB), the details
              below highlight areas where individual services, codes, or bill formatting may still be worth reviewing
              before you pay.
            </p>
          )}

          {overallClean && (
            <p>
              Your total patient responsibility matches your EOB and no major issues were flagged. You can still review
              the details below if you&apos;d like a deeper breakdown.
            </p>
          )}
        </div>
      )}

      {/* Potential Errors */}
      {potentialErrors.length > 0 && (
        <div className="mt-1">
          <h3 className="mb-2 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
            Potential Errors
            <span className="ml-1 text-[11px] font-normal text-rose-500">{potentialErrors.length}</span>
          </h3>
          <div className="flex flex-col gap-3">
            {potentialErrors.map((item, idx) => (
              <div
                key={item.title || idx}
                className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-900"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium">{item.title || "Potential issue"}</p>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                    Potential Errors
                  </span>
                </div>
                <p className="text-[11px] leading-snug">
                  {item.description || "There may be an error or mismatch between your bill and EOB for this item."}
                </p>
                {item.suggestedQuestion && (
                  <p className="mt-1 text-[11px] leading-snug text-rose-800">
                    Suggested question: {item.suggestedQuestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <div className="mt-1">
          <h3 className="mb-2 text-xs font-semibold text-amber-700 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            Needs Attention
            <span className="ml-1 text-[11px] font-normal text-amber-500">{needsAttention.length}</span>
          </h3>
          <div className="flex flex-col gap-3">
            {needsAttention.map((item, idx) => (
              <div
                key={item.title || idx}
                className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-900"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium">{item.title || "Needs attention"}</p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Needs Attention
                  </span>
                </div>
                <p className="text-[11px] leading-snug">
                  {item.description || "This area may not be an outright error, but it could affect what you owe."}
                </p>
                {item.suggestedQuestion && (
                  <p className="mt-1 text-[11px] leading-snug text-amber-800">
                    Suggested question: {item.suggestedQuestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
