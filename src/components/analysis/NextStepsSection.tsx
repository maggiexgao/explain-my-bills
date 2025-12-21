import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckSquare,
  Copy,
  Building,
  Shield,
  Phone,
  LifeBuoy,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, ContactTemplate, ActionStep } from '@/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { SubcategoryCard } from './SubcategoryCard';

interface NextStepsSectionProps {
  analysis: AnalysisResult;
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
    <div className="p-4 rounded-xl border border-border/30 bg-muted/10">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-foreground">{template.purpose}</h4>
        <Badge variant="outline" className="shrink-0 text-xs">
          {template.target === 'billing' ? <Building className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
          {template.target === 'billing' ? 'Billing' : 'Insurance'}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{template.whenToUse}</p>
      <div className="p-3 rounded-lg bg-background border border-border/30 mb-3">
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
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

function ActionStepCard({ step }: { step: ActionStep }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/20 border border-border/30">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint text-mint-foreground text-sm font-semibold">
        {step.order}
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-medium text-foreground mb-1">{step.action}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{step.details}</p>
        {step.relatedIssue && (
          <p className="text-xs text-muted-foreground mt-2 italic">
            Related to: {step.relatedIssue}
          </p>
        )}
      </div>
    </div>
  );
}

export function NextStepsSection({ analysis }: NextStepsSectionProps) {
  const actionSteps = analysis.actionSteps || [];
  const billingTemplates = analysis.billingTemplates || [];
  const insuranceTemplates = analysis.insuranceTemplates || [];
  const whenToSeekHelp = analysis.whenToSeekHelp || [];

  return (
    <div className="space-y-3">
      {/* Action Plan */}
      <SubcategoryCard
        icon={<CheckSquare className="h-5 w-5 text-mint" />}
        title="Your Action Plan"
        teaser={actionSteps.length > 0 ? `${actionSteps.length} recommended steps` : 'Review and take action'}
        badge={actionSteps.length > 0 ? `${actionSteps.length} steps` : undefined}
        badgeVariant="success"
        defaultOpen={true}
      >
        <div className="space-y-3">
          {actionSteps.length > 0 ? (
            actionSteps.map((step, idx) => (
              <ActionStepCard key={idx} step={step} />
            ))
          ) : (
            <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
              <p className="text-sm text-muted-foreground">
                Review the billing section for financial assistance options and use the templates below to contact your provider or insurer.
              </p>
            </div>
          )}
        </div>
      </SubcategoryCard>

      {/* Call Templates */}
      <SubcategoryCard
        icon={<Phone className="h-5 w-5 text-mint" />}
        title="What to Say When You Call"
        teaser="Copy-and-paste templates for billing and insurance"
        badge={`${billingTemplates.length + insuranceTemplates.length} templates`}
        defaultOpen={false}
      >
        <div className="space-y-5">
          {billingTemplates.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Building className="h-3 w-3" /> To the Billing Department
              </p>
              {billingTemplates.map((template, idx) => (
                <TemplateCard key={idx} template={template} />
              ))}
            </div>
          )}

          {insuranceTemplates.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Shield className="h-3 w-3" /> To Your Insurance Company
              </p>
              {insuranceTemplates.map((template, idx) => (
                <TemplateCard key={idx} template={template} />
              ))}
            </div>
          )}
        </div>
      </SubcategoryCard>

      {/* When to Seek Extra Help */}
      {whenToSeekHelp.length > 0 && (
        <SubcategoryCard
          icon={<LifeBuoy className="h-5 w-5 text-mint" />}
          title="When to Seek Extra Help"
          teaser="Resources for additional support"
          defaultOpen={false}
        >
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Consider reaching out to these resources if you need more support:
            </p>
            {whenToSeekHelp.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-muted/20 border border-border/30">
                <ArrowRight className="h-4 w-4 text-mint shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{item}</p>
              </div>
            ))}
          </div>
        </SubcategoryCard>
      )}
    </div>
  );
}
