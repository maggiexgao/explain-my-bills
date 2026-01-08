import { Badge } from '@/components/ui/badge';
import { MessageSquare, Phone, Copy, UserCheck, ArrowRight, CheckSquare } from 'lucide-react';
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

export function ActionGroup({ scripts, nextSteps, closingReassurance }: ActionGroupProps) {
  const hasUrgentSteps = nextSteps.some(s => s.isUrgent);
  
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
        {/* Next Steps - Compact List */}
        {nextSteps.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Recommended Steps
            </h4>
            <div className="space-y-1.5">
              {nextSteps.map((step, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-lg",
                    step.isUrgent ? "bg-warning/10" : "bg-muted/10"
                  )}
                >
                  <div className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    step.isUrgent 
                      ? "bg-warning text-warning-foreground" 
                      : "bg-primary/20 text-primary"
                  )}>
                    {idx + 1}
                  </div>
                  <span className="text-sm text-foreground">{step.step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
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
