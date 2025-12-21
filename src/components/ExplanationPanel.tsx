import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  BookOpen,
  Receipt,
  ArrowRight,
  FileCheck,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult } from '@/types';
import { ImmediateCalloutsSection } from '@/components/analysis/ImmediateCalloutsSection';
import { ExplainerSection } from '@/components/analysis/ExplainerSection';
import { BillingSection } from '@/components/analysis/BillingSection';
import { NextStepsSection } from '@/components/analysis/NextStepsSection';
import { useState } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';

interface ExplanationPanelProps {
  analysis: AnalysisResult;
  onHoverCharge: (chargeId: string | null) => void;
  hasEOB?: boolean;
}

interface AccordionSectionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function AccordionSection({ title, subtitle, icon, iconBg, badge, defaultOpen = false, children }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-border/40 bg-card shadow-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-4 p-5 transition-colors",
          "hover:bg-muted/20",
          isOpen && "border-b border-border/40"
        )}
      >
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", iconBg)}>
          {icon}
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-foreground text-base">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {badge}
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      
      <div
        className={cn(
          "grid transition-all duration-300",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className={cn("p-5", !isOpen && "invisible")}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExplanationPanel({ analysis, onHoverCharge, hasEOB = false }: ExplanationPanelProps) {
  const { t } = useTranslation();
  const hasCallouts = (analysis.potentialErrors?.length || 0) + (analysis.needsAttention?.length || 0) > 0;
  const calloutCount = (analysis.potentialErrors?.length || 0) + (analysis.needsAttention?.length || 0);

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-5">
        {/* Document Summary Header */}
        <div className="p-5 rounded-2xl accent-gradient border border-border/40">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">{t('app.title')} Analysis</h2>
            {hasEOB && (
              <Badge className="bg-mint-light text-mint border-mint/20">
                <FileCheck className="h-3 w-3 mr-1" />
                EOB Enhanced
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{analysis.issuer}</span>
            <span className="text-border">•</span>
            <span>{analysis.dateOfService}</span>
          </div>
        </div>

        {/* Four Main Sections */}
        <div className="space-y-4">
          <AccordionSection
            title={t('section.immediateCallouts')}
            subtitle={t('section.immediateCallouts.subtitle')}
            icon={<AlertCircle className="h-5 w-5 text-coral" />}
            iconBg="bg-coral-light"
            badge={
              hasCallouts ? (
                <Badge className="bg-coral-light text-coral border-0 text-xs">
                  {calloutCount} items
                </Badge>
              ) : undefined
            }
            defaultOpen={hasCallouts}
          >
            <ImmediateCalloutsSection analysis={analysis} />
          </AccordionSection>

          <AccordionSection
            title={t('section.explainer')}
            subtitle={t('section.explainer.subtitle')}
            icon={<BookOpen className="h-5 w-5 text-purple" />}
            iconBg="bg-purple-light"
            defaultOpen={false}
          >
            <ExplainerSection analysis={analysis} />
          </AccordionSection>

          <AccordionSection
            title={t('section.billing')}
            subtitle={t('section.billing.subtitle')}
            icon={<Receipt className="h-5 w-5 text-primary" />}
            iconBg="bg-primary-light"
            badge={
              hasEOB ? (
                <Badge className="bg-mint-light text-mint border-0 text-xs">
                  EOB data
                </Badge>
              ) : undefined
            }
            defaultOpen={false}
          >
            <BillingSection analysis={analysis} hasEOB={hasEOB} />
          </AccordionSection>

          <AccordionSection
            title={t('section.nextSteps')}
            subtitle={t('section.nextSteps.subtitle')}
            icon={<ArrowRight className="h-5 w-5 text-mint" />}
            iconBg="bg-mint-light"
            defaultOpen={false}
          >
            <NextStepsSection analysis={analysis} />
          </AccordionSection>
        </div>
      </div>
    </div>
  );
}
