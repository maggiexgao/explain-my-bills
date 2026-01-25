/**
 * Unmatched Codes Card
 * 
 * Displays codes that were detected but not found in Medicare pricing datasets.
 * Fetches descriptions for HCPCS Level II codes from NLM ClinicalTables.
 * Provides clear explanation that pricing is not available.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertCircle, 
  HelpCircle, 
  Info, 
  ExternalLink,
  FileQuestion 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUnmatchedCodeInfo, UnmatchedCodeInfo, isHcpcsLevelII, isCptCode } from '@/lib/externalCodeInfo';
import { inferCodeSystem } from '@/lib/codeExplanationService';

interface UnmatchedCodesCardProps {
  unmatchedCodes: string[];
  className?: string;
}

export function UnmatchedCodesCard({ unmatchedCodes, className }: UnmatchedCodesCardProps) {
  const [codeInfo, setCodeInfo] = useState<UnmatchedCodeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCodeInfo() {
      if (!unmatchedCodes || unmatchedCodes.length === 0) {
        setCodeInfo([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const info = await getUnmatchedCodeInfo(unmatchedCodes);
        setCodeInfo(info);
      } catch (err) {
        console.error('Error fetching unmatched code info:', err);
        setError('Could not fetch code descriptions');
        // Still show codes without descriptions
        setCodeInfo(unmatchedCodes.map(code => ({
          code,
          description: null,
          source: 'Error fetching',
          pricingAvailable: false,
          pricingNote: 'Medicare pricing not available',
        })));
      } finally {
        setLoading(false);
      }
    }

    fetchCodeInfo();
  }, [unmatchedCodes]);

  if (!unmatchedCodes || unmatchedCodes.length === 0) {
    return null;
  }

  const getCodeTypeBadge = (code: string) => {
    if (isHcpcsLevelII(code)) {
      return <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">HCPCS</Badge>;
    }
    if (isCptCode(code)) {
      return <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">CPT</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] bg-muted">Other</Badge>;
  };

  return (
    <Card className={cn('border-warning/30 bg-warning/5', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileQuestion className="h-5 w-5 text-warning" />
          <CardTitle className="text-base">Codes Without Benchmark Pricing</CardTitle>
        </div>
        <CardDescription className="text-sm">
          These codes were detected but not found in our benchmark fee schedules.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            {unmatchedCodes.slice(0, 3).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {codeInfo.map((info) => (
              <div 
                key={info.code} 
                className="p-3 rounded-lg bg-background border border-border/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 rounded bg-muted font-mono text-sm font-medium">
                      {info.code}
                    </code>
                    {getCodeTypeBadge(info.code)}
                  </div>
                  {info.description && (
                    <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                      Description found
                    </Badge>
                  )}
                </div>
                
                {info.description ? (
                  <div className="mt-2">
                    <p className="text-sm text-foreground">{info.description}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {info.source}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    Description not found
                  </p>
                )}
                
                <div className="mt-2 p-2 rounded bg-muted/30 border border-border/30">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-warning" />
                    <span>{info.pricingNote}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}
        
        <div className="pt-2 border-t border-border/30">
          <p className="text-xs text-muted-foreground">
            <strong>Why aren't these priced?</strong> These may be private payer codes, state Medicaid codes, 
            drugs priced separately, or codes not covered under Medicare Part B physician fee schedules.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
