import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Copy, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationScripts } from '@/types';
import { useState } from 'react';
import { toast } from 'sonner';

interface WhatToSaySectionProps {
  scripts: ConversationScripts;
}

function ScriptCard({ title, script, icon }: { title: string; script: string; icon: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copyScript = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
      </div>
      
      <div className="p-3 rounded-lg bg-background border border-border/30 mb-3">
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          "{script}"
        </p>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={copyScript}
        className="text-xs h-7"
      >
        <Copy className="h-3 w-3 mr-1" />
        {copied ? 'Copied!' : 'Copy Script'}
      </Button>
    </div>
  );
}

export function WhatToSaySection({ scripts }: WhatToSaySectionProps) {
  return (
    <div className="space-y-4">
      <ScriptCard 
        title="First Call Script" 
        script={scripts.firstCallScript}
        icon={<Phone className="h-4 w-4" />}
      />
      
      <ScriptCard 
        title="If They Push Back" 
        script={scripts.ifTheyPushBack}
        icon={<MessageSquare className="h-4 w-4" />}
      />
      
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <div className="flex items-start gap-3">
          <UserCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-foreground mb-1">Who to Ask For</h4>
            <p className="text-sm text-muted-foreground">{scripts.whoToAskFor}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
