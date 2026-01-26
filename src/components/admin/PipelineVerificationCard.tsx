/**
 * PipelineVerificationCard Component
 * Tests end-to-end data pipeline: upload → database → bill analysis
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  TestTube,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PipelineTestResult {
  step: string;
  passed: boolean;
  detail: string;
}

const PIPELINE_TESTS = [
  { 
    name: 'MPFS Lookup (99214 - Office Visit)', 
    table: 'mpfs_benchmarks', 
    code: '99214',
    fields: ['hcpcs', 'work_rvu', 'nonfac_fee'],
    formatResult: (data: Record<string, unknown>) => 
      `Work RVU: ${data.work_rvu}, Fee: $${data.nonfac_fee || data.fac_fee}`
  },
  { 
    name: 'OPPS Lookup (99284 - ER Visit)', 
    table: 'opps_addendum_b', 
    code: '99284',
    fields: ['hcpcs', 'payment_rate', 'status_indicator'],
    formatResult: (data: Record<string, unknown>) => 
      `Payment Rate: $${data.payment_rate}, Status: ${data.status_indicator}`
  },
  { 
    name: 'CLFS Lookup (80053 - Comprehensive Panel)', 
    table: 'clfs_fee_schedule', 
    code: '80053',
    fields: ['hcpcs', 'payment_amount'],
    formatResult: (data: Record<string, unknown>) => 
      `Payment: $${data.payment_amount}`
  },
  { 
    name: 'DMEPOS Lookup (E0601 - CPAP)', 
    table: 'dmepos_fee_schedule', 
    code: 'E0601',
    fields: ['hcpcs', 'fee', 'ceiling'],
    formatResult: (data: Record<string, unknown>) => 
      `Fee: $${data.fee || data.ceiling}`
  },
  { 
    name: 'GPCI Lookup (New York)', 
    table: 'gpci_localities', 
    filter: { column: 'state_abbr', value: 'NY' },
    fields: ['state_abbr', 'work_gpci', 'pe_gpci', 'mp_gpci'],
    formatResult: (data: Record<string, unknown>) => 
      `Work GPCI: ${data.work_gpci}, PE GPCI: ${data.pe_gpci}`
  },
  { 
    name: 'ZIP Crosswalk (10001 - NYC)', 
    table: 'zip_to_locality', 
    filter: { column: 'zip5', value: '10001' },
    fields: ['zip5', 'locality_num', 'state_abbr'],
    formatResult: (data: Record<string, unknown>) => 
      `Locality: ${data.locality_num}, State: ${data.state_abbr}`
  }
];

export function PipelineVerificationCard() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<PipelineTestResult[]>([]);

  const runPipelineTest = async () => {
    setTesting(true);
    setResults([]);
    const testResults: PipelineTestResult[] = [];

    for (const test of PIPELINE_TESTS) {
      try {
        let query = supabase
          .from(test.table as any)
          .select(test.fields.join(','));
        
        if (test.code) {
          query = query.eq('hcpcs', test.code);
        } else if (test.filter) {
          query = query.eq(test.filter.column, test.filter.value);
        }
        
        const { data, error } = await query.limit(1);

        if (error || !data || data.length === 0) {
          testResults.push({
            step: test.name,
            passed: false,
            detail: error?.message || 'No data found - missing from database'
          });
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const record = data[0] as any;
          testResults.push({
            step: test.name,
            passed: true,
            detail: test.formatResult(record as Record<string, unknown>)
          });
        }
      } catch (err) {
        testResults.push({
          step: test.name,
          passed: false,
          detail: err instanceof Error ? err.message : 'Test failed'
        });
      }
    }

    setResults(testResults);
    setTesting(false);
  };

  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  const allPassed = results.length > 0 && failCount === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5 text-primary" />
              Pipeline Verification
            </CardTitle>
            <CardDescription>
              Test that imported data is accessible for bill analysis
            </CardDescription>
          </div>
          <Button onClick={runPipelineTest} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              'Run Pipeline Test'
            )}
          </Button>
        </div>
      </CardHeader>
      
      {results.length > 0 && (
        <CardContent className="pt-0">
          {/* Summary */}
          <div className="flex gap-2 mb-4">
            {passCount > 0 && (
              <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300">
                {passCount} Passed
              </Badge>
            )}
            {failCount > 0 && (
              <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300">
                {failCount} Failed
              </Badge>
            )}
          </div>

          {/* Test Results */}
          <div className="space-y-2">
            {results.map((result, i) => (
              <div 
                key={i} 
                className={cn(
                  'p-3 rounded-lg border',
                  result.passed 
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' 
                    : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                )}
              >
                <div className="flex items-center gap-2">
                  {result.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  )}
                  <span className="font-medium text-sm">{result.step}</span>
                </div>
                <div className={cn(
                  'text-xs mt-1 ml-6',
                  result.passed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                )}>
                  {result.detail}
                </div>
              </div>
            ))}
          </div>

          {/* Overall Result */}
          <div className={cn(
            'mt-4 p-3 rounded-lg border',
            allPassed 
              ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700' 
              : 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
          )}>
            <div className="flex items-center gap-2">
              {allPassed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
              <span className="font-medium">
                {allPassed 
                  ? 'ALL TESTS PASSED - Data pipeline is working correctly' 
                  : `${failCount} test(s) failed - Some datasets need to be imported`}
              </span>
            </div>
            {!allPassed && (
              <p className="text-xs text-muted-foreground mt-2 ml-7">
                Import the missing datasets above to enable full bill analysis.
              </p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}