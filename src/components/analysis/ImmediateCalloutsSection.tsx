import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, Info, CheckCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, BillingIssue } from '@/types';
import { useTranslation } from '@/i18n/LanguageContext';

interface ImmediateCalloutsSectionProps {
  analysis: AnalysisResult;
  hasEOB?: boolean;
}

const severityConfig = {
  error: {
    bg: 'bg-destructive/5',
    border: 'border-destructive/30',
    icon: 'text-destructive',
    badge: 'bg-destructive/10 text-destructive',
  },
  warning: {
    bg: 'bg-warning/5',
    border: 'border-warning/30',
    icon: 'text-warning',
    badge: 'bg-warning/10 text-warning-foreground',
  },
  info: {
    bg: 'bg-info/5',
    border: 'border-info/30',
    icon: 'text-info',
    badge: 'bg-info/10 text-info',
  },
};

function CalloutCard({ issue }: { issue: BillingIssue }) {
  const { t } = useTranslation();
  const config = severityConfig[issue.severity] || severityConfig.info;

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
              {issue.severity === 'error' ? t('callouts.potentialErrors') : t('callouts.needsAttention')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{issue.description}</p>
          
          {(issue.relatedCodes?.length || issue.relatedAmounts) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {issue.relatedCodes?.map((code) => (
                <code key={code} className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {code}
                </code>
              ))}
              {issue.relatedAmounts?.billed && (
                <span className="text-xs text-muted-foreground">
                  {t('billing.eobComparison.billed')}: ${issue.relatedAmounts.billed.toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// EOB Match confirmation box - shown when bill total matches EOB patient responsibility
function EOBMatchBox({ billTotal, eobPatientResponsibility }: { billTotal: number; eobPatientResponsibility: number }) {
  return (
    <div className="p-4 rounded-xl bg-success/10 border border-success/30">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/20">
          <CheckCircle className="h-4 w-4 text-success" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-foreground mb-1">Bill matches EOB</h4>
          <p className="text-sm text-muted-foreground">
            Your bill's total (${billTotal.toLocaleString()}) matches your EOB's patient responsibility (${eobPatientResponsibility.toLocaleString()}). That's a good sign.
          </p>
        </div>
      </div>
    </div>
  );
}

// All Clear success box when no issues found
function AllClearBox() {
  const resources = [
    { name: 'State Insurance Department', description: 'Find your state\'s consumer protection contacts' },
    { name: 'Hospital Financial Assistance', description: 'Ask about charity care or payment plans' },
    { name: 'Patient Advocate Foundation', description: 'Free case management and advocacy', url: 'https://www.patientadvocate.org' },
  ];

  return (
    <div className="space-y-4">
      <div className="p-6 rounded-xl bg-success/10 border border-success/30">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success/20">
            <CheckCircle className="h-6 w-6 text-success" />
          </div>
          <div className="flex-1">
            <h4 className="text-base font-semibold text-foreground mb-2">Overall, this bill looks reasonable</h4>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              No visible errors or areas of attention were detected based on the information we reviewed. The billing details appear consistent with what your insurance shows.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you still feel something is off, it's always okay to ask questions. Here are resources you can use if you'd like to look deeper.
            </p>
          </div>
        </div>
      </div>

      {/* Resources for further verification */}
      <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
        <h5 className="text-sm font-medium text-foreground mb-3">Resources for further verification:</h5>
        <div className="space-y-2">
          {resources.map((resource, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <ExternalLink className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">{resource.name}</span>
                <span className="text-muted-foreground"> – {resource.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer for all-clear case */}
      <p className="text-xs text-muted-foreground italic px-1">
        This review is based only on the document(s) you uploaded and may not capture every detail of your care or coverage. If you believe something is wrong, use the resources above or contact your insurer or provider for a more complete review.
      </p>
    </div>
  );
}

// Helper to check if an issue is about EOB mismatch
function isEOBMismatchIssue(issue: BillingIssue): boolean {
  const title = issue.title?.toLowerCase() || '';
  const description = issue.description?.toLowerCase() || '';
  return (
    title.includes('eob') || 
    title.includes('mismatch') ||
    title.includes('bill total') ||
    description.includes('eob') ||
    description.includes('patient responsibility')
  );
}

// Helper to check if issue description indicates a match (guardrail)
function descriptionIndicatesMatch(issue: BillingIssue): boolean {
  const description = issue.description?.toLowerCase() || '';
  return (
    description.includes('perfect match') ||
    description.includes('which is great') ||
    description.includes('matches your eob') ||
    description.includes('amounts match') ||
    description.includes('good sign')
  );
}

export function ImmediateCalloutsSection({ analysis, hasEOB }: ImmediateCalloutsSectionProps) {
  const { t } = useTranslation();
  
  // Parse bill total and EOB patient responsibility as numbers
  const billTotal = typeof analysis.billTotal === 'number' ? analysis.billTotal : undefined;
  const eobPatientResponsibility = typeof analysis.eobData?.patientResponsibility === 'number' 
    ? analysis.eobData.patientResponsibility 
    : undefined;
  
  // Check if bill total matches EOB patient responsibility (within $0.01 tolerance for rounding)
  const canCompare = hasEOB && billTotal !== undefined && eobPatientResponsibility !== undefined;
  const diff = canCompare ? Math.abs(billTotal - eobPatientResponsibility) : Infinity;
  const totalsMatch = canCompare && diff <= 0.01;

  // Filter out EOB mismatch issues when totals actually match
  // Also filter out any issue where the description says it's a match (guardrail)
  const rawPotentialErrors = analysis.potentialErrors || [];
  const rawNeedsAttention = analysis.needsAttention || [];
  
  const potentialErrors = rawPotentialErrors.filter(issue => {
    // Remove EOB mismatch issues when totals match
    if (totalsMatch && isEOBMismatchIssue(issue)) return false;
    // Guardrail: if description says it's a match, don't show as error
    if (descriptionIndicatesMatch(issue)) return false;
    return true;
  });
  
  const needsAttention = rawNeedsAttention.filter(issue => {
    // Remove EOB mismatch issues when totals match
    if (totalsMatch && isEOBMismatchIssue(issue)) return false;
    // Guardrail: if description says it's a match, don't show as warning
    if (descriptionIndicatesMatch(issue)) return false;
    return true;
  });
  
  const hasAnyIssues = potentialErrors.length > 0 || needsAttention.length > 0;

  // Check if this is an "all clear" case
  if (!hasAnyIssues) {
    return (
      <div className="space-y-4">
        {totalsMatch && (
          <EOBMatchBox billTotal={billTotal!} eobPatientResponsibility={eobPatientResponsibility!} />
        )}
        <AllClearBox />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Show EOB match confirmation if totals match */}
      {totalsMatch && (
        <EOBMatchBox billTotal={billTotal!} eobPatientResponsibility={eobPatientResponsibility!} />
      )}

      {potentialErrors.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <h4 className="text-sm font-medium text-foreground">{t('callouts.potentialErrors')}</h4>
            <Badge className="bg-destructive/10 text-destructive text-xs">
              {potentialErrors.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {potentialErrors.map((issue, idx) => (
              <CalloutCard key={idx} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {needsAttention.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h4 className="text-sm font-medium text-foreground">{t('callouts.needsAttention')}</h4>
            <Badge className="bg-warning/10 text-warning-foreground text-xs">
              {needsAttention.length}
            </Badge>
          </div>
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
