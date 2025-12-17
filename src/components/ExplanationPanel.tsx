import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  List,
  Code,
  HelpCircle,
  AlertTriangle,
  Heart,
  Scale,
  CheckSquare,
  DollarSign,
  Building,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult } from '@/types';

interface ExplanationPanelProps {
  analysis: AnalysisResult;
  onHoverCharge: (chargeId: string | null) => void;
}

export function ExplanationPanel({ analysis, onHoverCharge }: ExplanationPanelProps) {
  const documentTypeLabels: Record<string, string> = {
    bill: 'Hospital/Medical Bill',
    eob: 'Explanation of Benefits',
    chart: 'Medical Record/Chart',
    denial: 'Denial Letter',
    unknown: 'Medical Document',
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-4">
        <Accordion type="multiple" defaultValue={['document-type', 'charges']} className="space-y-3">
          
          {/* Section 1: What This Document Is */}
          <AccordionItem value="document-type" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-foreground">What This Document Is</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                    {documentTypeLabels[analysis.documentType]}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Issued By</p>
                      <p className="text-sm font-medium text-foreground">{analysis.issuer}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date of Service</p>
                      <p className="text-sm font-medium text-foreground">{analysis.dateOfService}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {analysis.documentPurpose}
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 2: Line-by-Line Explanation */}
          <AccordionItem value="charges" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <List className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-foreground">Line-by-Line Explanation</span>
                <Badge variant="outline" className="ml-auto mr-2">
                  {analysis.charges.length} items
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 pt-2">
                {analysis.charges.map((charge) => (
                  <div
                    key={charge.id}
                    className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer"
                    onMouseEnter={() => onHoverCharge(charge.id)}
                    onMouseLeave={() => onHoverCharge(null)}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h4 className="text-sm font-medium text-foreground">{charge.description}</h4>
                      <span className="text-sm font-semibold text-foreground whitespace-nowrap flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {charge.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {charge.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 3: Medical Codes Explained */}
          <AccordionItem value="codes" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Code className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-foreground">Medical Codes Explained</span>
                <Badge variant="outline" className="ml-auto mr-2">
                  {analysis.medicalCodes.length} codes
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 pt-2">
                {analysis.medicalCodes.map((code, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-border/50 bg-muted/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-secondary text-secondary-foreground">
                        {code.type}
                      </Badge>
                      <code className="text-sm font-mono font-semibold text-primary">{code.code}</code>
                    </div>
                    <h4 className="text-sm font-medium text-foreground mb-1">{code.description}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{code.typicalPurpose}</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Common questions:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {code.commonQuestions.map((q, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 4: Things Patients Often Ask About */}
          <AccordionItem value="faqs" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <HelpCircle className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-foreground">Things Patients Often Ask About</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 pt-2">
                {analysis.faqs.map((faq, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-border/50 bg-muted/20">
                    <h4 className="text-sm font-medium text-foreground mb-2">{faq.question}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 5: Possible Billing or Administrative Issues */}
          <AccordionItem value="issues" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                </div>
                <span className="font-medium text-foreground">Possible Billing Questions</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground italic">
                  These are common areas where patients sometimes have questions. This is not a determination of errors.
                </p>
                {analysis.possibleIssues.map((issue, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-warning/20 bg-warning/5">
                    <h4 className="text-sm font-medium text-foreground mb-1">{issue.issue}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{issue.explanation}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 6: Financial Assistance & Charity Care */}
          <AccordionItem value="assistance" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                  <Heart className="h-4 w-4 text-success" />
                </div>
                <span className="font-medium text-foreground">Financial Assistance Options</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 pt-2">
                {analysis.financialAssistance.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/20 text-xs font-medium text-success">
                      {idx + 1}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 7: State & Federal Protections */}
          <AccordionItem value="rights" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10">
                  <Scale className="h-4 w-4 text-info" />
                </div>
                <span className="font-medium text-foreground">Patient Protections (Educational)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground italic">
                  This is general educational information about patient protections, not legal advice.
                </p>
                {analysis.patientRights.map((right, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-info/5 border border-info/20">
                    <p className="text-sm text-muted-foreground leading-relaxed">{right}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Section 8: Patient Action Plan */}
          <AccordionItem value="action-plan" className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-soft">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <CheckSquare className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-foreground">Patient Action Plan</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground italic">
                  These are steps many patients choose to take. This is informational only.
                </p>
                {analysis.actionPlan.map((step) => (
                  <div key={step.step} className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                      {step.step}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-1">{step.action}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
