import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, BillingIssue, ContactTemplate } from '@/types';
import { useState } from 'react';
import { toast } from 'sonner';

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
          <div className="flex items-center gap-2">
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
    <div className="p-4 rounded-lg border border-border/50 bg-muted/20">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-foreground">{template.purpose}</h4>
        <Badge variant="outline" className="shrink-0 text-xs">
          {template.target === 'billing' ? <Building className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
          {template.target === 'billing' ? 'Billing' : 'Insurance'}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{template.whenToUse}</p>
      <div className="p-3 rounded-md bg-card border border-border/30 mb-2">
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

export function BillingSection({ analysis, hasEOB }: BillingSectionProps) {
  return (
    <Accordion type="multiple" defaultValue={['billing-info', 'next-steps']} className="space-y-3">
      {/* A. Things to Know About Your Bill */}
      <AccordionItem value="billing-info" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-foreground">Things to Know About Your Bill</span>
            {hasEOB && (
              <Badge className="ml-auto mr-2 bg-success/10 text-success border-success/20">
                EOB Enhanced
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4 pt-2">
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

            {/* EOB Summary if available */}
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
              <p className="text-xs text-muted-foreground italic">General information about your rights:</p>
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
        </AccordionContent>
      </AccordionItem>

      {/* B. Next Steps */}
      <AccordionItem value="next-steps" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <CheckSquare className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-foreground">Next Steps</span>
            {analysis.billingIssues.length > 0 && (
              <Badge variant="outline" className="ml-auto mr-2 border-warning/30 text-warning-foreground">
                {analysis.billingIssues.length} items to review
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-6 pt-2">
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
