import { Badge } from '@/components/ui/badge';
import { MessageSquare, Phone, Copy, UserCheck, ArrowRight, CheckSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationScripts, PondNextStep } from '@/types';
import { CollapsibleGroup } from './CollapsibleGroup';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

interface ActionGroupProps {
  scripts: ConversationScripts;
  nextSteps: PondNextStep[];
  closingReassurance: string;
}

// Default action steps when backend doesn't provide them
const DEFAULT_NEXT_STEPS: { title: string; details: string; isUrgent?: boolean }[] = [
  {
    title: "Request an itemized bill",
    details: "If you haven't received a detailed breakdown of charges, call the billing department and request an itemized statement. This shows every service, procedure, and supply charged. Compare it to your EOB from insurance.",
    isUrgent: true,
  },
  {
    title: "Request a coding review",
    details: "Ask the billing department to verify the billing codes are accurate. For ER visits, ask specifically if the level assigned (e.g., Level 4 vs Level 3) matches the care you received. If you were seen quickly with minimal intervention, it may have been over-coded.",
  },
  {
    title: "Ask about discounts and payment options",
    details: "Request self-pay or prompt-pay discounts (often 10-40% off). Ask about financial hardship programs if your income qualifies. Set up a payment plan if needed—most hospitals offer interest-free plans.",
  },
];

function CopyableScript({ label, script }: { label: string; script: string }) {
  const [copied, setCopied] = useState(false);

  const copyScript = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg bg-muted/10 border border-border/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyScript}
          className="h-6 px-2 text-xs"
        >
          <Copy className="h-3 w-3 mr-1" />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <p className="text-sm text-foreground leading-relaxed">
        "{script}"
      </p>
    </div>
  );
}

function NextStepRow({ 
  index, 
  title, 
  details, 
  isUrgent 
}: { 
  index: number; 
  title: string; 
  details: string;
  isUrgent?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className={cn(
        "rounded-lg border overflow-hidden",
        isUrgent ? "border-warning/30 bg-warning/5" : "border-border/30 bg-muted/10"
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-start gap-3 text-left hover:bg-muted/20 transition-colors"
      >
        <div className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          isUrgent 
            ? "bg-warning text-warning-foreground" 
            : "bg-primary/20 text-primary"
        )}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-3 pb-3 pt-0">
          <div className="ml-9 p-3 rounded-lg bg-background/60 border border-border/30">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {details}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Parse step text to extract title and details
function parseStep(step: PondNextStep): { title: string; details: string } {
  const text = step.step || '';
  
  // Try to split on common patterns like ":" or "-" or first sentence
  const colonIndex = text.indexOf(':');
  const dashIndex = text.indexOf(' - ');
  
  if (colonIndex > 0 && colonIndex < 50) {
    return {
      title: text.substring(0, colonIndex).trim(),
      details: text.substring(colonIndex + 1).trim() || 'Click for more details.',
    };
  }
  
  if (dashIndex > 0 && dashIndex < 50) {
    return {
      title: text.substring(0, dashIndex).trim(),
      details: text.substring(dashIndex + 3).trim() || 'Click for more details.',
    };
  }
  
  // If short enough, use as title with generic details
  if (text.length < 60) {
    return {
      title: text,
      details: 'Contact the billing department and reference this item for more information.',
    };
  }
  
  // Otherwise, split at first sentence or ~40 chars
  const periodIndex = text.indexOf('.');
  if (periodIndex > 0 && periodIndex < 60) {
    return {
      title: text.substring(0, periodIndex).trim(),
      details: text.substring(periodIndex + 1).trim() || 'Follow up with the billing department.',
    };
  }
  
  // Fallback: first 40 chars as title
  return {
    title: text.substring(0, 40).trim() + '...',
    details: text,
  };
}

export function ActionGroup({ scripts, nextSteps, closingReassurance }: ActionGroupProps) {
  const hasUrgentSteps = nextSteps.some(s => s.isUrgent);
  
  // Use default steps if none provided or all empty
  const hasValidSteps = nextSteps.length > 0 && nextSteps.some(s => s.step && s.step.trim().length > 0);
  const stepsToShow = hasValidSteps ? nextSteps : [];
  const useDefaults = !hasValidSteps;
  
  return (
    <CollapsibleGroup
      title="What You Can Do"
      subtitle="Next steps & scripts"
      icon={<MessageSquare className="h-4 w-4" />}
      iconClassName="bg-primary/20 text-primary"
      badge={hasUrgentSteps ? (
        <Badge className="bg-warning/10 text-warning-foreground text-[10px] px-1.5 py-0">
          Action needed
        </Badge>
      ) : undefined}
      defaultOpen={false}
      infoTooltip="Whether negotiation is realistic, ready-to-use scripts, and recommended next steps"
    >
      <div className="space-y-4">
        {/* Next Steps - Expandable List */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Recommended Steps
          </h4>
          <div className="space-y-2">
            {useDefaults ? (
              // Use default steps when backend provides empty/no steps
              DEFAULT_NEXT_STEPS.map((step, idx) => (
                <NextStepRow
                  key={idx}
                  index={idx}
                  title={step.title}
                  details={step.details}
                  isUrgent={step.isUrgent}
                />
              ))
            ) : (
              // Use provided steps
              stepsToShow.map((step, idx) => {
                const { title, details } = parseStep(step);
                return (
                  <NextStepRow
                    key={idx}
                    index={idx}
                    title={title}
                    details={details}
                    isUrgent={step.isUrgent}
                  />
                );
              })
            )}
          </div>
        </div>
        
        {/* Conversation Scripts */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            What to Say
          </h4>
          <div className="space-y-2">
            <CopyableScript label="First Call" script={scripts.firstCallScript} />
            <CopyableScript label="If They Push Back" script={scripts.ifTheyPushBack} />
          </div>
          
          {/* Who to ask for */}
          <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-primary/5">
            <UserCheck className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Ask for:</span> {scripts.whoToAskFor}
            </span>
          </div>
        </div>
        
        {/* Closing Reassurance */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border/30">
          <div className="flex items-start gap-3">
            <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-relaxed">
              {closingReassurance}
            </p>
          </div>
        </div>
      </div>
    </CollapsibleGroup>
  );
}
