import { CheckCircle } from 'lucide-react';

interface SuccessResultsCardProps {
  billTotal: number;
  eobPatientResponsibility: number;
}

export function SuccessResultsCard({ billTotal, eobPatientResponsibility }: SuccessResultsCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-success/10 border border-success/40 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success/20">
          <CheckCircle className="h-6 w-6 text-success" />
        </div>
        <div className="flex-1 space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            Bill and EOB amounts match
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              At first glance, your bill and Explanation of Benefits (EOB) line up and the amounts you owe appear to be in order.
            </p>
            <p>
              Review the sections below for a line-by-line explanation of your charges and tips for lowering your costs, including questions to ask your provider or insurer.
            </p>
            <p>
              If anything still seems off or you believe you are being misbilled, consider contacting your insurer, your provider's billing office, or an independent billing advocate for help.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
