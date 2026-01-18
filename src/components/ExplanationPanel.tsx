import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AnalysisResult, CareSetting } from '@/types';
import { BillSummaryHero } from '@/components/analysis/BillSummaryHero';
import { CostDriversGroup } from '@/components/analysis/CostDriversGroup';
import { PriceComparisonGroup } from '@/components/analysis/PriceComparisonGroup';
import { ActionGroup } from '@/components/analysis/ActionGroup';
import { DeepDiveSection } from '@/components/analysis/DeepDiveSection';
import { HowThisCompares } from '@/components/analysis/HowThisCompares';
import { NegotiationLetterGenerator } from '@/components/analysis/NegotiationLetterGenerator';
import { CollapsibleGroup } from '@/components/analysis/CollapsibleGroup';
import { useTranslation } from '@/i18n/LanguageContext';
import { calculateMedicareBenchmarks, MedicareBenchmarkOutput } from '@/lib/medicareBenchmarkService';
import { DebugCalculationPanel, DebugCalculationData } from '@/components/analysis/DebugCalculationPanel';
import { extractTotals } from '@/lib/totalsExtractor';
import { DollarSign, Loader2, TrendingUp, Bug } from 'lucide-react';

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
  const [medicareBenchmark, setMedicareBenchmark] = useState<MedicareBenchmarkOutput | null>(null);
  const [isLoadingMedicare, setIsLoadingMedicare] = useState(false);
  const [debugData, setDebugData] = useState<DebugCalculationData | null>(null);
  
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

  // Extract CPT codes from analysis for Medicare benchmarking (for letter generator)
  useEffect(() => {
    const fetchMedicareBenchmarks = async () => {
      // Build line items from analysis
      const lineItems: { hcpcs: string; description?: string; billedAmount: number; units: number }[] = [];
      
      // Try to extract from CPT codes
      if (analysis.cptCodes && analysis.cptCodes.length > 0) {
        for (const cpt of analysis.cptCodes) {
          // Try to find matching charge
          const matchingCharge = analysis.charges?.find(c => 
            c.description?.includes(cpt.code) || 
            cpt.shortLabel?.includes(c.description)
          );
          if (matchingCharge && matchingCharge.amount > 0) {
            lineItems.push({
              hcpcs: cpt.code,
              description: cpt.shortLabel || cpt.explanation,
              billedAmount: matchingCharge.amount,
              units: 1
            });
          }
        }
      }
      
      // Also try to extract from chargeMeanings
      if (lineItems.length === 0 && analysis.chargeMeanings) {
        for (const cm of analysis.chargeMeanings) {
          if (cm.cptCode) {
            const matchingCharge = analysis.charges?.find(c => 
              c.description?.toLowerCase().includes(cm.procedureName?.toLowerCase() || '')
            );
            if (matchingCharge && matchingCharge.amount > 0) {
              lineItems.push({
                hcpcs: cm.cptCode,
                description: cm.procedureName,
                billedAmount: matchingCharge.amount,
                units: 1
              });
            }
          }
        }
      }
      
      // If we have line items and a state, fetch Medicare data
      if (lineItems.length > 0 && selectedState) {
        setIsLoadingMedicare(true);
        try {
          const result = await calculateMedicareBenchmarks(
            lineItems,
            selectedState,
            zipCode
          );
          setMedicareBenchmark(result);
          // Build debug data
          const newDebugData: DebugCalculationData = {
            geoDebug: result.debug?.geoDebug,
            rawCodesExtracted: lineItems.map(l => l.hcpcs),
            validCodes: result.debug?.validatedCodes?.map(v => v.code).filter(Boolean) as string[] || [],
            rejectedTokens: result.debug?.rejectedTokens || [],
            reverseSearchTriggered: false,
            benchmarkOutput: result
          };
          
          // Extract totals from analysis
          const totalsData = extractTotals(analysis);
          if (totalsData) {
            newDebugData.totalsReconciliation = totalsData;
            newDebugData.comparisonTotalType = totalsData.comparisonTotalType;
            newDebugData.comparisonTotalValue = totalsData.comparisonTotalValue;
            newDebugData.comparisonTotalExplanation = totalsData.comparisonTotalExplanation;
          }
          
          setDebugData(newDebugData);
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

        {/* ========== HOW THIS COMPARES (Medicare Pricing Analysis) ========== */}
        {selectedState && (
          <CollapsibleGroup
            title="How This Compares"
            subtitle={medicareBenchmark?.multipleOfMedicare 
              ? `${medicareBenchmark.multipleOfMedicare}× Medicare reference` 
              : 'Medicare benchmark comparison'
            }
            icon={<TrendingUp className="h-4 w-4" />}
            iconClassName="bg-primary/20 text-primary"
            defaultOpen={true}
            infoTooltip="Compare your charges to CMS Medicare reference prices, often used by insurers and employers as benchmarks"
          >
            <HowThisCompares
              analysis={analysis}
              state={selectedState}
              zipCode={zipCode}
              careSetting={careSetting}
            />
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

        {/* REMOVED: DeepDiveSection with "Charge Details & CPT Codes" - now consolidated into Service Details */}

        {/* ========== DEBUG: How This Was Calculated ========== */}
        {debugData && (
          <CollapsibleGroup
            title="How This Was Calculated"
            subtitle="Debug: extraction, geo resolution, and pricing details"
            icon={<Bug className="h-4 w-4" />}
            iconClassName="bg-muted text-muted-foreground"
            defaultOpen={false}
            infoTooltip="Technical details about how the analysis was computed"
          >
            <DebugCalculationPanel data={debugData} />
          </CollapsibleGroup>
        )}
      </div>
    </div>
  );
}
