import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Extended type to support details field from API
interface ExtendedPondNextStep {
  step: string;
  details?: string;
  isUrgent?: boolean;
}

interface PondNextStepsSectionProps {
  steps: ExtendedPondNextStep[];
  closingReassurance: string;
}

// Default fallback steps if none provided
const DEFAULT_STEPS: ExtendedPondNextStep[] = [
  { step: "Request an itemized bill", details: "Get a detailed breakdown of all charges to verify accuracy", isUrgent: false },
  { step: "Request a coding review", details: "Ask billing to verify the visit level code is justified by your medical records", isUrgent: false },
  { step: "Ask about financial assistance", details: "Nonprofit hospitals must offer charity care programs for qualifying patients", isUrgent: false },
  { step: "Request self-pay discount", details: "Many hospitals offer 20-50% off for prompt payment or self-pay patients", isUrgent: false },
];

export function PondNextStepsSection({ steps, closingReassurance }: PondNextStepsSectionProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  
  // Use default steps if none provided or steps are blank
  const effectiveSteps = (steps && steps.length > 0 && steps.some(s => s.step?.trim()))
    ? steps.filter(s => s.step?.trim())
    : DEFAULT_STEPS;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {effectiveSteps.map((step, idx) => {
          const isExpanded = expandedIdx === idx;
          const hasDetails = step.details && step.details.trim().length > 0;
          
          return (
            <div 
              key={idx} 
              className={cn(
                "rounded-xl border overflow-hidden",
                step.isUrgent 
                  ? "bg-warning/5 border-warning/30" 
                  : "bg-muted/20 border-border/30"
              )}
            >
              <button
                onClick={() => hasDetails && setExpandedIdx(isExpanded ? null : idx)}
                disabled={!hasDetails}
                className={cn(
                  "w-full flex items-start gap-3 p-3 text-left",
                  hasDetails && "hover:bg-muted/10 cursor-pointer",
                  !hasDetails && "cursor-default"
                )}
              >
                <div className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  step.isUrgent 
                    ? "bg-warning text-warning-foreground" 
                    : "bg-primary text-primary-foreground"
                )}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{step.step}</p>
                  {!isExpanded && hasDetails && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{step.details}</p>
                  )}
                </div>
                {step.isUrgent && (
                  <Badge className="bg-warning/10 text-warning-foreground text-xs shrink-0">
                    Priority
                  </Badge>
                )}
                {hasDetails && (
                  isExpanded 
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                )}
              </button>
              
              {isExpanded && hasDetails && (
                <div className="px-3 pb-3 pt-0">
                  <div className="ml-9 p-3 rounded-lg bg-background/60 border border-border/30">
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.details}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Closing Reassurance */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border/40">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <CheckSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-foreground leading-relaxed">
              {closingReassurance}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
