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
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, BillingIssue } from '@/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { SubcategoryCard } from './SubcategoryCard';
import { useTranslation } from '@/i18n/LanguageContext';
import { MedicareBenchmarkSection } from './MedicareBenchmarkSection';

interface BillingSectionProps {
  analysis: AnalysisResult;
  hasEOB: boolean;
  selectedState?: string;
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
  const { t } = useTranslation();

  const copyQuestion = () => {
    navigator.clipboard.writeText(issue.suggestedQuestion);
    setCopied(true);
    toast.success(t('nextSteps.copied'));
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
            {copied ? t('nextSteps.copied') : t('nextSteps.copyTemplate')}
          </Button>
        </div>
      </div>
    </div>
  );
}


function BillingEducationPreview({ analysis, hasEOB }: { analysis: AnalysisResult; hasEOB: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          {t('billing.education.billedVsAllowed')}
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
              <span className="text-xs font-medium text-success">{t('billing.education.eobSummary')}</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {analysis.billingEducation.eobSummary}
            </p>
          </div>
        )}
      </div>

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-primary hover:underline font-medium"
      >
        {isExpanded ? t('common.collapse') : t('common.learnMore')}
        <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
      </button>
      
      {isExpanded && (
        <div className="space-y-3 pt-3 border-t border-border/30 animate-fade-in">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
            <h5 className="text-xs font-medium text-foreground mb-2">{t('billing.education.deductible')}</h5>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.billingEducation.deductibleExplanation}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
            <h5 className="text-xs font-medium text-foreground mb-2">{t('billing.education.copayCoinsurance')}</h5>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.billingEducation.copayCoinsurance}
            </p>
          </div>
          
          {hasEOB && analysis.eobData && (
            <div className="space-y-3 pt-3">
              <h5 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                {t('billing.eobComparison')}
              </h5>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground">{t('billing.eobComparison.billed')}</p>
                  <p className="text-lg font-semibold text-foreground">${analysis.eobData.billedAmount.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground">{t('billing.eobComparison.allowed')}</p>
                  <p className="text-lg font-semibold text-foreground">${analysis.eobData.allowedAmount.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-success/5 border border-success/20">
                  <p className="text-xs text-muted-foreground">{t('billing.eobComparison.insurancePaid')}</p>
                  <p className="text-lg font-semibold text-success">${analysis.eobData.insurancePaid.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-warning/5 border border-warning/20">
                  <p className="text-xs text-muted-foreground">{t('billing.eobComparison.yourResponsibility')}</p>
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

export function BillingSection({ analysis, hasEOB, selectedState }: BillingSectionProps) {
  const { t } = useTranslation();
  const hasCptCodes = (analysis.cptCodes || []).length > 0;
  const stateCode = selectedState || analysis.stateHelp?.state || 'CA';
  
  // Defensive defaults for potentially missing data
  const stateHelp = analysis.stateHelp || {
    state: stateCode,
    medicaidInfo: { description: 'Medicaid provides health coverage for eligible low-income individuals.', eligibilityLink: 'https://www.medicaid.gov/' },
    debtProtections: [],
    reliefPrograms: []
  };
  
  const providerAssistance = analysis.providerAssistance || {
    providerName: 'Your Healthcare Provider',
    charityCareSummary: 'Many providers offer financial assistance programs.',
    eligibilityNotes: 'Contact the billing department for more information.',
    incomeThresholds: [],
    requiredDocuments: [],
    financialAssistanceLink: undefined
  };
  
  const debtAndCreditInfo = analysis.debtAndCreditInfo || [];
  const billingEducation = analysis.billingEducation || {
    billedVsAllowed: 'The billed amount is what the provider charges. Insurance negotiates a lower "allowed amount."',
    deductibleExplanation: 'Your deductible is the amount you pay before insurance starts covering costs.',
    copayCoinsurance: 'A copay is a flat fee. Coinsurance is a percentage you pay after your deductible.',
    eobSummary: null
  };

  return (
    <div className="space-y-3">
      {/* Medicare Benchmark Section - show when we have CPT codes */}
      {hasCptCodes && (
        <SubcategoryCard
          icon={<Activity className="h-5 w-5 text-primary" />}
          title="Medicare Benchmark"
          teaser="How your charges compare to Medicare rates"
          badge="New"
          badgeVariant="default"
          defaultOpen={true}
        >
          <MedicareBenchmarkSection analysis={analysis} state={stateCode} />
        </SubcategoryCard>
      )}

      <SubcategoryCard
        icon={<HelpCircle className="h-5 w-5 text-purple" />}
        title={t('billing.education')}
        teaser="Understanding how medical billing works"
        badge={hasEOB ? 'EOB Enhanced' : undefined}
        badgeVariant="success"
        defaultOpen={!hasCptCodes}
      >
        <BillingEducationPreview analysis={analysis} hasEOB={hasEOB} />
      </SubcategoryCard>

      <SubcategoryCard
        icon={<Heart className="h-5 w-5 text-coral" />}
        title={`${t('billing.stateHelp')} - ${stateHelp.state}`}
        teaser="State programs and protections"
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-success/5 border border-success/20">
            <p className="text-xs font-medium text-success mb-2">{t('billing.stateHelp.medicaid')}</p>
            <p className="text-sm text-muted-foreground mb-3">{stateHelp.medicaidInfo?.description || 'Medicaid provides health coverage for eligible low-income individuals.'}</p>
            <a
              href={stateHelp.medicaidInfo?.eligibilityLink || 'https://www.medicaid.gov/'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Check eligibility <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          
          {(stateHelp.reliefPrograms || []).map((program, idx) => (
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
                  {t('common.learnMore')} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </SubcategoryCard>

      <SubcategoryCard
        icon={<Building className="h-5 w-5 text-mint" />}
        title={t('billing.providerAssistance')}
        teaser={`Assistance from ${providerAssistance.providerName}`}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
            <p className="text-xs font-medium text-foreground mb-2">{providerAssistance.providerName}</p>
            <p className="text-sm text-muted-foreground mb-3">{providerAssistance.charityCareSummary}</p>
            <p className="text-xs text-muted-foreground italic mb-3">{providerAssistance.eligibilityNotes}</p>
            
            {Array.isArray(providerAssistance.incomeThresholds) && providerAssistance.incomeThresholds.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-foreground mb-1">Income Thresholds:</p>
                <ul className="space-y-1">
                  {providerAssistance.incomeThresholds.map((threshold, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {threshold}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {Array.isArray(providerAssistance.requiredDocuments) && providerAssistance.requiredDocuments.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-foreground mb-1">Documents You May Need:</p>
                <ul className="space-y-1">
                  {providerAssistance.requiredDocuments.map((doc, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {providerAssistance.financialAssistanceLink && (
              <a
                href={providerAssistance.financialAssistanceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                View assistance policy <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </SubcategoryCard>

      <SubcategoryCard
        icon={<Scale className="h-5 w-5 text-primary" />}
        title={`Medical Debt in ${stateHelp.state}`}
        teaser={`What you should know about medical debt in ${stateHelp.state}`}
        defaultOpen={false}
      >
        <div className="space-y-4">
          {/* State Debt Protections */}
          {(stateHelp.debtProtections || []).length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-foreground flex items-center gap-2">
                <Shield className="h-3 w-3 text-success" />
                State Debt Protections
              </h5>
              {(stateHelp.debtProtections || []).map((protection, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-success/5 border border-success/20">
                  <p className="text-sm text-muted-foreground">{protection}</p>
                </div>
              ))}
            </div>
          )}
          
          {/* General Debt & Credit Info */}
          <div className="space-y-2">
            {debtAndCreditInfo.length > 0 ? (
              <ul className="space-y-2">
                {debtAndCreditInfo.map((info, idx) => (
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
                </p>
              </div>
            )}
          </div>
        </div>
      </SubcategoryCard>
    </div>
  );
}