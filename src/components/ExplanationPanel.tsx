import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Receipt,
  FileCheck,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult } from '@/types';
import { ExplainerSection } from '@/components/analysis/ExplainerSection';
import { BillingSection } from '@/components/analysis/BillingSection';
import { useState } from 'react';

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

function AccordionSection({ title, subtitle, icon, iconBg, badge, defaultOpen = true, children }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-border/40 bg-card shadow-soft overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-4 p-5 transition-colors",
          "hover:bg-muted/30",
          isOpen && "border-b border-border/40"
        )}
      >
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", iconBg)}>
          {icon}
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-foreground text-lg">{title}</h3>
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
  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Document Summary Header */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/40">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-foreground">Analysis Results</h2>
            {hasEOB && (
              <Badge className="bg-success/10 text-success border-success/20">
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

        {/* Two Main Accordions with generous spacing */}
        <div className="space-y-4">
          {/* Section 1: Explainer */}
          <AccordionSection
            title="Explainer"
            subtitle="What happened during your visit"
            icon={<BookOpen className="h-6 w-6 text-primary" />}
            iconBg="bg-primary/10"
            defaultOpen={true}
          >
            <ExplainerSection analysis={analysis} />
          </AccordionSection>

          {/* Section 2: Billing & Next Steps */}
          <AccordionSection
            title="Billing & Next Steps"
            subtitle="Money, assistance, and action items"
            icon={<Receipt className="h-6 w-6 text-success" />}
            iconBg="bg-success/10"
            badge={
              hasEOB ? (
                <Badge className="bg-success/10 text-success border-0 text-xs">
                  EOB uploaded
                </Badge>
              ) : undefined
            }
            defaultOpen={true}
          >
            <BillingSection analysis={analysis} hasEOB={hasEOB} />
          </AccordionSection>
        </div>
      </div>
    </div>
  );
}
