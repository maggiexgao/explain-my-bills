/**
 * PaymentFlowSection - Shows HOW bills actually get paid
 * Explains the chargemaster → negotiated rate → write-off → payment flow
 * With toggle between insured and uninsured views
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DollarSign, MessageSquare, ChevronDown, Shield, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentFlowSectionProps {
  chargemasterTotal: number;
  benchmarkTotal: number;
  accountNumber?: string;
  className?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface PaymentFlowEstimates {
  chargemasterTotal: number;
  medicareBenchmark: number;
  multiple: number;
  // For insured flow
  negotiatedRateLow: number;
  negotiatedRateHigh: number;
  contractualAdjustmentLow: number;
  contractualAdjustmentHigh: number;
  insurancePaysLow: number;
  insurancePaysHigh: number;
  patientPaysLow: number;
  patientPaysHigh: number;
  // For uninsured flow
  selfPayAfterDiscountLow: number;
  selfPayAfterDiscountHigh: number;
  negotiateToMedicareLow: number;
  negotiateToMedicareHigh: number;
}

function calculatePaymentFlow(chargemaster: number, benchmark: number): PaymentFlowEstimates {
  const negotiatedLow = Math.round(benchmark * 1.5);
  const negotiatedHigh = Math.round(benchmark * 3.0);
  
  return {
    chargemasterTotal: chargemaster,
    medicareBenchmark: benchmark,
    multiple: benchmark > 0 ? chargemaster / benchmark : 0,
    
    // Insured flow
    negotiatedRateLow: negotiatedLow,
    negotiatedRateHigh: negotiatedHigh,
    contractualAdjustmentLow: Math.max(0, chargemaster - negotiatedHigh),
    contractualAdjustmentHigh: Math.max(0, chargemaster - negotiatedLow),
    insurancePaysLow: Math.round(negotiatedLow * 0.7),   // 70% (30% coinsurance)
    insurancePaysHigh: Math.round(negotiatedHigh * 0.8), // 80% (20% coinsurance)
    patientPaysLow: Math.round(negotiatedLow * 0.2),     // 20% coinsurance
    patientPaysHigh: Math.round(negotiatedHigh * 0.3),   // 30% coinsurance
    
    // Uninsured flow
    selfPayAfterDiscountLow: Math.round(chargemaster * 0.4),   // 60% discount
    selfPayAfterDiscountHigh: Math.round(chargemaster * 0.6),  // 40% discount
    negotiateToMedicareLow: benchmark,
    negotiateToMedicareHigh: Math.round(benchmark * 1.5),
  };
}

export function PaymentFlowSection({ 
  chargemasterTotal, 
  benchmarkTotal,
  accountNumber,
  className 
}: PaymentFlowSectionProps) {
  const [viewMode, setViewMode] = useState<string>("insured");
  
  // Don't render if we don't have benchmark data
  if (!benchmarkTotal || benchmarkTotal <= 0) {
    return null;
  }

  const flow = calculatePaymentFlow(chargemasterTotal, benchmarkTotal);

  return (
    <Card className={cn("border-border/40", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4 text-primary" />
          How This Bill Gets Paid
        </CardTitle>
        <CardDescription>
          The price on your bill isn't what anyone actually pays
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-5">
        {/* THE STARTING POINT */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-semibold">Hospital's Listed Price</div>
              <div className="text-sm text-muted-foreground">
                The "chargemaster" rate — this is the starting point, not what anyone pays
              </div>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(flow.chargemasterTotal)}</div>
          </div>
        </div>
        
        {/* BENCHMARK REFERENCE */}
        <div className="bg-success/10 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-semibold text-success">Benchmark Reference</div>
              <div className="text-sm text-muted-foreground">
                What the government says these services actually cost
              </div>
            </div>
            <div className="text-2xl font-bold text-success">{formatCurrency(flow.medicareBenchmark)}</div>
          </div>
        </div>
        
        <Separator />
        
        {/* INSURANCE STATUS TOGGLE */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <span className="text-sm font-medium">Show estimates for:</span>
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(val) => val && setViewMode(val)}
            className="bg-muted/50 p-1 rounded-lg"
          >
            <ToggleGroupItem value="insured" className="text-sm px-4 data-[state=on]:bg-background">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              I Have Insurance
            </ToggleGroupItem>
            <ToggleGroupItem value="uninsured" className="text-sm px-4 data-[state=on]:bg-background">
              <Wallet className="h-3.5 w-3.5 mr-1.5" />
              I'm Uninsured
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        {/* === INSURED FLOW === */}
        {viewMode === 'insured' && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Here's how your bill gets processed:</h4>
            
            {/* Step 1 */}
            <div className="flex items-start gap-3 pl-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm font-medium">1</div>
              <div className="flex-1">
                <div className="flex justify-between text-sm">
                  <span>Hospital bills insurance</span>
                  <span className="font-mono font-medium">{formatCurrency(flow.chargemasterTotal)}</span>
                </div>
              </div>
            </div>
            
            {/* Step 2 */}
            <div className="flex items-start gap-3 pl-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium">2</div>
              <div className="flex-1">
                <div className="flex justify-between text-sm">
                  <span>Insurance's negotiated rate</span>
                  <span className="font-mono font-medium">{formatCurrency(flow.negotiatedRateLow)} – {formatCurrency(flow.negotiatedRateHigh)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your insurance has a pre-negotiated deal with this hospital (typically 150-300% of benchmark)
                </p>
              </div>
            </div>
            
            {/* Step 3 - The write-off */}
            <div className="flex items-start gap-3 pl-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">3</div>
              <div className="flex-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Contractual adjustment (written off)</span>
                  <span className="font-mono line-through">
                    –{formatCurrency(flow.contractualAdjustmentLow)} to –{formatCurrency(flow.contractualAdjustmentHigh)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This amount disappears — nobody pays it. It's just accounting.
                </p>
              </div>
            </div>
            
            {/* Step 4 - Insurance pays */}
            <div className="flex items-start gap-3 pl-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center text-sm font-medium">4</div>
              <div className="flex-1">
                <div className="flex justify-between text-sm text-success">
                  <span>Insurance pays their share</span>
                  <span className="font-mono font-medium">{formatCurrency(flow.insurancePaysLow)} – {formatCurrency(flow.insurancePaysHigh)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Typically 70-80% of the negotiated rate (depends on your plan)
                </p>
              </div>
            </div>
            
            {/* Step 5 - Patient pays */}
            <div className="flex items-start gap-3 pl-2 bg-warning/10 -mx-2 px-4 py-3 rounded-lg border border-warning/20">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-warning text-warning-foreground flex items-center justify-center text-sm font-medium">5</div>
              <div className="flex-1">
                <div className="flex justify-between font-semibold text-sm">
                  <span>You pay (your share)</span>
                  <span className="font-mono">{formatCurrency(flow.patientPaysLow)} – {formatCurrency(flow.patientPaysHigh)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your deductible + coinsurance (typically 20-30% of negotiated rate)
                </p>
              </div>
            </div>
            
            {/* Important Note */}
            <div className="bg-primary/5 p-3 rounded-lg text-sm border border-primary/10">
              <div className="font-medium mb-1 text-sm">📋 Check your Explanation of Benefits (EOB)</div>
              <p className="text-xs text-muted-foreground">
                Your actual amount depends on your specific plan, whether you've met your deductible, 
                and your coinsurance rate. The EOB from your insurance will show the exact breakdown.
              </p>
            </div>
          </div>
        )}
        
        {/* === UNINSURED FLOW === */}
        {viewMode === 'uninsured' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Your options as a self-pay patient:</h4>
            
            {/* Option 1: Self-pay discount */}
            <div className="border rounded-lg p-4 space-y-3">
              <div>
                <div className="font-medium text-sm">Option 1: Ask for Self-Pay Discount</div>
                <p className="text-xs text-muted-foreground">
                  Most hospitals offer 40-60% off the listed price for uninsured patients
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3 pl-2">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">1</div>
                  <div className="flex-1 flex justify-between text-sm">
                    <span>Listed price</span>
                    <span className="font-mono">{formatCurrency(flow.chargemasterTotal)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-2">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-success/20 text-success flex items-center justify-center text-xs">2</div>
                  <div className="flex-1 flex justify-between text-sm text-success">
                    <span>Self-pay discount (40-60% off)</span>
                    <span className="font-mono">–{formatCurrency(flow.chargemasterTotal * 0.4)} to –{formatCurrency(flow.chargemasterTotal * 0.6)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-2 bg-warning/10 -mx-2 px-4 py-2 rounded border border-warning/20">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-warning text-warning-foreground flex items-center justify-center text-xs font-medium">3</div>
                  <div className="flex-1 flex justify-between text-sm font-semibold">
                    <span>You pay</span>
                    <span className="font-mono">{formatCurrency(flow.selfPayAfterDiscountLow)} – {formatCurrency(flow.selfPayAfterDiscountHigh)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Option 2: Negotiate to Benchmark */}
            <div className="border-2 border-success rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="bg-success text-success-foreground text-xs px-2 py-0.5 rounded font-medium">BEST VALUE</span>
              </div>
              <div>
                <div className="font-medium text-sm">Option 2: Negotiate to Benchmark Rates</div>
                <p className="text-xs text-muted-foreground">
                  Ask the hospital to accept 100-150% of the benchmark rate
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3 pl-2">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">1</div>
                  <div className="flex-1 flex justify-between text-sm">
                    <span>Listed price</span>
                    <span className="font-mono">{formatCurrency(flow.chargemasterTotal)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-2">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-success/20 text-success flex items-center justify-center text-xs">2</div>
                  <div className="flex-1 flex justify-between text-sm">
                    <span>Benchmark reference</span>
                    <span className="font-mono text-success">{formatCurrency(flow.medicareBenchmark)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-2 bg-success/10 -mx-2 px-4 py-2 rounded border border-success/30">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-success text-success-foreground flex items-center justify-center text-xs font-medium">3</div>
                  <div className="flex-1 flex justify-between text-sm font-semibold text-success">
                    <span>Negotiate to pay</span>
                    <span className="font-mono">{formatCurrency(flow.negotiateToMedicareLow)} – {formatCurrency(flow.negotiateToMedicareHigh)}</span>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground italic pt-1">
                💡 Say: "I'd like to pay what the benchmark rate is for these services. Can you accept {formatCurrency(flow.medicareBenchmark)}?"
              </p>
            </div>
            
            {/* Option 3: Financial Assistance */}
            <div className="border rounded-lg p-4 space-y-2">
              <div className="font-medium text-sm">Option 3: Apply for Financial Assistance</div>
              <p className="text-xs text-muted-foreground">
                If your income is below 200-400% of the federal poverty level, non-profit hospitals 
                are required to offer charity care. You may qualify for a reduced bill or even $0.
              </p>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm">Potential cost with assistance:</span>
                <span className="font-mono font-semibold text-success">$0 – {formatCurrency(flow.medicareBenchmark)}</span>
              </div>
            </div>
            
            {/* Prompt pay bonus */}
            <div className="bg-primary/5 p-3 rounded-lg text-sm border border-primary/10">
              <div className="font-medium mb-1 text-sm">💰 Extra tip: Offer to pay upfront</div>
              <p className="text-xs text-muted-foreground">
                If you can pay the full amount immediately, ask for an additional 10-20% "prompt pay" 
                discount on top of any other discounts.
              </p>
            </div>
          </div>
        )}
        
        <Separator />
        
        {/* NEGOTIATION SCRIPTS */}
        <details className="group">
          <summary className="cursor-pointer font-medium flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4" />
            What to say when you call the billing department
            <ChevronDown className="h-4 w-4 ml-auto group-open:rotate-180 transition-transform" />
          </summary>
          <div className="mt-3 space-y-3 text-sm">
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="font-medium mb-1 text-xs uppercase text-muted-foreground">First, always ask:</div>
              <p className="italic text-sm">
                "Can I get an itemized bill showing each charge and the billing codes?"
              </p>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="font-medium mb-1 text-xs uppercase text-muted-foreground">If uninsured:</div>
              <p className="italic text-sm">
                "I'm a self-pay patient. What discounts do you offer? I'd like to pay what the benchmark rate would be for these services — about {formatCurrency(flow.medicareBenchmark)}. Can we work something out?"
              </p>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="font-medium mb-1 text-xs uppercase text-muted-foreground">If the bill seems too high:</div>
              <p className="italic text-sm">
                "I've looked up the benchmark rates for these services and they total {formatCurrency(flow.medicareBenchmark)}. My bill is {formatCurrency(flow.chargemasterTotal)}, which is {flow.multiple.toFixed(1)}× higher. Can you explain the difference or offer a reduction?"
              </p>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="font-medium mb-1 text-xs uppercase text-muted-foreground">To get financial assistance:</div>
              <p className="italic text-sm">
                "Do you have a financial assistance program or charity care? I'd like to apply."
              </p>
            </div>
          </div>
        </details>
        
        {/* Disclaimer */}
        <p className="text-[10px] text-muted-foreground text-center">
          * Estimates based on national averages. Actual amounts vary by location, facility, insurance plan, and individual circumstances.
        </p>
      </CardContent>
    </Card>
  );
}
