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
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, ContactTemplate, ActionStep } from '@/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { SubcategoryCard } from './SubcategoryCard';
import { useTranslation } from '@/i18n/LanguageContext';

interface NextStepsSectionProps {
  analysis: AnalysisResult;
}

function TemplateCard({ template }: { template: ContactTemplate }) {
  const [copied, setCopied] = useState(false);
  const { t, language } = useTranslation();
  const isNonEnglish = language !== 'en';

  const copyTemplate = (text?: string) => {
    navigator.clipboard.writeText(text || template.template);
    setCopied(true);
    toast.success(t('nextSteps.copied'));
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
      
      {/* Contact Information */}
      {template.contactInfo && (template.contactInfo.phone || template.contactInfo.email) && (
        <div className="mb-3 p-2 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-xs font-medium text-primary mb-1">{t('nextSteps.contactInfo')}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {template.contactInfo.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {template.contactInfo.phone}
              </span>
            )}
            {template.contactInfo.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {template.contactInfo.email}
              </span>
            )}
          </div>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground mb-3">{t('nextSteps.whenToUse')}: {template.whenToUse}</p>
      
      {/* Template in selected language */}
      <div className="p-3 rounded-lg bg-background border border-border/30 mb-3">
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          "{template.template}"
        </p>
      </div>
      
      {/* English translation for non-English languages */}
      {isNonEnglish && template.templateEnglish && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-2 italic">
            {t('nextSteps.englishTranslation')}:
          </p>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/20 ml-3">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              "{template.templateEnglish}"
            </p>
          </div>
        </div>
      )}
      
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyTemplate()}
          className="text-xs h-7"
        >
          <Copy className="h-3 w-3 mr-1" />
          {copied ? t('nextSteps.copied') : t('nextSteps.copyTemplate')}
        </Button>
        
        {isNonEnglish && template.templateEnglish && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyTemplate(template.templateEnglish)}
            className="text-xs h-7 text-muted-foreground"
          >
            <Copy className="h-3 w-3 mr-1" />
            {t('nextSteps.copyEnglish')}
          </Button>
        )}
      </div>
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
  const { t } = useTranslation();
  const actionSteps = analysis.actionSteps || [];
  const billingTemplates = analysis.billingTemplates || [];
  const insuranceTemplates = analysis.insuranceTemplates || [];
  const whenToSeekHelp = analysis.whenToSeekHelp || [];

  return (
    <div className="space-y-3">
      <SubcategoryCard
        icon={<CheckSquare className="h-5 w-5 text-mint" />}
        title={t('nextSteps.actionPlan')}
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
                Review the billing section for financial assistance options.
              </p>
            </div>
          )}
        </div>
      </SubcategoryCard>

      <SubcategoryCard
        icon={<Phone className="h-5 w-5 text-purple" />}
        title={`${t('nextSteps.billingTemplates')} / ${t('nextSteps.insuranceTemplates')}`}
        teaser="Copy-and-paste templates for calls"
        badge={`${billingTemplates.length + insuranceTemplates.length} templates`}
        defaultOpen={false}
      >
        <div className="space-y-5">
          {billingTemplates.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Building className="h-3 w-3" /> {t('nextSteps.billingTemplates')}
              </p>
              {billingTemplates.map((template, idx) => (
                <TemplateCard key={idx} template={template} />
              ))}
            </div>
          )}

          {insuranceTemplates.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Shield className="h-3 w-3" /> {t('nextSteps.insuranceTemplates')}
              </p>
              {insuranceTemplates.map((template, idx) => (
                <TemplateCard key={idx} template={template} />
              ))}
            </div>
          )}
          
          {billingTemplates.length === 0 && insuranceTemplates.length === 0 && (
            <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
              <p className="text-sm text-muted-foreground">
                No specific call templates were generated for this bill.
              </p>
            </div>
          )}
        </div>
      </SubcategoryCard>

      <SubcategoryCard
        icon={<LifeBuoy className="h-5 w-5 text-coral" />}
        title={t('nextSteps.whenToSeekHelp')}
        teaser="Resources for additional support"
        defaultOpen={false}
      >
        <div className="space-y-3">
          {whenToSeekHelp.length > 0 ? (
            whenToSeekHelp.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-muted/20 border border-border/30">
                <ArrowRight className="h-4 w-4 text-coral shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{item}</p>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/20 border border-border/30">
                <ArrowRight className="h-4 w-4 text-coral shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  If you receive a collection notice, consult with a consumer law attorney.
                </p>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/20 border border-border/30">
                <ArrowRight className="h-4 w-4 text-coral shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Many hospitals have patient advocates who can help navigate billing issues.
                </p>
              </div>
            </div>
          )}
        </div>
      </SubcategoryCard>
    </div>
  );
}