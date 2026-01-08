import { Badge } from '@/components/ui/badge';
import { Code, FileText, AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChargeMeaning } from '@/types';
import { useState } from 'react';

interface ChargeMeaningsSectionProps {
  meanings: ChargeMeaning[];
}

function ChargeMeaningCard({ meaning }: { meaning: ChargeMeaning }) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = meaning.commonBillingIssues && meaning.commonBillingIssues.length > 0;

  return (
    <div className="p-4 rounded-xl border border-border/30 bg-muted/10">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {meaning.cptCode ? <Code className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {meaning.cptCode && (
              <code className="text-sm font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                {meaning.cptCode}
              </code>
            )}
            <h4 className="text-sm font-medium text-foreground">{meaning.procedureName}</h4>
            {meaning.isGeneral && (
              <Badge variant="outline" className="text-xs">General</Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed">
            {meaning.explanation}
          </p>
          
          {hasIssues && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-warning hover:underline"
            >
              <AlertTriangle className="h-3 w-3" />
              Common billing issues
              <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
            </button>
          )}
          
          {expanded && hasIssues && (
            <div className="pt-2 space-y-1 animate-fade-in">
              {meaning.commonBillingIssues?.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-warning">•</span>
                  {issue}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChargeMeaningsSection({ meanings }: ChargeMeaningsSectionProps) {
  if (meanings.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
        <p className="text-sm text-muted-foreground">
          No detailed charge information available. Request an itemized bill for more details.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {meanings.map((meaning, idx) => (
        <ChargeMeaningCard key={idx} meaning={meaning} />
      ))}
    </div>
  );
}
