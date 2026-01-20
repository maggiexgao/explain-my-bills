/**
 * VerifyDmeposCard Component
 * 
 * Queries DMEPOS table to verify alphanumeric codes are correctly stored.
 * Shows sample codes and prefix breakdown.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Loader2, Search, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VerifyResult {
  ok: boolean;
  totalCount: number;
  sampleCodes: string[];
  hasAlphanumeric: boolean;
  prefixBreakdown: Record<string, number>;
  error?: string;
}

export function VerifyDmeposCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Query sample codes
      const { data, error, count } = await supabase
        .from('dmepos_fee_schedule')
        .select('hcpcs', { count: 'exact' })
        .limit(500);

      if (error) {
        setResult({
          ok: false,
          totalCount: 0,
          sampleCodes: [],
          hasAlphanumeric: false,
          prefixBreakdown: {},
          error: error.message
        });
        return;
      }

      // Extract unique codes
      const uniqueCodes = new Set<string>();
      const prefixBreakdown: Record<string, number> = {};
      let hasAlphanumeric = false;

      for (const row of (data || [])) {
        const code = String(row.hcpcs || '').trim().toUpperCase();
        if (code && code.length >= 4) {
          uniqueCodes.add(code);
          
          // Check for alphanumeric
          if (/[A-Z]/i.test(code)) {
            hasAlphanumeric = true;
          }
          
          // Track prefix
          const prefix = code.charAt(0);
          prefixBreakdown[prefix] = (prefixBreakdown[prefix] || 0) + 1;
        }
      }

      const codesArray = Array.from(uniqueCodes).sort();

      setResult({
        ok: true,
        totalCount: count || 0,
        sampleCodes: codesArray.slice(0, 25),
        hasAlphanumeric,
        prefixBreakdown
      });
    } catch (err) {
      setResult({
        ok: false,
        totalCount: 0,
        sampleCodes: [],
        hasAlphanumeric: false,
        prefixBreakdown: {},
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Verify DMEPOS Data</CardTitle>
        </div>
        <CardDescription>
          Verify that DMEPOS codes include alphanumeric formats (E0114, A4253, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleVerify} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Querying...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Verify DMEPOS Codes
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-4">
            {/* Status */}
            <div className={`rounded-md p-3 text-sm flex items-start gap-2 ${
              result.ok && result.hasAlphanumeric
                ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                : result.ok && !result.hasAlphanumeric
                ? 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}>
              {result.ok && result.hasAlphanumeric ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="font-medium">
                  {result.ok && result.hasAlphanumeric
                    ? '✓ Alphanumeric codes found'
                    : result.ok && !result.hasAlphanumeric
                    ? '⚠ No alphanumeric codes detected'
                    : `Error: ${result.error}`}
                </p>
                <p className="text-xs mt-1 opacity-80">
                  Total rows: {result.totalCount.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Prefix Breakdown */}
            {result.ok && Object.keys(result.prefixBreakdown).length > 0 && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Code Prefix Distribution (from 500 sample rows):
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.prefixBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([prefix, count]) => (
                      <Badge 
                        key={prefix} 
                        variant={/[A-Z]/.test(prefix) ? 'default' : 'secondary'}
                        className="font-mono"
                      >
                        {prefix}: {count}
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {/* Sample Codes */}
            {result.ok && result.sampleCodes.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Sample codes ({result.sampleCodes.length}):
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.sampleCodes.map((code) => (
                    <code 
                      key={code}
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        /^[A-Z]/.test(code)
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {code}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
