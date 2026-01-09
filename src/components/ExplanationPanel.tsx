import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AnalysisResult, CareSetting } from '@/types';
import { BillSummaryHero } from '@/components/analysis/BillSummaryHero';
import { CostDriversGroup } from '@/components/analysis/CostDriversGroup';
import { PriceComparisonGroup } from '@/components/analysis/PriceComparisonGroup';
import { ActionGroup } from '@/components/analysis/ActionGroup';
import { DeepDiveSection } from '@/components/analysis/DeepDiveSection';
import { MedicarePricingSummary } from '@/components/analysis/MedicarePricingSummary';
import { MedicareLineItemTable } from '@/components/analysis/MedicareLineItemTable';
import { NegotiationLetterGenerator } from '@/components/analysis/NegotiationLetterGenerator';
import { CollapsibleGroup } from '@/components/analysis/CollapsibleGroup';
import { useTranslation } from '@/i18n/LanguageContext';
import { analyzeBillAgainstMedicare, MedicareSummary, LineItemWithCpt } from '@/lib/medicareBenchmark';
import { DollarSign, Loader2 } from 'lucide-react';

interface ExplanationPanelProps {
  analysis: AnalysisResult;
  onHoverCharge: (chargeId: string | null) => void;
  hasEOB?: boolean;
  selectedState?: string;
  zipCode?: string;
  careSetting?: CareSetting;
}

export function ExplanationPanel({ 
  analysis, 
  onHoverCharge, 
  hasEOB = false, 
  selectedState,
  zipCode,
  careSetting = 'office'
}: ExplanationPanelProps) {
  const { t } = useTranslation();
  const [medicareSummary, setMedicareSummary] = useState<MedicareSummary | null>(null);
  const [isLoadingMedicare, setIsLoadingMedicare] = useState(false);
  
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

  // Extract CPT codes from analysis for Medicare benchmarking
  useEffect(() => {
    const fetchMedicareBenchmarks = async () => {
      // Build line items from analysis
      const lineItems: LineItemWithCpt[] = [];
      
      // Try to extract from CPT codes
      if (analysis.cptCodes && analysis.cptCodes.length > 0) {
        for (const cpt of analysis.cptCodes) {
          // Try to find matching charge
          const matchingCharge = analysis.charges?.find(c => 
            c.description?.includes(cpt.code) || 
            cpt.shortLabel?.includes(c.description)
          );
          lineItems.push({
            cptCode: cpt.code,
            description: cpt.shortLabel || cpt.explanation,
            chargedAmount: matchingCharge?.amount || 0
          });
        }
      }
      
      // Also try to extract from chargeMeanings
      if (lineItems.length === 0 && analysis.chargeMeanings) {
        for (const cm of analysis.chargeMeanings) {
          if (cm.cptCode) {
            const matchingCharge = analysis.charges?.find(c => 
              c.description?.toLowerCase().includes(cm.procedureName?.toLowerCase() || '')
            );
            lineItems.push({
              cptCode: cm.cptCode,
              description: cm.procedureName,
              chargedAmount: matchingCharge?.amount || 0
            });
          }
        }
      }
      
      // If we have line items and a state, fetch Medicare data
      if (lineItems.length > 0 && selectedState) {
        setIsLoadingMedicare(true);
        try {
          const summary = await analyzeBillAgainstMedicare(
            lineItems.filter(li => li.chargedAmount > 0),
            selectedState,
            zipCode,
            careSetting
          );
          setMedicareSummary(summary);
        } catch (error) {
          console.error('Error fetching Medicare benchmarks:', error);
        } finally {
          setIsLoadingMedicare(false);
        }
      }
    };

    fetchMedicareBenchmarks();
  }, [analysis, selectedState, zipCode, careSetting]);

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

        {/* ========== MEDICARE PRICING ANALYSIS ========== */}
        {isLoadingMedicare && (
          <div className="p-4 rounded-xl bg-muted/20 border border-border/30 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading Medicare price comparison...</span>
          </div>
        )}
        
        {medicareSummary && medicareSummary.comparisons.length > 0 && (
          <CollapsibleGroup
            title="Medicare Price Analysis"
            subtitle={`${medicareSummary.percentOfMedicare ? `${medicareSummary.percentOfMedicare}% of Medicare` : 'Benchmark comparison'}`}
            icon={<DollarSign className="h-4 w-4" />}
            iconClassName="bg-success/20 text-success"
            defaultOpen={medicareSummary.itemsFlagged > 0}
            infoTooltip="Compare your charges to official CMS Medicare rates for your area"
          >
            <div className="space-y-4">
              <MedicarePricingSummary summary={medicareSummary} />
              <MedicareLineItemTable comparisons={medicareSummary.comparisons} />
              
              {/* Negotiation Letter Generator */}
              {medicareSummary.itemsFlagged > 0 && (
                <NegotiationLetterGenerator
                  summary={medicareSummary}
                  providerName={analysis.issuer}
                  dateOfService={analysis.dateOfService}
                  localityName={medicareSummary.comparisons[0]?.localityName || undefined}
                  state={selectedState}
                  zipCode={zipCode}
                />
              )}
            </div>
          </CollapsibleGroup>
        )}

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
