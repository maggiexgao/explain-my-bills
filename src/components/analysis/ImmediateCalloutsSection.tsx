import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, CheckCircle, ExternalLink, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, BillingIssue } from '@/types';
import { useTranslation } from '@/i18n/LanguageContext';
import { EobBillComparison, buildEobBillComparison } from '@/lib/eobBillComparison';

interface ImmediateCalloutsSectionProps {
  analysis: AnalysisResult;
  hasEOB?: boolean;
  comparison?: EobBillComparison; // Optional: will be computed if not provided
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

function CalloutCard({ issue, category }: { issue: BillingIssue; category?: string }) {
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

// "Looks Good" confirmation card for positive checks
interface LooksGoodItem {
  title: string;
  description: string;
}

function LooksGoodCard({ item }: { item: LooksGoodItem }) {
  return (
    <div className="p-4 rounded-xl bg-success/10 border border-success/30">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/20">
          <CheckCircle className="h-4 w-4 text-success" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
            <Badge className="shrink-0 text-xs bg-success/10 text-success">Looks good</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
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

// Intro text based on comparison state
function SectionIntro({ comparison }: { comparison: EobBillComparison }) {
  if (comparison.totalsMatchButWarnings) {
    return (
      <div className="p-3 rounded-lg bg-info/5 border border-info/20 mb-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Even though your total patient responsibility matches your EOB, the details below highlight areas where individual services or bill formatting may still need a closer look.
          </p>
        </div>
      </div>
    );
  }
  
  if (comparison.totalsMismatch && comparison.canCompareEOB) {
    return (
      <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 mb-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            The total on your bill doesn't match your EOB's "patient responsibility" amount. Review the discrepancies below and consider contacting your provider or insurer to resolve the difference.
          </p>
        </div>
      </div>
    );
  }
  
  if (!comparison.hasEOB) {
    return (
      <div className="p-3 rounded-lg bg-muted/30 border border-border/20 mb-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Upload your Explanation of Benefits (EOB) to compare with this bill and get a more complete analysis.
          </p>
        </div>
      </div>
    );
  }
  
  return null;
}

export function ImmediateCalloutsSection({ analysis, hasEOB, comparison: providedComparison }: ImmediateCalloutsSectionProps) {
  const { t } = useTranslation();
  
  // Use provided comparison or compute it
  const comparison = providedComparison || buildEobBillComparison(analysis, hasEOB);
  
  const { 
    potentialErrors, 
    needsAttention, 
    patientTotalsMatch, 
    billTotal, 
    eobPatientResponsibility,
    hasBillHigherThanEOBLineItem,
    totalsDiscrepancyAmount,
    overallClean,
  } = comparison;

  // Build "Looks Good" items for positive checks
  const looksGoodItems: LooksGoodItem[] = [];
  
  // EOB match is a positive check - show when patient totals match
  // This is independent of line-item issues
  if (patientTotalsMatch && billTotal !== undefined) {
    looksGoodItems.push({
      title: 'Bill total matches your EOB',
      description: `Your bill's total patient responsibility ($${billTotal.toFixed(2)}) matches the amount shown on your EOB. That's a good sign.`,
    });
  }
  
  const hasAnyIssues = potentialErrors.length > 0 || needsAttention.length > 0;

  // "All clear" case: no issues and amounts match
  if (!hasAnyIssues && overallClean) {
    return (
      <div className="space-y-4">
        {looksGoodItems.map((item, idx) => (
          <LooksGoodCard key={idx} item={item} />
        ))}
        <AllClearBox />
      </div>
    );
  }

  // Group issues by category for better organization
  const categorizeIssue = (issue: BillingIssue): string => {
    const text = `${issue.title || ''} ${issue.description || ''}`.toLowerCase();
    if (text.includes('total') || text.includes('eob') || text.includes('patient responsibility')) return 'totals';
    if (text.includes('code') || text.includes('cpt') || text.includes('hcpcs') || text.includes('itemized')) return 'structure';
    if (text.includes('coverage') || text.includes('network') || text.includes('deductible') || text.includes('coinsurance')) return 'coverage';
    return 'line_item';
  };

  return (
    <div className="space-y-6">
      {/* Section intro based on comparison state */}
      <SectionIntro comparison={comparison} />

      {/* Show Looks Good items (positive confirmations) when totals match */}
      {looksGoodItems.length > 0 && (
        <div className="space-y-3">
          {looksGoodItems.map((item, idx) => (
            <LooksGoodCard key={idx} item={item} />
          ))}
        </div>
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
              <CalloutCard key={idx} issue={issue} category={categorizeIssue(issue)} />
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
              <CalloutCard key={idx} issue={issue} category={categorizeIssue(issue)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Legacy export for backward compatibility - now uses the centralized utility
export function useVisibleCalloutCount(analysis: AnalysisResult, hasEOB?: boolean): number {
  const comparison = buildEobBillComparison(analysis, hasEOB);
  return comparison.visibleCalloutCount;
}

// Legacy export for backward compatibility
export function getFilteredCallouts(analysis: AnalysisResult, hasEOB?: boolean) {
  const comparison = buildEobBillComparison(analysis, hasEOB);
  return {
    potentialErrors: comparison.potentialErrors,
    needsAttention: comparison.needsAttention,
    totalsMatch: comparison.totalsMatch,
    billTotal: comparison.billTotal,
    eobPatientResponsibility: comparison.eobPatientResponsibility,
    canCompareEOB: comparison.canCompareEOB,
  };
}
