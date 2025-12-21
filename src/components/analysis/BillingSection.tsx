import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  AlertTriangle,
  Heart,
  Scale,
  Copy,
  ExternalLink,
  Building,
  Shield,
  ChevronDown,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, BillingIssue, FinancialOpportunity } from '@/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { SubcategoryCard } from './SubcategoryCard';

interface BillingSectionProps {
  analysis: AnalysisResult;
  hasEOB: boolean;
}

const severityColors: Record<string, string> = {
  info: 'border-info/30 bg-info/5',
  warning: 'border-warning/30 bg-warning/5',
  important: 'border-destructive/30 bg-destructive/5',
  error: 'border-destructive/30 bg-destructive/5',
};

const severityIcons: Record<string, string> = {
  info: 'text-info',
  warning: 'text-warning',
  important: 'text-destructive',
  error: 'text-destructive',
};

function IssueCard({ issue }: { issue: BillingIssue }) {
  const [copied, setCopied] = useState(false);

  const copyQuestion = () => {
    navigator.clipboard.writeText(issue.suggestedQuestion);
    setCopied(true);
    toast.success('Question copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('p-4 rounded-xl border', severityColors[issue.severity])}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn('h-4 w-4 mt-0.5 shrink-0', severityIcons[issue.severity])} />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-foreground mb-1">{issue.title}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{issue.description}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={copyQuestion}
            className="text-xs h-7"
          >
            <Copy className="h-3 w-3 mr-1" />
            {copied ? 'Copied!' : 'Copy question'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FinancialOpportunityCard({ opportunity }: { opportunity: FinancialOpportunity }) {
  return (
    <div className="p-4 rounded-xl bg-success/5 border border-success/20">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h5 className="text-sm font-medium text-foreground">{opportunity.title}</h5>
        <Badge variant="outline" className="shrink-0 text-xs capitalize">
          {opportunity.effortLevel.replace('_', ' ')}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-2">{opportunity.description}</p>
      <p className="text-xs text-muted-foreground italic">{opportunity.eligibilityHint}</p>
      {opportunity.link && (
        <a
          href={opportunity.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-2"
        >
          Apply now <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

// How Medical Billing Works - the preview section
function BillingEducationPreview({ analysis, hasEOB }: { analysis: AnalysisResult; hasEOB: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* Preview: How Medical Billing Works */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          How Medical Billing Works
        </h4>
        <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {analysis.billingEducation.billedVsAllowed}
          </p>
        </div>
        
        {hasEOB && analysis.billingEducation.eobSummary && (
          <div className="p-4 rounded-xl bg-success/5 border border-success/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-success" />
              <span className="text-xs font-medium text-success">From Your EOB</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {analysis.billingEducation.eobSummary}
            </p>
          </div>
        )}
      </div>

      {/* Expand for more details */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-primary hover:underline font-medium"
      >
        {isExpanded ? 'Show less' : 'Learn more about billing terms'}
        <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
      </button>
      
      {isExpanded && (
        <div className="space-y-3 pt-3 border-t border-border/30 animate-fade-in">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
            <h5 className="text-xs font-medium text-foreground mb-2">Deductibles</h5>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.billingEducation.deductibleExplanation}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
            <h5 className="text-xs font-medium text-foreground mb-2">Copays & Coinsurance</h5>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.billingEducation.copayCoinsurance}
            </p>
          </div>
          
          {/* EOB Breakdown if available */}
          {hasEOB && analysis.eobData && (
            <div className="space-y-3 pt-3">
              <h5 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Your Insurance Breakdown
              </h5>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground">Billed Amount</p>
                  <p className="text-lg font-semibold text-foreground">${analysis.eobData.billedAmount.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground">Allowed Amount</p>
                  <p className="text-lg font-semibold text-foreground">${analysis.eobData.allowedAmount.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-success/5 border border-success/20">
                  <p className="text-xs text-muted-foreground">Insurance Paid</p>
                  <p className="text-lg font-semibold text-success">${analysis.eobData.insurancePaid.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-warning/5 border border-warning/20">
                  <p className="text-xs text-muted-foreground">Your Responsibility</p>
                  <p className="text-lg font-semibold text-warning">${analysis.eobData.patientResponsibility.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BillingSection({ analysis, hasEOB }: BillingSectionProps) {
  return (
    <div className="space-y-3">
      {/* A. Things to Know About Your Bill - How billing works as preview */}
      <SubcategoryCard
        icon={<HelpCircle className="h-5 w-5 text-purple" />}
        title="Things to Know About Your Bill"
        teaser="Understanding how medical billing works"
        badge={hasEOB ? 'EOB Enhanced' : undefined}
        badgeVariant="success"
        defaultOpen={true}
      >
        <BillingEducationPreview analysis={analysis} hasEOB={hasEOB} />
      </SubcategoryCard>

      {/* B. Financial Help in [State] */}
      <SubcategoryCard
        icon={<Heart className="h-5 w-5 text-coral" />}
        title={`Financial Help in ${analysis.stateHelp.state}`}
        teaser="State programs and protections available to you"
        defaultOpen={false}
      >
        <div className="space-y-4">
          {/* Medicaid/CHIP */}
          <div className="p-4 rounded-xl bg-success/5 border border-success/20">
            <p className="text-xs font-medium text-success mb-2">Medicaid / CHIP</p>
            <p className="text-sm text-muted-foreground mb-3">{analysis.stateHelp.medicaidInfo.description}</p>
            <a
              href={analysis.stateHelp.medicaidInfo.eligibilityLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Check eligibility <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          
          {/* State Debt Protections */}
          {analysis.stateHelp.debtProtections.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-foreground">Your State Protections</h5>
              {analysis.stateHelp.debtProtections.map((protection, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-sm text-muted-foreground">{protection}</p>
                </div>
              ))}
            </div>
          )}
          
          {/* Relief Programs */}
          {analysis.stateHelp.reliefPrograms.map((program, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-xs font-medium text-foreground mb-2">{program.name}</p>
              <p className="text-sm text-muted-foreground mb-2">{program.description}</p>
              {program.link && (
                <a
                  href={program.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Learn more <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </SubcategoryCard>

      {/* C. Provider Financial Assistance */}
      <SubcategoryCard
        icon={<Building className="h-5 w-5 text-mint" />}
        title="Provider Financial Assistance"
        teaser={`Assistance from ${analysis.providerAssistance.providerName}`}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
            <p className="text-xs font-medium text-foreground mb-2">{analysis.providerAssistance.providerName}</p>
            <p className="text-sm text-muted-foreground mb-3">{analysis.providerAssistance.charityCareSummary}</p>
            <p className="text-xs text-muted-foreground italic mb-3">{analysis.providerAssistance.eligibilityNotes}</p>
            
            {/* Income thresholds if available */}
            {analysis.providerAssistance.incomeThresholds && analysis.providerAssistance.incomeThresholds.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-foreground mb-1">Income Thresholds:</p>
                <ul className="space-y-1">
                  {analysis.providerAssistance.incomeThresholds.map((threshold, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {threshold}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Required documents if available */}
            {analysis.providerAssistance.requiredDocuments && analysis.providerAssistance.requiredDocuments.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-foreground mb-1">Documents You May Need:</p>
                <ul className="space-y-1">
                  {analysis.providerAssistance.requiredDocuments.map((doc, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {analysis.providerAssistance.financialAssistanceLink && (
              <a
                href={analysis.providerAssistance.financialAssistanceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                View assistance policy <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          
          {/* Financial Opportunities */}
          {analysis.financialOpportunities.length > 0 && (
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-foreground">Other Assistance You May Qualify For</h5>
              {analysis.financialOpportunities.map((opp, idx) => (
                <FinancialOpportunityCard key={idx} opportunity={opp} />
              ))}
            </div>
          )}
        </div>
      </SubcategoryCard>

      {/* D. Medical Debt & Credit */}
      <SubcategoryCard
        icon={<Scale className="h-5 w-5 text-primary" />}
        title="Medical Debt & Credit"
        teaser="What you should know about medical debt"
        defaultOpen={false}
      >
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground italic">
            Educational information about how medical debt can affect your credit:
          </p>
          {analysis.debtAndCreditInfo.length > 0 ? (
            <ul className="space-y-2">
              {analysis.debtAndCreditInfo.map((info, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2 p-3 rounded-lg bg-muted/20 border border-border/30">
                  <span className="text-primary shrink-0">•</span>
                  {info}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-sm text-muted-foreground">
                Medical debt over $500 that's at least 12 months past due may appear on your credit report. 
                Recent changes have removed many medical debts from credit reports, and paid medical debts no longer appear.
              </p>
            </div>
          )}
        </div>
      </SubcategoryCard>
    </div>
  );
}