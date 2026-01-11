/**
 * Dataset Validation Card
 * 
 * Validates loaded datasets for data quality issues:
 * - MPFS: non-null RVUs/fees, valid HCPCS, year matches
 * - ZIP: 5-digit padded, no excessive duplicates
 * - OPPS: parseable payment rates
 * - DMEPOS: parseable fees, uppercase HCPCS
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  ShieldCheck,
  Database
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ValidationResult {
  dataset: string;
  status: 'pass' | 'warn' | 'fail';
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    count?: number;
  }>;
}

export function DatasetValidationCard() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ValidationResult[]>([]);

  const runValidation = useCallback(async () => {
    setLoading(true);
    const validationResults: ValidationResult[] = [];

    try {
      // ===== MPFS Validation =====
      const mpfsResult = await supabase
        .from('mpfs_benchmarks')
        .select('hcpcs, year, nonfac_fee, fac_fee, work_rvu, nonfac_pe_rvu, status')
        .limit(5000);

      if (mpfsResult.data && mpfsResult.data.length > 0) {
        const mpfsChecks = [];
        const rows = mpfsResult.data;
        
        // Check for valid HCPCS codes
        const invalidHcpcs = rows.filter(r => !r.hcpcs || r.hcpcs.length < 4);
        mpfsChecks.push({
          name: 'Valid HCPCS codes',
          passed: invalidHcpcs.length === 0,
          message: invalidHcpcs.length === 0 
            ? 'All HCPCS codes are valid' 
            : `${invalidHcpcs.length} rows have invalid HCPCS codes`,
          count: invalidHcpcs.length
        });

        // Check for fees or RVUs present
        const noFeeOrRvu = rows.filter(r => 
          (r.nonfac_fee === null || r.nonfac_fee === 0) &&
          (r.fac_fee === null || r.fac_fee === 0) &&
          (r.work_rvu === null || r.work_rvu === 0)
        );
        const pctNoFee = (noFeeOrRvu.length / rows.length) * 100;
        mpfsChecks.push({
          name: 'Fees/RVUs present',
          passed: pctNoFee < 20,
          message: pctNoFee < 20 
            ? `${(100 - pctNoFee).toFixed(1)}% have fees or RVUs` 
            : `${pctNoFee.toFixed(1)}% rows lack fees and RVUs`,
          count: noFeeOrRvu.length
        });

        // Check year consistency
        const years = [...new Set(rows.map(r => r.year))];
        mpfsChecks.push({
          name: 'Year consistency',
          passed: years.length <= 2,
          message: years.length <= 2 
            ? `Years present: ${years.join(', ')}` 
            : `Multiple years present: ${years.join(', ')}`,
          count: years.length
        });

        validationResults.push({
          dataset: 'MPFS',
          status: mpfsChecks.every(c => c.passed) ? 'pass' : mpfsChecks.some(c => !c.passed && c.name.includes('HCPCS')) ? 'fail' : 'warn',
          checks: mpfsChecks
        });
      }

      // ===== ZIP Crosswalk Validation =====
      const zipResult = await supabase
        .from('zip_to_locality')
        .select('zip5, locality_num, state_abbr')
        .limit(5000);

      if (zipResult.data && zipResult.data.length > 0) {
        const zipChecks = [];
        const rows = zipResult.data;

        // Check for 5-digit ZIP
        const invalidZips = rows.filter(r => !r.zip5 || r.zip5.length !== 5);
        zipChecks.push({
          name: 'Valid 5-digit ZIPs',
          passed: invalidZips.length === 0,
          message: invalidZips.length === 0 
            ? 'All ZIPs are 5 digits' 
            : `${invalidZips.length} invalid ZIPs detected`,
          count: invalidZips.length
        });

        // Check for duplicates
        const zipCounts = new Map<string, number>();
        rows.forEach(r => {
          zipCounts.set(r.zip5, (zipCounts.get(r.zip5) || 0) + 1);
        });
        const duplicates = [...zipCounts.entries()].filter(([_, count]) => count > 1);
        zipChecks.push({
          name: 'No excessive duplicates',
          passed: duplicates.length < rows.length * 0.1,
          message: duplicates.length < rows.length * 0.1 
            ? `${duplicates.length} duplicate ZIPs (acceptable)` 
            : `${duplicates.length} duplicate ZIPs (${(duplicates.length / rows.length * 100).toFixed(1)}%)`,
          count: duplicates.length
        });

        // Check for locality_num
        const noLocality = rows.filter(r => !r.locality_num);
        zipChecks.push({
          name: 'Locality number present',
          passed: noLocality.length === 0,
          message: noLocality.length === 0 
            ? 'All rows have locality number' 
            : `${noLocality.length} rows missing locality`,
          count: noLocality.length
        });

        validationResults.push({
          dataset: 'ZIP Crosswalk',
          status: zipChecks.every(c => c.passed) ? 'pass' : 'warn',
          checks: zipChecks
        });
      }

      // ===== OPPS Validation =====
      const oppsResult = await supabase
        .from('opps_addendum_b')
        .select('hcpcs, payment_rate, year, status_indicator')
        .limit(5000);

      if (oppsResult.data && oppsResult.data.length > 0) {
        const oppsChecks = [];
        const rows = oppsResult.data;

        // Check for valid payment rates
        const noPayment = rows.filter(r => r.payment_rate === null || r.payment_rate === 0);
        const pctNoPayment = (noPayment.length / rows.length) * 100;
        oppsChecks.push({
          name: 'Payment rates present',
          passed: pctNoPayment < 30,
          message: pctNoPayment < 30 
            ? `${(100 - pctNoPayment).toFixed(1)}% have payment rates` 
            : `${pctNoPayment.toFixed(1)}% missing payment rates`,
          count: noPayment.length
        });

        // Check HCPCS format
        const invalidHcpcs = rows.filter(r => !r.hcpcs || r.hcpcs.length < 4);
        oppsChecks.push({
          name: 'Valid HCPCS codes',
          passed: invalidHcpcs.length === 0,
          message: invalidHcpcs.length === 0 
            ? 'All HCPCS codes valid' 
            : `${invalidHcpcs.length} invalid HCPCS codes`,
          count: invalidHcpcs.length
        });

        validationResults.push({
          dataset: 'OPPS',
          status: oppsChecks.every(c => c.passed) ? 'pass' : 'warn',
          checks: oppsChecks
        });
      }

      // ===== DMEPOS Validation =====
      const dmeposResult = await supabase
        .from('dmepos_fee_schedule')
        .select('hcpcs, fee, year, state_abbr')
        .limit(5000);

      if (dmeposResult.data && dmeposResult.data.length > 0) {
        const dmeposChecks = [];
        const rows = dmeposResult.data;

        // Check for uppercase HCPCS
        const lowercaseHcpcs = rows.filter(r => r.hcpcs && r.hcpcs !== r.hcpcs.toUpperCase());
        dmeposChecks.push({
          name: 'HCPCS uppercase',
          passed: lowercaseHcpcs.length === 0,
          message: lowercaseHcpcs.length === 0 
            ? 'All HCPCS codes uppercase' 
            : `${lowercaseHcpcs.length} lowercase HCPCS codes`,
          count: lowercaseHcpcs.length
        });

        // Check for fees
        const noFee = rows.filter(r => r.fee === null || r.fee === 0);
        const pctNoFee = (noFee.length / rows.length) * 100;
        dmeposChecks.push({
          name: 'Fees present',
          passed: pctNoFee < 20,
          message: pctNoFee < 20 
            ? `${(100 - pctNoFee).toFixed(1)}% have fees` 
            : `${pctNoFee.toFixed(1)}% missing fees`,
          count: noFee.length
        });

        // Check state coverage
        const states = new Set(rows.map(r => r.state_abbr).filter(Boolean));
        dmeposChecks.push({
          name: 'State coverage',
          passed: states.size >= 10,
          message: states.size >= 10 
            ? `${states.size} states covered` 
            : `Only ${states.size} states covered`,
          count: states.size
        });

        validationResults.push({
          dataset: 'DMEPOS',
          status: dmeposChecks.every(c => c.passed) ? 'pass' : 'warn',
          checks: dmeposChecks
        });
      }

      // ===== GPCI State Avg Validation =====
      const gpciStateResult = await supabase
        .from('gpci_state_avg_2026')
        .select('state_abbr, avg_work_gpci, avg_pe_gpci, avg_mp_gpci, n_rows')
        .limit(100);

      const gpciStateChecks = [];
      const stateRows = gpciStateResult.data || [];

      gpciStateChecks.push({
        name: 'State averages populated',
        passed: stateRows.length >= 50,
        message: stateRows.length >= 50 
          ? `${stateRows.length} states have averages` 
          : `Only ${stateRows.length} states - run "Recompute State Averages"`,
        count: stateRows.length
      });

      if (stateRows.length > 0) {
        const invalidGpci = stateRows.filter(r => 
          r.avg_work_gpci <= 0 || r.avg_pe_gpci <= 0 || r.avg_mp_gpci <= 0
        );
        gpciStateChecks.push({
          name: 'Valid GPCI values',
          passed: invalidGpci.length === 0,
          message: invalidGpci.length === 0 
            ? 'All GPCI values valid' 
            : `${invalidGpci.length} states have invalid GPCI values`,
          count: invalidGpci.length
        });
      }

      validationResults.push({
        dataset: 'GPCI State Avg',
        status: gpciStateChecks.every(c => c.passed) ? 'pass' : stateRows.length === 0 ? 'fail' : 'warn',
        checks: gpciStateChecks
      });

      setResults(validationResults);
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Dataset Validation
            </CardTitle>
            <CardDescription>
              Check data quality and integrity across all datasets
            </CardDescription>
          </div>
          <Button onClick={runValidation} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
            Validate Datasets
          </Button>
        </div>
      </CardHeader>
      
      {results.length > 0 && (
        <CardContent>
          <div className="space-y-4">
            {results.map((result, i) => (
              <div 
                key={i} 
                className={cn(
                  'p-4 rounded-lg border',
                  result.status === 'pass' ? 'bg-success/5 border-success/30' :
                  result.status === 'warn' ? 'bg-warning/5 border-warning/30' :
                  'bg-destructive/5 border-destructive/30'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    {result.status === 'pass' ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : result.status === 'warn' ? (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    {result.dataset}
                  </h4>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      'text-xs',
                      result.status === 'pass' ? 'text-success border-success/30' :
                      result.status === 'warn' ? 'text-warning border-warning/30' :
                      'text-destructive border-destructive/30'
                    )}
                  >
                    {result.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {result.checks.map((check, j) => (
                    <div key={j} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {check.passed ? (
                          <CheckCircle className="h-3 w-3 text-success" />
                        ) : (
                          <XCircle className="h-3 w-3 text-warning" />
                        )}
                        <span className="text-muted-foreground">{check.name}</span>
                      </div>
                      <span className={cn(
                        'text-xs',
                        check.passed ? 'text-muted-foreground' : 'text-warning'
                      )}>
                        {check.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
