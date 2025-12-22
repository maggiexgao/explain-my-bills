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
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, ContactTemplate, ActionStep, ProviderContactInfo, DisputePackageEligibility, ReferralContext } from '@/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { SubcategoryCard } from './SubcategoryCard';
import { useTranslation } from '@/i18n/LanguageContext';
import { DisputePackageUpsell } from './DisputePackageUpsell';
import { ReferralServices } from './ReferralServices';

interface NextStepsSectionProps {
  analysis: AnalysisResult;
}

function ContactInfoCard({ contactInfo, type }: { contactInfo: ProviderContactInfo; type: 'billing' | 'insurance' }) {
  const { t } = useTranslation();
  
  const isBilling = type === 'billing';
  const name = isBilling ? contactInfo.providerName : contactInfo.insurerName;
  const phone = isBilling ? contactInfo.billingPhone : contactInfo.memberServicesPhone;
  const email = isBilling ? contactInfo.billingEmail : contactInfo.memberServicesEmail;
  const address = isBilling ? contactInfo.mailingAddress : undefined;
  
  if (!name && !phone && !email && !address) return null;
  
  return (
    <div className="p-4 rounded-xl border border-border/30 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center gap-2 mb-3">
        {isBilling ? (
          <Building className="h-4 w-4 text-primary" />
        ) : (
          <Shield className="h-4 w-4 text-primary" />
        )}
        <h4 className="text-sm font-semibold text-foreground">
          {isBilling ? t('nextSteps.providerContact') : t('nextSteps.insurerContact')}
        </h4>
      </div>
      
      <div className="space-y-2">
        {name && (
          <p className="text-sm font-medium text-foreground">{name}</p>
        )}
        
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {phone && (
            <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <Phone className="h-3.5 w-3.5" />
              {phone}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <Mail className="h-3.5 w-3.5" />
              {email}
            </a>
          )}
        </div>
        
        {address && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5 mt-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {address}
          </p>
        )}
      </div>
    </div>
  );
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
      
      {/* Contact Information from template */}
      {template.contactInfo && (template.contactInfo.phone || template.contactInfo.email) && (
        <div className="mb-3 p-2 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-xs font-medium text-primary mb-1">{t('nextSteps.contactInfo')}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {template.contactInfo.name && (
              <span className="font-medium text-foreground">{template.contactInfo.name}</span>
            )}
            {template.contactInfo.phone && (
              <a href={`tel:${template.contactInfo.phone.replace(/[^0-9+]/g, '')}`} className="flex items-center gap-1 hover:text-primary">
                <Phone className="h-3 w-3" />
                {template.contactInfo.phone}
              </a>
            )}
            {template.contactInfo.email && (
              <a href={`mailto:${template.contactInfo.email}`} className="flex items-center gap-1 hover:text-primary">
                <Mail className="h-3 w-3" />
                {template.contactInfo.email}
              </a>
            )}
          </div>
          {template.contactInfo.address && (
            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
              <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
              {template.contactInfo.address}
            </p>
          )}
        </div>
      )}
      
      <p className="text-xs text-muted-foreground mb-3">{t('nextSteps.whenToUse')}: {template.whenToUse}</p>
      
      {/* Template in selected language */}
      <div className="p-3 rounded-lg bg-background border border-border/30 mb-3">
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {template.template}
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
              {template.templateEnglish}
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
  const providerContactInfo = analysis.providerContactInfo;
  const actionSteps = analysis.actionSteps || [];
  const billingTemplates = analysis.billingTemplates || [];
  const insuranceTemplates = analysis.insuranceTemplates || [];
  const whenToSeekHelp = analysis.whenToSeekHelp || [];

  // Compute dispute package eligibility from analysis
  const disputePackageEligibility = analysis.disputePackageEligibility || computeDisputeEligibility(analysis);
  
  // Compute referral context from analysis
  const referralContext = analysis.referralContext || computeReferralContext(analysis);

  return (
    <div className="space-y-3">
      {/* Dispute Package Upsell - shown first if eligible */}
      {disputePackageEligibility.eligible && (
        <DisputePackageUpsell 
          eligibility={disputePackageEligibility} 
          analysis={analysis} 
        />
      )}

      {/* Provider Contact Information */}
      {providerContactInfo && (providerContactInfo.billingPhone || providerContactInfo.insurerName) && (
        <SubcategoryCard
          icon={<Phone className="h-5 w-5 text-primary" />}
          title={t('nextSteps.contactDetails')}
          teaser="How to reach your provider and insurance"
          defaultOpen={true}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <ContactInfoCard contactInfo={providerContactInfo} type="billing" />
            {providerContactInfo.insurerName && (
              <ContactInfoCard contactInfo={providerContactInfo} type="insurance" />
            )}
          </div>
        </SubcategoryCard>
      )}

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
        icon={<Mail className="h-5 w-5 text-purple" />}
        title={t('nextSteps.contactTemplates')}
        teaser="Ready-to-send messages for billing and insurance"
        badge="2 templates"
        defaultOpen={false}
      >
        <div className="space-y-4">
          {billingTemplates.length > 0 && (
            <TemplateCard template={billingTemplates[0]} />
          )}

          {insuranceTemplates.length > 0 && (
            <TemplateCard template={insuranceTemplates[0]} />
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

      {/* Referral Services - shown when context indicates it's helpful */}
      {referralContext.showReferrals && (
        <SubcategoryCard
          icon={<LifeBuoy className="h-5 w-5 text-coral" />}
          title="Helpful Services"
          teaser="Vetted resources that may be able to assist you"
          defaultOpen={false}
        >
          <ReferralServices context={referralContext} />
        </SubcategoryCard>
      )}

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

// Helper function to compute dispute package eligibility from analysis
function computeDisputeEligibility(analysis: AnalysisResult): DisputePackageEligibility {
  const hasErrors = (analysis.potentialErrors?.length || 0) > 0;
  const hasDenials = analysis.potentialErrors?.some(e => 
    e.title.toLowerCase().includes('denial') || 
    e.description.toLowerCase().includes('denied')
  ) || false;
  const hasNoSurprisesActScenario = analysis.potentialErrors?.some(e =>
    e.description.toLowerCase().includes('no surprises') ||
    e.description.toLowerCase().includes('out-of-network') ||
    e.description.toLowerCase().includes('surprise bill')
  ) || false;
  
  // Estimate balance from EOB or charges
  const estimatedBalance = analysis.eobData?.patientResponsibility || 
    analysis.charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
  
  const isHighBalance = estimatedBalance >= 1000;
  
  const reasons: string[] = [];
  if (hasErrors) {
    reasons.push(`We found ${analysis.potentialErrors?.length || 0} potential billing error(s) that may warrant a formal dispute`);
  }
  if (isHighBalance) {
    reasons.push(`Your estimated balance of $${estimatedBalance.toLocaleString()} is significant and worth disputing if incorrect`);
  }
  if (hasDenials) {
    reasons.push('There appears to be a denial that may be appealable');
  }
  if (hasNoSurprisesActScenario) {
    reasons.push('This may involve the No Surprises Act which provides specific protections');
  }
  
  const eligible = hasErrors || isHighBalance || hasDenials || hasNoSurprisesActScenario;
  
  return {
    eligible,
    reasons,
    estimatedBalance,
    hasErrors,
    hasDenials,
    hasNoSurprisesActScenario,
  };
}

// Helper function to compute referral context from analysis
function computeReferralContext(analysis: AnalysisResult): ReferralContext {
  const estimatedBalance = analysis.eobData?.patientResponsibility || 
    analysis.charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
  
  const isHighBalance = estimatedBalance >= 1000;
  const hasComplexDispute = (analysis.potentialErrors?.length || 0) >= 2;
  const hasDenial = analysis.potentialErrors?.some(e => 
    e.title.toLowerCase().includes('denial') || 
    e.description.toLowerCase().includes('denied')
  ) || false;
  const hasNoSurprisesActScenario = analysis.potentialErrors?.some(e =>
    e.description.toLowerCase().includes('no surprises') ||
    e.description.toLowerCase().includes('out-of-network')
  ) || false;
  
  const showReferrals = isHighBalance || hasComplexDispute || hasDenial || hasNoSurprisesActScenario;
  
  return {
    showReferrals,
    balanceAmount: estimatedBalance,
    isHighBalance,
    hasComplexDispute,
    hasDenial,
    hasNoSurprisesActScenario,
    recommendedServices: [], // Will use defaults in the component
  };
}