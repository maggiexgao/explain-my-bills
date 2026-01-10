/**
 * Medicare Benchmark Section
 * Displays CPT vs Medicare rate comparisons
 */

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';
import { AnalysisResult, CPTCode } from '@/types';
import { buildMpfsTable, buildMpfsIndex, MpfsIndex } from '@/lib/mpfsTable';
import { 
  evaluateCptLinesAgainstMedicare, 
  CptLineInput, 
  CptLineEvaluation,
  CptEvaluationSummary,
  formatMedicareRatio,
  interpretMedicareRatio 
} from '@/lib/cptEvaluationEngine';

interface MedicareBenchmarkSectionProps {
  analysis: AnalysisResult;
  state: string;
}

// Cache the MPFS index globally so we don't reload it for every render
let cachedMpfsIndex: MpfsIndex | null = null;
let mpfsLoadPromise: Promise<MpfsIndex | null> | null = null;

async function loadMpfsIndex(): Promise<MpfsIndex | null> {
  if (cachedMpfsIndex) return cachedMpfsIndex;
  if (mpfsLoadPromise) return mpfsLoadPromise;
  
  mpfsLoadPromise = (async () => {
    try {
      const response = await fetch('/data/PFREV4.txt');
      if (!response.ok) {
        console.error('Failed to load PFREV4.txt:', response.status);
        return null;
      }
      const content = await response.text();
      const rows = buildMpfsTable(content);
      cachedMpfsIndex = buildMpfsIndex(rows);
      return cachedMpfsIndex;
    } catch (error) {
      console.error('Error loading MPFS data:', error);
      return null;
    }
  })();
  
  return mpfsLoadPromise;
}

function buildCptLineInputs(analysis: AnalysisResult): CptLineInput[] {
  const inputs: CptLineInput[] = [];
  
  // Build from cptCodes in analysis
  for (const cpt of analysis.cptCodes || []) {
    // Try to find corresponding charge amount
    const matchingCharge = analysis.charges?.find(
      c => c.description?.includes(cpt.code) || c.id === cpt.code
    );
    
    // Get allowed amount from EOB if available
    const eobAllowed = analysis.eobData?.allowedAmount;
    const numCodes = (analysis.cptCodes || []).length || 1;
    
    inputs.push({
      cpt: cpt.code,
      description: cpt.shortLabel || cpt.explanation,
      billed: matchingCharge?.amount || 0,
      allowed: eobAllowed ? eobAllowed / numCodes : undefined,
      siteOfService: cpt.category === 'surgery' ? 'facility' : 'nonfacility',
      units: 1,
    });
  }
  
  return inputs.filter(i => i.billed > 0 || i.cpt);
}

