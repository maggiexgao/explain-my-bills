import { Badge } from '@/components/ui/badge';
import { CheckSquare, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PondNextStep } from '@/types';

interface PondNextStepsSectionProps {
  steps: PondNextStep[];
  closingReassurance: string;
}

export function PondNextStepsSection({ steps, closingReassurance }: PondNextStepsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <div 
            key={idx} 
            className={cn(
              "flex items-start gap-3 p-3 rounded-xl border",
              step.isUrgent 
                ? "bg-warning/5 border-warning/30" 
                : "bg-muted/20 border-border/30"
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
            <div className="flex-1">
              <p className="text-sm text-foreground">{step.step}</p>
            </div>
            {step.isUrgent && (
              <Badge className="bg-warning/10 text-warning-foreground text-xs shrink-0">
                Priority
              </Badge>
            )}
          </div>
        ))}
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
