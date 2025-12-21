import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, Copy, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, BillingIssue } from '@/types';
import { useState } from 'react';
import { toast } from 'sonner';

interface ImmediateCalloutsSectionProps {
  analysis: AnalysisResult;
}

const severityConfig = {
  error: {
    bg: 'bg-destructive/5',
    border: 'border-destructive/30',
    icon: 'text-destructive',
    badge: 'bg-destructive/10 text-destructive',
    label: 'Potential Error',
  },
  warning: {
    bg: 'bg-warning/5',
    border: 'border-warning/30',
    icon: 'text-warning',
    badge: 'bg-warning/10 text-warning-foreground',
    label: 'May Need Attention',
  },
  info: {
    bg: 'bg-info/5',
    border: 'border-info/30',
    icon: 'text-info',
    badge: 'bg-info/10 text-info',
    label: 'For Your Information',
  },
};

function CalloutCard({ issue }: { issue: BillingIssue }) {
  const [copied, setCopied] = useState(false);
  const config = severityConfig[issue.severity] || severityConfig.info;

  const copyQuestion = () => {
    navigator.clipboard.writeText(issue.suggestedQuestion);
    setCopied(true);
    toast.success('Question copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('p-4 rounded-xl border', config.bg, config.border)}>
      <div className="flex items-start gap-3">
        {issue.severity === 'error' ? (
          <AlertCircle className={cn('h-5 w-5 mt-0.5 shrink-0', config.icon)} />
        ) : (
          <AlertTriangle className={cn('h-5 w-5 mt-0.5 shrink-0', config.icon)} />
        )}
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium text-foreground">{issue.title}</h4>
            <Badge className={cn('shrink-0 text-xs', config.badge)}>
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{issue.description}</p>
          
          {/* Related codes and amounts */}
          {(issue.relatedCodes?.length || issue.relatedAmounts) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {issue.relatedCodes?.map((code) => (
                <code key={code} className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {code}
                </code>
              ))}
              {issue.relatedAmounts?.billed && (
                <span className="text-xs text-muted-foreground">
                  Billed: ${issue.relatedAmounts.billed.toLocaleString()}
                </span>
              )}
              {issue.relatedAmounts?.eob && (
                <span className="text-xs text-muted-foreground">
                  EOB: ${issue.relatedAmounts.eob.toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Suggested question */}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2 italic">Ask:</p>
            <div className="p-2 rounded-md bg-background/80 border border-border/30">
              <p className="text-sm text-foreground">"{issue.suggestedQuestion}"</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyQuestion}
              className="mt-2 text-xs h-7"
            >
              <Copy className="h-3 w-3 mr-1" />
              {copied ? 'Copied!' : 'Copy question'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImmediateCalloutsSection({ analysis }: ImmediateCalloutsSectionProps) {
  const potentialErrors = analysis.potentialErrors || [];
  const needsAttention = analysis.needsAttention || [];
  const hasAnyIssues = potentialErrors.length > 0 || needsAttention.length > 0;

  if (!hasAnyIssues) {
    return (
      <div className="p-6 text-center rounded-xl bg-mint-light/50 border border-mint/20">
        <div className="flex h-12 w-12 mx-auto mb-3 items-center justify-center rounded-full bg-mint/10">
          <Info className="h-6 w-6 text-mint" />
        </div>
        <h4 className="text-sm font-medium text-foreground mb-1">No immediate issues detected</h4>
        <p className="text-sm text-muted-foreground">
          We didn't find obvious errors or discrepancies in your bill. Review the other sections for a complete understanding.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Potential Errors */}
      {potentialErrors.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <h4 className="text-sm font-medium text-foreground">Potential Errors</h4>
            <Badge className="bg-destructive/10 text-destructive text-xs">
              {potentialErrors.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            These items appear to have issues that may need correction:
          </p>
          <div className="space-y-3">
            {potentialErrors.map((issue, idx) => (
              <CalloutCard key={idx} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {/* May Need Attention */}
      {needsAttention.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h4 className="text-sm font-medium text-foreground">May Need Attention</h4>
            <Badge className="bg-warning/10 text-warning-foreground text-xs">
              {needsAttention.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            These aren't necessarily errors but may warrant clarification:
          </p>
          <div className="space-y-3">
            {needsAttention.map((issue, idx) => (
              <CalloutCard key={idx} issue={issue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
