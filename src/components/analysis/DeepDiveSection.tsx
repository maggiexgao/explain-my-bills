import { Badge } from '@/components/ui/badge';
import { Code, FileText, AlertTriangle, ChevronRight, BookOpen, Info, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChargeMeaning } from '@/types';
import { useState } from 'react';
import { CollapsibleGroup } from './CollapsibleGroup';

interface DeepDiveSectionProps {
  chargeMeanings: ChargeMeaning[];
}

function ChargeMeaningItem({ meaning }: { meaning: ChargeMeaning }) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = meaning.commonBillingIssues && meaning.commonBillingIssues.length > 0;

  return (
    <div className="py-2 border-b border-border/20 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 text-left group"
      >
        <div className="mt-0.5 shrink-0 rounded-full p-1 bg-purple/10 text-purple">
          {meaning.cptCode ? <Code className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {meaning.cptCode && (
              <code className="text-xs font-mono font-semibold text-primary bg-primary/10 px-1 py-0.5 rounded">
                {meaning.cptCode}
              </code>
            )}
            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              {meaning.procedureName}
            </span>
            {meaning.isGeneral && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">General</Badge>
            )}
          </div>
        </div>
        <ChevronRight className={cn(
          "h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform",
          expanded && "rotate-90"
        )} />
      </button>
      
      {expanded && (
        <div className="mt-2 ml-8 animate-fade-in space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {meaning.explanation}
          </p>
          {hasIssues && (
            <div className="p-2 rounded-lg bg-warning/5 border border-warning/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="h-3 w-3 text-warning" />
                <span className="text-xs font-medium text-warning-foreground">Common billing issues:</span>
              </div>
              {meaning.commonBillingIssues?.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground ml-4">
                  <span className="text-warning">•</span>
                  {issue}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DeepDiveSection({ chargeMeanings }: DeepDiveSectionProps) {
  const hasContent = chargeMeanings.length > 0;
  
  return (
    <div className="mt-6 pt-4 border-t border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">How We Evaluated This</h3>
        <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
      
      <CollapsibleGroup
        title="Charge Details & CPT Codes"
        subtitle={hasContent ? `${chargeMeanings.length} charge${chargeMeanings.length > 1 ? 's' : ''} explained` : "No detailed codes available"}
        icon={<Code className="h-4 w-4" />}
        iconClassName="bg-purple/20 text-purple"
        badge={hasContent ? (
          <Badge className="bg-purple/10 text-purple text-[10px] px-1.5 py-0">
            {chargeMeanings.length}
          </Badge>
        ) : undefined}
        defaultOpen={false}
        isEmpty={!hasContent}
        emptyMessage="Request an itemized bill for detailed charge breakdowns."
      >
        <div className="space-y-1">
          {chargeMeanings.map((meaning, idx) => (
            <ChargeMeaningItem key={idx} meaning={meaning} />
          ))}
        </div>
      </CollapsibleGroup>
      
      {/* Methodology note */}
      <div className="mt-3 p-3 rounded-lg bg-muted/20 border border-border/30">
        <div className="flex items-start gap-2">
          <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">About this analysis</p>
            <p className="leading-relaxed">
              This evaluation is based on publicly available CMS benchmark pricing data, common billing practices, 
              and general healthcare pricing patterns. Actual costs vary by provider, location, and insurance. 
              Always verify with your provider or insurance company.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
