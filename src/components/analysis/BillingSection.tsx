import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  AlertTriangle,
  Heart,
  Scale,
  CheckSquare,
  Copy,
  ExternalLink,
  Building,
  Shield,
  Phone,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, BillingIssue, ContactTemplate } from '@/types';
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
};

const severityIcons: Record<string, string> = {
  info: 'text-info',
  warning: 'text-warning',
  important: 'text-destructive',
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
    <div className={cn('p-4 rounded-lg border', severityColors[issue.severity])}>
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

function TemplateCard({ template }: { template: ContactTemplate }) {
  const [copied, setCopied] = useState(false);

  const copyTemplate = () => {
    navigator.clipboard.writeText(template.template);
    setCopied(true);
    toast.success('Template copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 rounded-lg border border-border/30 bg-muted/10">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-foreground">{template.purpose}</h4>
        <Badge variant="outline" className="shrink-0 text-xs">
          {template.target === 'billing' ? <Building className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
          {template.target === 'billing' ? 'Billing' : 'Insurance'}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{template.whenToUse}</p>
      <div className="p-3 rounded-md bg-background border border-border/30 mb-3">
        <p className="text-sm text-foreground whitespace-pre-wrap font-mono text-xs leading-relaxed">
          "{template.template}"
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={copyTemplate}
        className="text-xs h-7"
      >
        <Copy className="h-3 w-3 mr-1" />
        {copied ? 'Copied!' : 'Copy to clipboard'}
      </Button>
    </div>
  );
}

// Quick summary bullets for collapsed "Things to Know" view
function BillingSummaryBullets({ analysis, hasEOB }: { analysis: AnalysisResult; hasEOB: boolean }) {
  const bullets = [
    "This bill shows what the provider charged and what you may owe.",
    "Your costs depend on your deductible, copay, and coinsurance.",
    `${analysis.stateHelp.state} has protections and assistance options for medical bills.`,
  ];

  return (
    <ul className="space-y-2">
      {bullets.map((bullet, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
          <span className="text-primary shrink-0">•</span>
          <span>{bullet}</span>
        </li>
      ))}
      {hasEOB && (
        <li className="flex items-start gap-2 text-sm text-success">
          <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
          <span>EOB uploaded: your breakdown includes actual insurance payments.</span>
        </li>
      )}
    </ul>
  );
}

// Full detailed billing breakdown
function BillingFullBreakdown({ analysis, hasEOB }: { analysis: AnalysisResult; hasEOB: boolean }) {
  return (
    <div className="space-y-6 pt-4 border-t border-border/30">
      {/* How Billing Works */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          How Medical Billing Works
        </h4>
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.billingEducation.billedVsAllowed}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.billingEducation.deductibleExplanation}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.billingEducation.copayCoinsurance}
            </p>
          </div>
          {hasEOB && analysis.billingEducation.eobSummary && (
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <p className="text-xs font-medium text-success mb-1">From Your EOB:</p>
              <p className="text-sm text-foreground leading-relaxed">
                {analysis.billingEducation.eobSummary}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* EOB Breakdown if available */}
      {hasEOB && analysis.eobData && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Your Insurance Breakdown
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <p className="text-xs text-muted-foreground">Billed Amount</p>
              <p className="text-lg font-semibold text-foreground">${analysis.eobData.billedAmount.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <p className="text-xs text-muted-foreground">Allowed Amount</p>
              <p className="text-lg font-semibold text-foreground">${analysis.eobData.allowedAmount.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <p className="text-xs text-muted-foreground">Insurance Paid</p>
              <p className="text-lg font-semibold text-success">${analysis.eobData.insurancePaid.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
              <p className="text-xs text-muted-foreground">Your Responsibility</p>
              <p className="text-lg font-semibold text-warning-foreground">${analysis.eobData.patientResponsibility.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* State-Specific Help */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Heart className="h-4 w-4 text-muted-foreground" />
          Financial Help in {analysis.stateHelp.state}
        </h4>
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-success/5 border border-success/20">
            <p className="text-xs font-medium text-success mb-1">Medicaid / CHIP</p>
            <p className="text-sm text-muted-foreground mb-2">{analysis.stateHelp.medicaidInfo.description}</p>
            <a
              href={analysis.stateHelp.medicaidInfo.eligibilityLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Check eligibility <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {analysis.stateHelp.reliefPrograms.map((program, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <p className="text-xs font-medium text-foreground mb-1">{program.name}</p>
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
      </div>

      {/* Provider Assistance */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          {analysis.providerAssistance.providerType === 'hospital' ? 'Hospital' : 'Provider'} Financial Assistance
        </h4>
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <p className="text-xs font-medium text-foreground mb-1">{analysis.providerAssistance.providerName}</p>
          <p className="text-sm text-muted-foreground mb-2">{analysis.providerAssistance.charityCareSummary}</p>
          <p className="text-xs text-muted-foreground italic mb-2">{analysis.providerAssistance.eligibilityNotes}</p>
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
      </div>

      {/* Debt & Credit Info */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          Medical Debt & Credit (Educational)
        </h4>
        <ul className="space-y-1">
          {analysis.debtAndCreditInfo.map((info, idx) => (
            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2 p-2 rounded bg-muted/20">
              <span className="text-primary">•</span>
              {info}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function BillingSection({ analysis, hasEOB }: BillingSectionProps) {
  // Generate teasers
  const thingsToKnowTeaser = `Understanding your bill in ${analysis.stateHelp.state}`;
  const nextStepsTeaser = analysis.billingIssues.length > 0 
    ? `${analysis.billingIssues.length} items to review` 
    : 'Financial assistance and templates';

  return (
    <div className="space-y-3">
      {/* A. Things to Know About Your Bill */}
      <SubcategoryCard
        icon={<DollarSign className="h-5 w-5 text-success" />}
        title="Things to Know About Your Bill"
        teaser={thingsToKnowTeaser}
        badge={hasEOB ? 'EOB Enhanced' : undefined}
        badgeVariant="success"
        defaultOpen={false}
      >
        <div className="space-y-4">
          {/* Short summary bullets */}
          <BillingSummaryBullets analysis={analysis} hasEOB={hasEOB} />
          
          {/* Expandable full breakdown */}
          <ThingsToKnowExpander analysis={analysis} hasEOB={hasEOB} />
        </div>
      </SubcategoryCard>

      {/* B. Next Steps */}
      <SubcategoryCard
        icon={<CheckSquare className="h-5 w-5 text-success" />}
        title="Next Steps"
        teaser={nextStepsTeaser}
        badge={analysis.billingIssues.length > 0 ? `${analysis.billingIssues.length} items` : undefined}
        badgeVariant="warning"
        defaultOpen={false}
      >
        <div className="space-y-6">
          {/* Issues to Review */}
          {analysis.billingIssues.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Things Worth Asking About
              </h4>
              <p className="text-xs text-muted-foreground italic">
                These aren't necessarily errors, but you may want to clarify them:
              </p>
              <div className="space-y-2">
                {analysis.billingIssues.map((issue, idx) => (
                  <IssueCard key={idx} issue={issue} />
                ))}
              </div>
            </div>
          )}

          {/* Financial Opportunities */}
          {analysis.financialOpportunities.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Heart className="h-4 w-4 text-success" />
                Financial Assistance You May Qualify For
              </h4>
              <div className="space-y-2">
                {analysis.financialOpportunities.map((opp, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-success/5 border border-success/20">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h5 className="text-sm font-medium text-foreground">{opp.title}</h5>
                      <Badge variant="outline" className="shrink-0 text-xs capitalize">
                        {opp.effortLevel.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{opp.description}</p>
                    <p className="text-xs text-muted-foreground italic">{opp.eligibilityHint}</p>
                    {opp.link && (
                      <a
                        href={opp.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-2"
                      >
                        Apply now <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Templates */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              What to Say When You Call
            </h4>

            {analysis.billingTemplates.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Building className="h-3 w-3" /> To the Billing Department
                </p>
                {analysis.billingTemplates.map((template, idx) => (
                  <TemplateCard key={idx} template={template} />
                ))}
              </div>
            )}

            {analysis.insuranceTemplates.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Shield className="h-3 w-3" /> To Your Insurance Company
                </p>
                {analysis.insuranceTemplates.map((template, idx) => (
                  <TemplateCard key={idx} template={template} />
                ))}
              </div>
            )}
          </div>
        </div>
      </SubcategoryCard>
    </div>
  );
}

// Expandable "View full breakdown" component
function ThingsToKnowExpander({ analysis, hasEOB }: { analysis: AnalysisResult; hasEOB: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-primary hover:underline font-medium"
      >
        {isExpanded ? 'Hide full breakdown' : 'View full breakdown'}
        <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
      </button>
      
      {isExpanded && <BillingFullBreakdown analysis={analysis} hasEOB={hasEOB} />}
    </div>
  );
}
