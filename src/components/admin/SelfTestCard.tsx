/**
 * SelfTestCard Component
 * 
 * Tests the import system connectivity:
 * - Database connection via service role
 * - Edge function availability
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Loader2, Zap } from 'lucide-react';

interface TestResult {
  ok: boolean;
  message: string;
  details?: {
    mpfsRowCount?: number;
    serviceRoleActive?: boolean;
    error?: string;
  };
}

export function SelfTestCard() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<TestResult | null>(null);

  const runSelfTest = async () => {
    setStatus('testing');
    setResult(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dataType: 'self-test' })
      });

      const data: TestResult = await response.json();
      setResult(data);
      setStatus(data.ok ? 'success' : 'error');

    } catch (error) {
      console.error('Self-test error:', error);
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to connect to import service',
        details: { error: 'Network or service unavailable' }
      });
      setStatus('error');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <CardTitle>Import Self-Test</CardTitle>
        </div>
        <CardDescription>
          Verify database connectivity and service role access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Result */}
        {result && (
          <div className={`rounded-md p-3 text-sm ${
            result.ok 
              ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}>
            <div className="flex items-start gap-2">
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-medium">{result.message}</p>
                {result.details && (
                  <div className="text-xs mt-2 space-y-1 opacity-75">
                    {result.details.mpfsRowCount !== undefined && (
                      <p>MPFS rows: {result.details.mpfsRowCount.toLocaleString()}</p>
                    )}
                    {result.details.serviceRoleActive && (
                      <p>✓ Service role active</p>
                    )}
                    {result.details.error && (
                      <p className="text-destructive">Error: {result.details.error}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={runSelfTest}
          disabled={status === 'testing'}
          variant={status === 'success' ? 'outline' : 'default'}
          className="w-full"
        >
          {status === 'testing' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : status === 'success' ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
              Re-run Self-Test
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Run Self-Test
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
