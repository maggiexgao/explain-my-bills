import { Badge } from '@/components/ui/badge';
import {
  Eye,
  TrendingDown,
  MessageSquare,
  FileText,
  Scale,
  DollarSign,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult } from '@/types';
import { AtAGlanceSection } from '@/components/analysis/AtAGlanceSection';
import { ThingsWorthReviewingSection } from '@/components/analysis/ThingsWorthReviewingSection';
import { SavingsSection } from '@/components/analysis/SavingsSection';
import { WhatToSaySection } from '@/components/analysis/WhatToSaySection';
import { ChargeMeaningsSection } from '@/components/analysis/ChargeMeaningsSection';
import { NegotiabilitySection } from '@/components/analysis/NegotiabilitySection';
import { PriceContextSection } from '@/components/analysis/PriceContextSection';
import { PondNextStepsSection } from '@/components/analysis/PondNextStepsSection';
import { useState } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';

interface ExplanationPanelProps {
  analysis: AnalysisResult;
  onHoverCharge: (chargeId: string | null) => void;
  hasEOB?: boolean;
  selectedState?: string;
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

export function ExplanationPanel({ analysis, onHoverCharge, hasEOB = false, selectedState }: ExplanationPanelProps) {
  const { t } = useTranslation();
  
  // Check if we have the new Pond structure
  const hasPondStructure = !!analysis.atAGlance;
  
  // Determine if there are items worth reviewing
  const hasReviewItems = (analysis.thingsWorthReviewing?.length || 0) > 0;
  const hasSavingsOpportunities = (analysis.savingsOpportunities?.length || 0) > 0;

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-5">
        {/* Section 1: At a Glance (always visible at top) */}
        {hasPondStructure && analysis.atAGlance && (
          <AtAGlanceSection atAGlance={analysis.atAGlance} />
        )}

        {/* Pond Sections */}
        <div className="space-y-4">
          {/* Section 2: Things Worth Reviewing */}
          <AccordionSection
            title="Things Worth Reviewing"
            subtitle={hasReviewItems ? "Actionable items to check" : "Nothing major found"}
            icon={<Eye className="h-5 w-5 text-warning" />}
            iconBg="bg-warning/10"
            badge={
              hasReviewItems ? (
                <Badge className="bg-warning/10 text-warning-foreground text-xs">
                  {analysis.thingsWorthReviewing?.length} items
                </Badge>
              ) : undefined
            }
            defaultOpen={hasReviewItems}
          >
            <ThingsWorthReviewingSection 
              items={analysis.thingsWorthReviewing || []} 
              reviewSectionNote={analysis.reviewSectionNote}
            />
          </AccordionSection>

          {/* Section 3: How This Bill Could Be Lowered */}
          <AccordionSection
            title="How This Bill Could Be Lowered"
            subtitle="Savings opportunities to explore"
            icon={<TrendingDown className="h-5 w-5 text-success" />}
            iconBg="bg-success/10"
            badge={
              hasSavingsOpportunities ? (
                <Badge className="bg-success/10 text-success text-xs">
                  {analysis.savingsOpportunities?.length} opportunities
                </Badge>
              ) : undefined
            }
            defaultOpen={hasSavingsOpportunities}
          >
            <SavingsSection opportunities={analysis.savingsOpportunities || []} />
          </AccordionSection>

          {/* Section 4: What to Say Next */}
          <AccordionSection
            title="What to Say Next"
            subtitle="Ready-to-use conversation scripts"
            icon={<MessageSquare className="h-5 w-5 text-primary" />}
            iconBg="bg-primary/10"
            defaultOpen={false}
          >
            <WhatToSaySection scripts={analysis.conversationScripts || {
              firstCallScript: "Hi, I'm calling about my bill. I'd like to understand the charges before making payment.",
              ifTheyPushBack: "I understand. Can you transfer me to someone who can explain the itemization?",
              whoToAskFor: "Ask for the billing department.",
            }} />
          </AccordionSection>

          {/* Section 5: What These Charges Mean (collapsed by default) */}
          <AccordionSection
            title="What These Charges Mean"
            subtitle="Plain-language explanations"
            icon={<FileText className="h-5 w-5 text-purple" />}
            iconBg="bg-purple/10"
            badge={
              (analysis.chargeMeanings?.length || 0) > 0 ? (
                <Badge className="bg-purple/10 text-purple text-xs">
                  {analysis.chargeMeanings?.length} charges
                </Badge>
              ) : undefined
            }
            defaultOpen={false}
          >
            <ChargeMeaningsSection meanings={analysis.chargeMeanings || []} />
          </AccordionSection>

          {/* Section 6: Is This Negotiable? */}
          <AccordionSection
            title="Is This Negotiable?"
            subtitle="What's typically flexible"
            icon={<Scale className="h-5 w-5 text-info" />}
            iconBg="bg-info/10"
            defaultOpen={false}
          >
            <NegotiabilitySection items={analysis.negotiability || []} />
          </AccordionSection>

          {/* Section 7: Price Context */}
          <AccordionSection
            title="Price Context"
            subtitle="How your charges compare"
            icon={<DollarSign className="h-5 w-5 text-mint" />}
            iconBg="bg-mint/10"
            defaultOpen={false}
          >
            <PriceContextSection priceContext={analysis.priceContext || {
              hasBenchmarks: false,
              comparisons: [],
              fallbackMessage: "Price comparison data isn't available yet, but this category is commonly reviewed or negotiated.",
            }} />
          </AccordionSection>

          {/* Section 8 & 9: Next Steps + Closing Reassurance */}
          <AccordionSection
            title="Next Steps"
            subtitle="What to do now"
            icon={<ArrowRight className="h-5 w-5 text-coral" />}
            iconBg="bg-coral/10"
            badge={
              (analysis.pondNextSteps?.length || 0) > 0 ? (
                <Badge className="bg-coral/10 text-coral text-xs">
                  {analysis.pondNextSteps?.length} steps
                </Badge>
              ) : undefined
            }
            defaultOpen={true}
          >
            <PondNextStepsSection 
              steps={analysis.pondNextSteps || []} 
              closingReassurance={analysis.closingReassurance || "Medical bills are often negotiable, and asking questions is normal. You're not being difficult — you're being careful."}
            />
          </AccordionSection>
        </div>
      </div>
    </div>
  );
}
