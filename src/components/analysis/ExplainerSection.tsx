import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Code, Footprints, HelpCircle, Info, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, CPTCode } from '@/types';
import { useState } from 'react';

interface ExplainerSectionProps {
  analysis: AnalysisResult;
}

const categoryLabels: Record<string, string> = {
  evaluation: 'Office/Telehealth Visit',
  lab: 'Lab Test',
  radiology: 'Imaging',
  surgery: 'Procedure',
  medicine: 'Treatment',
  other: 'Other Service',
};

const categoryColors: Record<string, string> = {
  evaluation: 'bg-primary/10 text-primary',
  lab: 'bg-info/10 text-info',
  radiology: 'bg-warning/10 text-warning-foreground',
  surgery: 'bg-destructive/10 text-destructive',
  medicine: 'bg-success/10 text-success',
  other: 'bg-muted text-muted-foreground',
};

function CPTCodeCard({ code }: { code: CPTCode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-4 rounded-lg border border-border/50 bg-muted/20 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm font-mono font-semibold text-primary">{code.code}</code>
            <span className="text-sm text-muted-foreground">–</span>
            <span className="text-sm font-medium text-foreground">{code.shortLabel}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{code.explanation}</p>
        </div>
        <Badge className={cn('shrink-0', categoryColors[code.category] || categoryColors.other)}>
          {categoryLabels[code.category] || 'Other'}
        </Badge>
      </div>

      {/* Expandable details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Info className="h-3 w-3" />
        {expanded ? 'Hide details' : 'Learn more about this code'}
        <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
      </button>

      {expanded && (
        <div className="pt-2 space-y-2 animate-fade-in">
          <div className="p-3 rounded-md bg-card border border-border/30">
            <p className="text-xs text-muted-foreground mb-1">Where commonly used:</p>
            <p className="text-sm text-foreground">{code.whereUsed}</p>
          </div>
          <div className="p-3 rounded-md bg-card border border-border/30">
            <p className="text-xs text-muted-foreground mb-1">Typical complexity:</p>
            <p className="text-sm text-foreground capitalize">{code.complexityLevel} service</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExplainerSection({ analysis }: ExplainerSectionProps) {
  // Group CPT codes by category
  const groupedCodes = analysis.cptCodes.reduce((acc, code) => {
    const cat = code.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(code);
    return acc;
  }, {} as Record<string, CPTCode[]>);

  const categoryOrder = ['evaluation', 'lab', 'radiology', 'surgery', 'medicine', 'other'];

  return (
    <Accordion type="multiple" defaultValue={['cpt-codes', 'visit-walkthrough']} className="space-y-3">
      {/* A. CPT Codes in Plain English */}
      <AccordionItem value="cpt-codes" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Code className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-foreground">CPT Codes in Plain English</span>
            <Badge variant="outline" className="ml-auto mr-2">
              {analysis.cptCodes.length} codes
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4 pt-2">
            {categoryOrder.map((category) => {
              const codes = groupedCodes[category];
              if (!codes || codes.length === 0) return null;
              return (
                <div key={category}>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {categoryLabels[category]}
                  </h4>
                  <div className="space-y-2">
                    {codes.map((code, idx) => (
                      <CPTCodeCard key={`${code.code}-${idx}`} code={code} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* B. What This Visit Likely Looked Like */}
      <AccordionItem value="visit-walkthrough" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Footprints className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-foreground">What This Visit Likely Looked Like</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground italic">
              Based on the codes on your bill, here's what likely happened during your visit:
            </p>
            <ol className="space-y-2">
              {analysis.visitWalkthrough.map((step) => (
                <li key={step.order} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    {step.order}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{step.description}</p>
                    {step.relatedCodes && step.relatedCodes.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {step.relatedCodes.map((code) => (
                          <code key={code} className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {code}
                          </code>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* C. Common Questions About Your Codes */}
      <AccordionItem value="code-questions" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <HelpCircle className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-foreground">Common Questions About Your Codes</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground italic">
              People often ask about these things:
            </p>
            {analysis.codeQuestions.map((q, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-border/50 bg-muted/20">
                <div className="flex items-start gap-2 mb-2">
                  <code className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                    {q.cptCode}
                  </code>
                  <h4 className="text-sm font-medium text-foreground">{q.question}</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-2">{q.answer}</p>
                <p className="text-xs text-muted-foreground">
                  {q.suggestCall === 'billing' && '→ Call the billing department to clarify.'}
                  {q.suggestCall === 'insurance' && '→ Call your insurance company to clarify.'}
                  {q.suggestCall === 'either' && '→ Either billing or insurance can help with this.'}
                </p>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
