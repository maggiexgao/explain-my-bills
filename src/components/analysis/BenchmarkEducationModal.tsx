/**
 * Benchmark Education Modal - Explains the healthcare pricing system in detail
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Info, DollarSign, Building2, Stethoscope, FlaskConical, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BenchmarkEducationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BenchmarkEducationModal({ isOpen, onClose }: BenchmarkEducationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Info className="h-5 w-5 text-primary" />
            Understanding Healthcare Pricing
          </DialogTitle>
          <DialogDescription>
            How benchmark rates work and why your bill may differ
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {/* What are Benchmark Rates */}
          <section>
            <h3 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              What are Benchmark Rates?
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Centers for Medicare & Medicaid Services (CMS) publishes standardized 
              payment rates that reflect the actual cost of providing medical services. 
              While these rates were developed for Medicare, they serve as the <strong>foundation 
              for ALL healthcare pricing</strong> in the US.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Insurance companies, hospitals, and providers use these rates as a starting point 
              when negotiating prices. That's why we call them "benchmark rates" — they're the 
              reference point for the entire healthcare system.
            </p>
          </section>

          {/* Fee Schedules We Use */}
          <section>
            <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              The Fee Schedules We Use
            </h3>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400 text-xs">
                    OPPS
                  </Badge>
                  <span className="text-sm font-medium text-foreground">Hospital Outpatient</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for ER visits, outpatient surgery, and hospital-based services. 
                  Rates are based on Ambulatory Payment Classifications (APCs).
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-400 text-xs">
                    MPFS
                  </Badge>
                  <span className="text-sm font-medium text-foreground">Physician Services</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for doctor visits, consultations, and procedures. 
                  Rates are based on Relative Value Units (RVUs) adjusted for your geographic area.
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-400 text-xs">
                    CLFS
                  </Badge>
                  <span className="text-sm font-medium text-foreground">Clinical Lab</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for blood tests, urinalysis, and pathology. 
                  Rates reflect actual lab processing costs.
                </p>
              </div>
            </div>
          </section>

          {/* Why Hospital Prices Are Different */}
          <section>
            <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              Why Hospital Prices Are So Different
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Hospital "chargemaster" prices are not regulated and don't reflect actual costs. 
              They're essentially list prices that <strong>almost no one actually pays</strong>:
            </p>
            
            <div className="space-y-2">
              {[
                { label: 'Benchmark rate (cost basis)', range: '1×', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
                { label: 'Insurance negotiated rate', range: '1.5–3×', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
                { label: 'Self-pay with discount', range: '1.5–2.5×', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
                { label: 'Chargemaster (list price)', range: '5–20×', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-sm text-foreground">{row.label}</span>
                  <Badge className={cn("text-xs font-semibold", row.color)}>
                    {row.range}
                  </Badge>
                </div>
              ))}
            </div>
          </section>

          {/* How to Use This Information */}
          <section>
            <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              How to Use This Information
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-semibold text-primary shrink-0">1.</span>
                <span>Compare your bill to benchmark rates to understand if charges are reasonable</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-primary shrink-0">2.</span>
                <span>Use benchmark rates as a reference when negotiating with billing departments</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-primary shrink-0">3.</span>
                <span>Ask for the "insurance rate" or "prompt-pay discount" — these are typically 150-250% of benchmark</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-primary shrink-0">4.</span>
                <span>Apply for financial assistance if you qualify — many programs use benchmark rates as their basis</span>
              </li>
            </ol>
          </section>

          {/* External Resources */}
          <section className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <h4 className="text-sm font-medium text-foreground mb-2">Learn More</h4>
            <div className="space-y-2">
              <a 
                href="https://www.cms.gov/medicare/payment/fee-schedules" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                CMS Fee Schedule Lookup Tool
              </a>
              <a 
                href="https://www.healthcare.gov/using-marketplace-coverage/getting-emergency-care/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Healthcare.gov - Understanding Your Rights
              </a>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
