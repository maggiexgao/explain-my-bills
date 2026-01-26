/**
 * VerifyDataModal Component - Simplified
 * Runs validation checks on dataset and displays results
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Loader2, Shield, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VerificationCheck { name: string; passed: boolean; detail: string; }
interface VerificationResult { passed: boolean; checks: VerificationCheck[]; loading: boolean; error: string | null; }

const VERIFICATION_CODES: Record<string, string[]> = {
  mpfs_benchmarks: ['99213', '99214', '99215'],
  opps_addendum_b: ['99281', '99282', '99283'],
  clfs_fee_schedule: ['80053', '85025', '81003'],
  dmepos_fee_schedule: ['A4216', 'E0100', 'K0001'],
  dmepen_fee_schedule: ['B4034', 'B4035'],
  gpci_localities: [],
  zip_to_locality: ['10001', '90210']
};

const MIN_EXPECTED_ROWS: Record<string, number> = {
  mpfs_benchmarks: 10000, opps_addendum_b: 5000, clfs_fee_schedule: 1000,
  dmepos_fee_schedule: 1000, dmepen_fee_schedule: 100, gpci_localities: 100, zip_to_locality: 30000
};

type ValidTable = 'mpfs_benchmarks' | 'opps_addendum_b' | 'clfs_fee_schedule' | 
                  'dmepos_fee_schedule' | 'dmepen_fee_schedule' | 'gpci_localities' | 'zip_to_locality';

interface VerifyDataModalProps { tableName: ValidTable; displayName: string; }

export function VerifyDataModal({ tableName, displayName }: VerifyDataModalProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<VerificationResult>({ passed: false, checks: [], loading: false, error: null });

  const runVerification = async () => {
    setResult({ passed: false, checks: [], loading: true, error: null });
    const checks: VerificationCheck[] = [];
    const expectedMinRows = MIN_EXPECTED_ROWS[tableName] || 100;

    try {
      const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
      checks.push({ name: 'Row count', passed: (count || 0) >= expectedMinRows, detail: `${(count || 0).toLocaleString()} rows (expected ≥${expectedMinRows.toLocaleString()})` });

      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: recentCount } = await supabase.from(tableName).select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo.toISOString());
      checks.push({ name: 'Data freshness', passed: (recentCount || 0) > 0, detail: recentCount ? `${recentCount.toLocaleString()} recent records` : 'No recent imports' });

      setResult({ passed: checks.every(c => c.passed), checks, loading: false, error: null });
    } catch (error) {
      setResult({ passed: false, checks, loading: false, error: error instanceof Error ? error.message : 'Verification failed' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={() => { setOpen(true); runVerification(); }}>
          <Shield className="h-4 w-4 mr-1" />Verify
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />{displayName} Verification</DialogTitle>
          <DialogDescription>Validation checks on loaded data</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {result.loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : result.error ? (
            <div className="rounded-md bg-destructive/10 p-4 text-destructive"><AlertCircle className="h-5 w-5 inline mr-2" />{result.error}</div>
          ) : (
            <>
              <div className="space-y-2">
                {result.checks.map((check, i) => (
                  <div key={i} className={`flex items-center justify-between p-2 rounded-md ${check.passed ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                    <div className="flex items-center gap-2">
                      {check.passed ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                      <span className="text-sm font-medium">{check.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{check.detail}</span>
                  </div>
                ))}
              </div>
              <div className={`rounded-md p-4 ${result.passed ? 'bg-green-100 dark:bg-green-900/30 border border-green-300' : 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300'}`}>
                {result.passed ? <><CheckCircle2 className="h-5 w-5 text-green-600 inline mr-2" />ALL CHECKS PASSED</> : <><AlertCircle className="h-5 w-5 text-amber-600 inline mr-2" />SOME CHECKS FAILED</>}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
