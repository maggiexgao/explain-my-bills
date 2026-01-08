import { cn } from '@/lib/utils';
import { AnalysisResult } from '@/types';
import { BillSummaryHero } from '@/components/analysis/BillSummaryHero';
import { CostDriversGroup } from '@/components/analysis/CostDriversGroup';
import { PriceComparisonGroup } from '@/components/analysis/PriceComparisonGroup';
import { ActionGroup } from '@/components/analysis/ActionGroup';
import { DeepDiveSection } from '@/components/analysis/DeepDiveSection';
import { useTranslation } from '@/i18n/LanguageContext';

interface ExplanationPanelProps {
  analysis: AnalysisResult;
  onHoverCharge: (chargeId: string | null) => void;
  hasEOB?: boolean;
  selectedState?: string;
}

export function ExplanationPanel({ analysis, onHoverCharge, hasEOB = false, selectedState }: ExplanationPanelProps) {
  const { t } = useTranslation();
  
  // Check if we have the Pond structure
  const hasPondStructure = !!analysis.atAGlance;
  
  // Prepare data with fallbacks
  const reviewItems = analysis.thingsWorthReviewing || [];
  const savingsOpportunities = analysis.savingsOpportunities || [];
  const negotiability = analysis.negotiability || [];
  const chargeMeanings = analysis.chargeMeanings || [];
  
  const priceContext = analysis.priceContext || {
    hasBenchmarks: false,
    comparisons: [],
    fallbackMessage: "Price comparison data isn't available yet, but this category is commonly reviewed or negotiated.",
  };
  
  const conversationScripts = analysis.conversationScripts || {
    firstCallScript: "Hi, I'm calling about my bill. I'd like to understand the charges before making payment.",
    ifTheyPushBack: "I understand. Can you transfer me to someone who can explain the itemization?",
    whoToAskFor: "Ask for the billing department or a patient financial counselor.",
  };
  
  const nextSteps = analysis.pondNextSteps || [];
  const closingReassurance = analysis.closingReassurance || 
    "Medical bills are often negotiable, and asking questions is normal. You're not being difficult — you're being careful.";

  if (!hasPondStructure) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
          <p className="text-sm text-muted-foreground">
            Unable to analyze this document. Please try uploading a different bill.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-4">
        {/* ========== LAYER 1: TOP SUMMARY (Always Visible) ========== */}
        <BillSummaryHero 
          atAGlance={analysis.atAGlance}
          reviewItems={reviewItems}
          savingsOpportunities={savingsOpportunities}
        />

        {/* ========== LAYER 2: SUPPORTING EVIDENCE (Collapsed Groups) ========== */}
        <div className="space-y-2">
          {/* Group 1: What's Driving the Cost */}
          <CostDriversGroup 
            reviewItems={reviewItems}
            savingsOpportunities={savingsOpportunities}
            reviewSectionNote={analysis.reviewSectionNote}
          />
          
          {/* Group 2: How This Compares */}
          <PriceComparisonGroup 
            priceContext={priceContext}
            negotiability={negotiability}
          />
          
          {/* Group 3: What You Can Do */}
          <ActionGroup 
            scripts={conversationScripts}
            nextSteps={nextSteps}
            closingReassurance={closingReassurance}
          />
        </div>

        {/* ========== LAYER 3: DEEP DIVE & METHODOLOGY (Hidden by Default) ========== */}
        <DeepDiveSection chargeMeanings={chargeMeanings} />
      </div>
    </div>
  );
}
