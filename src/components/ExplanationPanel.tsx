import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BookOpen,
  Receipt,
  FileCheck,
} from 'lucide-react';
import { AnalysisResult } from '@/types';
import { ExplainerSection } from '@/components/analysis/ExplainerSection';
import { BillingSection } from '@/components/analysis/BillingSection';

interface ExplanationPanelProps {
  analysis: AnalysisResult;
  onHoverCharge: (chargeId: string | null) => void;
  hasEOB?: boolean;
}

export function ExplanationPanel({ analysis, onHoverCharge, hasEOB = false }: ExplanationPanelProps) {
  return (
    <div className="h-full overflow-auto">
      <div className="p-4 space-y-4">
        {/* Document Summary Header */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-foreground">Analysis Results</h2>
            {hasEOB && (
              <Badge className="bg-success/10 text-success border-success/20">
                <FileCheck className="h-3 w-3 mr-1" />
                EOB Enhanced
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>{analysis.issuer}</span>
            <span className="text-border">•</span>
            <span>{analysis.dateOfService}</span>
          </div>
        </div>

        {/* Two Main Accordions */}
        <Accordion type="multiple" defaultValue={['explainer', 'billing']} className="space-y-4">
          {/* Section 1: Explainer */}
          <AccordionItem value="explainer" className="border-0">
            <AccordionTrigger className="px-4 py-4 rounded-xl bg-card border border-border/50 shadow-soft hover:no-underline hover:bg-muted/30 [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-foreground block">Explainer</span>
                  <span className="text-xs text-muted-foreground">What happened during your visit</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="border border-t-0 border-border/50 rounded-b-xl bg-card/50 px-4 pb-4">
              <div className="pt-4">
                <ExplainerSection analysis={analysis} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 2: Billing & Next Steps */}
          <AccordionItem value="billing" className="border-0">
            <AccordionTrigger className="px-4 py-4 rounded-xl bg-card border border-border/50 shadow-soft hover:no-underline hover:bg-muted/30 [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                  <Receipt className="h-5 w-5 text-success" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-foreground block">Billing & Next Steps</span>
                  <span className="text-xs text-muted-foreground">Money, assistance, and action items</span>
                </div>
                {hasEOB && (
                  <Badge className="ml-auto bg-success/10 text-success border-0 text-xs">
                    EOB uploaded
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="border border-t-0 border-border/50 rounded-b-xl bg-card/50 px-4 pb-4">
              <div className="pt-4">
                <BillingSection analysis={analysis} hasEOB={hasEOB} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
