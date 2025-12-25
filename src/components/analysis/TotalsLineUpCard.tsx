import { Info, CheckCircle2 } from 'lucide-react';

interface TotalsLineUpCardProps {
  billTotal: number;
  eobPatientResponsibility: number;
  hasWarnings: boolean;
}

export function TotalsLineUpCard({ billTotal, eobPatientResponsibility, hasWarnings }: TotalsLineUpCardProps) {
  return (
    <div className="p-5 rounded-2xl bg-info/8 border border-info/30 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info/15">
          <CheckCircle2 className="h-5 w-5 text-info" />
        </div>
        <div className="flex-1 space-y-3">
          <h3 className="text-base font-semibold text-foreground">
            Totals line up, but there's more to review
          </h3>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              At a glance, your total amount owed (<span className="font-medium text-foreground">${billTotal.toFixed(2)}</span>) matches your Explanation of Benefits (EOB).
            </p>
            <p>
              However, there are still a few details worth reviewing below, including how individual services were billed and how your insurance applied discounts and adjustments.
            </p>
            <p>
              Use the callouts and explanations to double-check that each service, code, and patient responsibility looks accurate before paying your bill.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