function RatioIndicator({ ratio, size = 'sm' }: { ratio: number | null; size?: 'sm' | 'lg' }) {
  const interpretation = interpretMedicareRatio(ratio);
  
  const iconClass = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const textClass = size === 'lg' ? 'text-base font-semibold' : 'text-sm font-medium';
  
  const config = {
    low: { icon: TrendingDown, color: 'text-success', bg: 'bg-success/10' },
    typical: { icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted/50' },
    high: { icon: TrendingUp, color: 'text-warning', bg: 'bg-warning/10' },
    very_high: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
    unknown: { icon: Info, color: 'text-muted-foreground', bg: 'bg-muted/30' },
  };
  
  const { icon: Icon, color, bg } = config[interpretation.level];
  
  return (
    <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md', bg)}>
      <Icon className={cn(iconClass, color)} />
      <span className={cn(textClass, color)}>
        {formatMedicareRatio(ratio)}
      </span>
    </div>
  );
}

function CptLineCard({ line }: { line: CptLineEvaluation }) {
  const interpretation = interpretMedicareRatio(line.billedVsMedicare);
  
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/30 border border-border/30">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-medium text-foreground">
            {line.cpt}
          </span>
          <Badge variant="secondary" className="text-xs">
            {line.serviceTypeLabel}
          </Badge>
        </div>
        {line.description && (
          <p className="text-sm text-muted-foreground truncate">
            {line.description}
          </p>
        )}
        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
          <span>Billed: ${line.billed.toFixed(2)}</span>
          {line.medicareAllowed !== null && (
            <span>Medicare: ${line.medicareAllowed.toFixed(2)}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <RatioIndicator ratio={line.billedVsMedicare} />
        {line.notes.length > 0 && (
          <span className="text-xs text-muted-foreground max-w-[150px] truncate">
            {line.notes[0]}
          </span>
        )}
      </div>
    </div>
  );
}

function ServiceTypeSummaryRow({ summary }: { summary: CptEvaluationSummary['byServiceType'][0] }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-xs">
          {summary.count}
        </Badge>
        <span className="text-sm font-medium text-foreground">
          {summary.serviceTypeLabel}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          ${summary.totalBilled.toFixed(0)}
        </span>
        <RatioIndicator ratio={summary.avgBilledVsMedicare} size="sm" />
      </div>
    </div>
  );
}

export function MedicareBenchmarkSection({ analysis, state }: MedicareBenchmarkSectionProps) {
  const { t } = useTranslation();
  const [evaluation, setEvaluation] = useState<CptEvaluationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    async function runEvaluation() {
      setLoading(true);
      setError(null);
      
      try {
        const index = await loadMpfsIndex();
        if (cancelled) return;
        
        if (!index) {
          setError('Could not load Medicare fee schedule data');
          setLoading(false);
          return;
        }
        
        const lineInputs = buildCptLineInputs(analysis);
        if (lineInputs.length === 0) {
          setError('No CPT codes found to compare');
          setLoading(false);
          return;
        }
        
        // Use 2025 as the default year (based on PFREV4 file)
        const result = evaluateCptLinesAgainstMedicare(
          index,
          '2025',
          state,
          null, // No specific locality
          lineInputs
        );
        
        if (cancelled) return;
        setEvaluation(result);
      } catch (err) {
        if (cancelled) return;
        console.error('Medicare evaluation error:', err);
        setError('Error comparing to Medicare rates');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    runEvaluation();
    
    return () => {
      cancelled = true;
    };
  }, [analysis, state]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="p-4 rounded-lg bg-muted/30 border border-border/40 text-center">
        <Info className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          {error || 'Medicare comparison not available'}
        </p>
      </div>
    );
  }

  const hasData = evaluation.lines.some(l => l.medicareAllowed !== null);
  const codesWithData = evaluation.lines.filter(l => l.medicareAllowed !== null);
  const codesWithoutData = evaluation.codesNotFound;
  
  if (!hasData) {
    return (
      <div className="p-4 rounded-lg bg-muted/30 border border-border/40">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              Medicare rate data not available for these specific codes
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              The CPT codes on this bill ({codesWithoutData.join(', ')}) are not included in our current Medicare fee schedule dataset for {state}. 
              This often happens with specialized treatment codes like radiation therapy.
            </p>
            <p className="text-xs text-muted-foreground">
              You can look up Medicare rates for these codes at{' '}
              <a 
                href="https://www.cms.gov/medicare/payment/fee-schedules/physician" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                CMS.gov Physician Fee Schedule
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const interpretation = interpretMedicareRatio(evaluation.overallBilledVsMedicare);

  return (
    <div className="space-y-5">
      {/* Overall Summary Card */}
      <Card className={cn(
        "p-5 border-2",
        interpretation.level === 'very_high' && "border-destructive/40 bg-destructive/5",
        interpretation.level === 'high' && "border-warning/40 bg-warning/5",
        interpretation.level === 'typical' && "border-border/40",
        interpretation.level === 'low' && "border-success/40 bg-success/5",
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-foreground">Overall Medicare Comparison</h4>
          </div>
          <RatioIndicator ratio={evaluation.overallBilledVsMedicare} size="lg" />
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          {interpretation.message}
        </p>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-lg bg-background/50">
            <p className="text-xs text-muted-foreground mb-1">Total Billed</p>
            <p className="text-lg font-semibold text-foreground">
              ${evaluation.totalBilled.toFixed(0)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-background/50">
            <p className="text-xs text-muted-foreground mb-1">Medicare Would Allow</p>
            <p className="text-lg font-semibold text-foreground">
              ${evaluation.totalMedicareAllowed.toFixed(0)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-background/50">
            <p className="text-xs text-muted-foreground mb-1">Difference</p>
            <p className={cn(
              "text-lg font-semibold",
              evaluation.totalBilled > evaluation.totalMedicareAllowed ? "text-destructive" : "text-success"
            )}>
              ${Math.abs(evaluation.totalBilled - evaluation.totalMedicareAllowed).toFixed(0)}
            </p>
          </div>
        </div>
      </Card>

      {/* Service Type Summary */}
      {evaluation.byServiceType.length > 1 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">By Service Type</h4>
          <div className="space-y-1 bg-muted/20 rounded-lg p-2">
            {evaluation.byServiceType.map((summary) => (
              <ServiceTypeSummaryRow key={summary.serviceType} summary={summary} />
            ))}
          </div>
        </div>
      )}

      {/* Individual CPT Lines */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">
          CPT Code Details ({evaluation.lines.length} codes)
        </h4>
        <div className="space-y-2">
          {evaluation.lines.map((line, idx) => (
            <CptLineCard key={`${line.cpt}-${idx}`} line={line} />
          ))}
        </div>
      </div>

      {/* Codes Not Found */}
      {evaluation.codesNotFound.length > 0 && (
        <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
          <div className="flex items-start gap-2 mb-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                Codes not in Medicare dataset
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                These specialized codes are not included in our fee schedule data. 
                Look them up at{' '}
                <a 
                  href="https://www.cms.gov/medicare/payment/fee-schedules/physician" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  CMS.gov
                </a>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 ml-6">
            {evaluation.codesNotFound.map((code) => (
              <Badge key={code} variant="outline" className="text-xs">
                {code}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Educational Footer */}
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>About Medicare Comparisons:</strong> Medicare rates are set by the federal government 
          and serve as a benchmark. Private insurers typically pay 100-300% of Medicare rates. 
          Your actual costs depend on your insurance plan's negotiated rates. This comparison 
          helps you understand how your charges relate to standard government pricing.
        </p>
      </div>
    </div>
  );
}
