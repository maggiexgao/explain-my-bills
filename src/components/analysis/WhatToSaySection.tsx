/**
 * WhatToSaySection - Negotiation scripts with benchmark pricing references
 * 
 * Updated to use "benchmark rates" instead of "Medicare" for clarity with insured users
 */

import { Button } from '@/components/ui/button';
import { Phone, MessageSquare, Copy, UserCheck, DollarSign, Shield, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationScripts } from '@/types';
import { useState } from 'react';
import { toast } from 'sonner';

interface WhatToSaySectionProps {
  scripts: ConversationScripts;
  benchmarkTotal?: number;
  billedTotal?: number;
  accountNumber?: string;
}

function ScriptCard({ 
  title, 
  script, 
  icon,
  tips 
}: { 
  title: string; 
  script: string; 
  icon: React.ReactNode;
  tips?: string[];
}) {
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
      
      {tips && tips.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {tips.map((tip, idx) => (
            <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
              <span className="text-primary mt-0.5">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
      
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function WhatToSaySection({ 
  scripts, 
  benchmarkTotal, 
  billedTotal,
  accountNumber 
}: WhatToSaySectionProps) {
  const multiple = benchmarkTotal && billedTotal && benchmarkTotal > 0 
    ? (billedTotal / benchmarkTotal).toFixed(1) 
    : null;

  // Enhanced scripts with benchmark references
  const enhancedFirstCall = benchmarkTotal && billedTotal 
    ? `Hi, I'm calling about ${accountNumber ? `account number ${accountNumber}` : 'my recent bill'}. I received a bill for ${formatCurrency(billedTotal)} and I'd like to discuss my options.

I've done some research and found that the benchmark rate for these services is around ${formatCurrency(benchmarkTotal)}. I understand hospital pricing is higher, but my bill is ${multiple}× the benchmark, which seems high.

Could you tell me about:
1. Any prompt-pay or self-pay discounts available?
2. Your financial assistance programs?
3. Payment plan options if I pay a reduced amount upfront?`
    : scripts.firstCallScript;

  const enhancedPushBack = benchmarkTotal 
    ? `I understand that's your standard pricing, but I'm hoping we can work something out.

Insurance companies typically pay 150-250% of benchmark rates for these services, which would be ${formatCurrency(benchmarkTotal * 1.5)} to ${formatCurrency(benchmarkTotal * 2.5)}.

I'm willing to pay ${formatCurrency(benchmarkTotal * 2)} today if we can settle this account. Would that be possible?`
    : scripts.ifTheyPushBack;

  return (
    <div className="space-y-4">
      {/* Benchmark context banner */}
      {benchmarkTotal && billedTotal && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-foreground mb-1">Your Negotiation Leverage</h4>
              <p className="text-sm text-muted-foreground">
                Your bill is <strong className="text-foreground">{multiple}× the benchmark</strong>. 
                Insurance typically pays 1.5-3× benchmark. A fair target for self-pay is{' '}
                <strong className="text-success">{formatCurrency(benchmarkTotal * 1.5)} – {formatCurrency(benchmarkTotal * 2.5)}</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <ScriptCard 
        title="Opening the Conversation" 
        script={enhancedFirstCall}
        icon={<Phone className="h-4 w-4" />}
        tips={[
          "Stay calm and polite — billing staff deal with upset callers all day",
          "Reference 'benchmark rates' rather than 'Medicare' — it sounds more informed",
          "Ask open-ended questions to learn about all your options"
        ]}
      />
      
      <ScriptCard 
        title="If They Push Back" 
        script={enhancedPushBack}
        icon={<MessageSquare className="h-4 w-4" />}
        tips={[
          "Having a specific number shows you've done your homework",
          "Offering to pay TODAY is powerful leverage",
          "If they say no, ask to speak with a supervisor or financial counseling"
        ]}
      />

      {/* Financial Assistance Script */}
      <ScriptCard
        title="Asking About Financial Assistance"
        script={`I'd like to apply for financial assistance. Can you tell me about your charity care program and what documentation I would need?

Also, while my application is being reviewed, can we pause any collection activity on this account?`}
        icon={<Shield className="h-4 w-4" />}
        tips={[
          "Most non-profit hospitals are REQUIRED to have financial assistance programs",
          "You can apply even if you have insurance — assistance is based on ability to pay",
          "Request everything in writing"
        ]}
      />
      
      <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
        <div className="flex items-start gap-3">
          <UserCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-foreground mb-1">Who to Ask For</h4>
            <p className="text-sm text-muted-foreground">{scripts.whoToAskFor}</p>
            <ul className="mt-2 text-xs text-muted-foreground space-y-1">
              <li>• <strong>Patient Financial Services</strong> — can discuss discounts and payment plans</li>
              <li>• <strong>Financial Counselor</strong> — can help with assistance applications</li>
              <li>• <strong>Supervisor</strong> — has authority to approve larger adjustments</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Important reminder */}
      <div className="p-3 rounded-lg bg-info/5 border border-info/20">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-info shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Remember:</strong> Benchmark rates are a reference point, not a guarantee. 
            Your goal is to negotiate a fair price, not to pay exactly the benchmark amount. 
            Most hospitals expect negotiation and have room to reduce bills significantly.
          </p>
        </div>
      </div>
    </div>
  );
}
