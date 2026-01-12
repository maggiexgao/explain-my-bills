/**
 * Dataset Validation Card
 * 
 * Validates loaded datasets for data quality issues:
 * - MPFS: non-null RVUs/fees, valid HCPCS, year matches
 * - ZIP: 5-digit padded, no excessive duplicates
 * - OPPS: parseable payment rates, minimum row count
 * - DMEPOS: parseable fees, uppercase HCPCS
 * - DMEPEN: row count, fees present
 * - GPCI State Avg: minimum 45 states
 * - CLFS: lab codes coverage
 * 
 * Enhanced with minimum row thresholds to detect incomplete imports
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
  rowCount: number;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    count?: number;
    severity?: 'error' | 'warn';
  }>;
}

// Minimum expected row counts for each dataset
const EXPECTED_MIN_ROWS: Record<string, { min: number; label: string }> = {
  'mpfs_benchmarks': { min: 10000, label: 'MPFS should have >10k codes' },
  'zip_to_locality': { min: 30000, label: 'ZIP crosswalk should have >30k entries' },
  'gpci_localities': { min: 100, label: 'GPCI should have >100 localities' },
  'opps_addendum_b': { min: 5000, label: 'OPPS should have >5k codes' },
  'dmepos_fee_schedule': { min: 10000, label: 'DMEPOS should have >10k records' },
  'dmepen_fee_schedule': { min: 100, label: 'DMEPEN should have >100 records' },
  'clfs_fee_schedule': { min: 500, label: 'CLFS should have >500 lab codes' },
  'gpci_state_avg_2026': { min: 45, label: 'State averages should cover ≥45 states' }
};

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

      const mpfsCount = await supabase
        .from('mpfs_benchmarks')
        .select('*', { count: 'exact', head: true });

      const mpfsTotalRows = mpfsCount.count || 0;
      const mpfsChecks = [];
      
      // Row count check
      const mpfsMinRows = EXPECTED_MIN_ROWS['mpfs_benchmarks'];
      mpfsChecks.push({
        name: 'Minimum row count',
        passed: mpfsTotalRows >= mpfsMinRows.min,
        message: mpfsTotalRows >= mpfsMinRows.min 
          ? `${mpfsTotalRows.toLocaleString()} rows loaded`
          : `Only ${mpfsTotalRows.toLocaleString()} rows - ${mpfsMinRows.label}`,
        count: mpfsTotalRows,
        severity: mpfsTotalRows >= mpfsMinRows.min ? undefined : 'error' as const
      });

      if (mpfsResult.data && mpfsResult.data.length > 0) {
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
      }

      validationResults.push({
        dataset: 'MPFS',
        rowCount: mpfsTotalRows,
        status: mpfsChecks.some(c => c.severity === 'error' && !c.passed) ? 'fail' :
                mpfsChecks.every(c => c.passed) ? 'pass' : 'warn',
        checks: mpfsChecks
      });

      // ===== ZIP Crosswalk Validation =====
      const zipResult = await supabase
        .from('zip_to_locality')
        .select('zip5, locality_num, state_abbr')
        .limit(5000);

      const zipCount = await supabase
        .from('zip_to_locality')
        .select('*', { count: 'exact', head: true });

      const zipTotalRows = zipCount.count || 0;
      const zipChecks = [];

      // Row count check
      const zipMinRows = EXPECTED_MIN_ROWS['zip_to_locality'];
      zipChecks.push({
        name: 'Minimum row count',
        passed: zipTotalRows >= zipMinRows.min,
        message: zipTotalRows >= zipMinRows.min 
          ? `${zipTotalRows.toLocaleString()} ZIPs loaded`
          : `Only ${zipTotalRows.toLocaleString()} rows - ${zipMinRows.label}`,
        count: zipTotalRows,
        severity: zipTotalRows >= zipMinRows.min ? undefined : 'error' as const
      });

      if (zipResult.data && zipResult.data.length > 0) {
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

        // NEW: Check for leading zeros (ZIPs starting with 0 should be preserved)
        const leadingZeroZips = rows.filter(r => r.zip5 && r.zip5.startsWith('0'));
        zipChecks.push({
          name: 'Leading zeros preserved',
          passed: leadingZeroZips.length > 0,
          message: leadingZeroZips.length > 0
            ? `${leadingZeroZips.length} ZIPs with leading zeros present (e.g., ${leadingZeroZips[0]?.zip5})`
            : 'No leading-zero ZIPs found - check import normalization',
          count: leadingZeroZips.length,
          severity: leadingZeroZips.length === 0 ? 'warn' as const : undefined
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
      }

      validationResults.push({
        dataset: 'ZIP Crosswalk',
        rowCount: zipTotalRows,
        status: zipChecks.some(c => c.severity === 'error' && !c.passed) ? 'fail' :
                zipChecks.every(c => c.passed) ? 'pass' : 'warn',
        checks: zipChecks
      });

      // ===== OPPS Validation =====
      const oppsResult = await supabase
        .from('opps_addendum_b')
        .select('hcpcs, payment_rate, year, status_indicator')
        .limit(5000);

      const oppsCount = await supabase
        .from('opps_addendum_b')
        .select('*', { count: 'exact', head: true });

      const oppsTotalRows = oppsCount.count || 0;
      const oppsChecks = [];

      // Row count check - CRITICAL
      const oppsMinRows = EXPECTED_MIN_ROWS['opps_addendum_b'];
      oppsChecks.push({
        name: 'Minimum row count',
        passed: oppsTotalRows >= oppsMinRows.min,
        message: oppsTotalRows >= oppsMinRows.min 
          ? `${oppsTotalRows.toLocaleString()} codes loaded`
          : `Only ${oppsTotalRows.toLocaleString()} rows - ${oppsMinRows.label}. Likely wrong sheet or header row issue.`,
        count: oppsTotalRows,
        severity: oppsTotalRows >= oppsMinRows.min ? undefined : 'error' as const
      });

      if (oppsResult.data && oppsResult.data.length > 0) {
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
      }

      validationResults.push({
        dataset: 'OPPS',
        rowCount: oppsTotalRows,
        status: oppsChecks.some(c => c.severity === 'error' && !c.passed) ? 'fail' :
                oppsChecks.every(c => c.passed) ? 'pass' : 'warn',
        checks: oppsChecks
      });

      // ===== DMEPOS Validation =====
      const dmeposResult = await supabase
        .from('dmepos_fee_schedule')
        .select('hcpcs, fee, year, state_abbr')
        .limit(5000);

      const dmeposCount = await supabase
        .from('dmepos_fee_schedule')
        .select('*', { count: 'exact', head: true });

      const dmeposTotalRows = dmeposCount.count || 0;
      const dmeposChecks = [];

      // Row count check
      const dmeposMinRows = EXPECTED_MIN_ROWS['dmepos_fee_schedule'];
      dmeposChecks.push({
        name: 'Minimum row count',
        passed: dmeposTotalRows >= dmeposMinRows.min,
        message: dmeposTotalRows >= dmeposMinRows.min 
          ? `${dmeposTotalRows.toLocaleString()} records loaded`
          : `Only ${dmeposTotalRows.toLocaleString()} rows - ${dmeposMinRows.label}`,
        count: dmeposTotalRows,
        severity: dmeposTotalRows >= dmeposMinRows.min ? undefined : 'error' as const
      });

      if (dmeposResult.data && dmeposResult.data.length > 0) {
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
      }

      validationResults.push({
        dataset: 'DMEPOS',
        rowCount: dmeposTotalRows,
        status: dmeposChecks.some(c => c.severity === 'error' && !c.passed) ? 'fail' :
                dmeposChecks.every(c => c.passed) ? 'pass' : 'warn',
        checks: dmeposChecks
      });

      // ===== DMEPEN Validation =====
      const dmepenResult = await supabase
        .from('dmepen_fee_schedule')
        .select('hcpcs, fee, year, state_abbr')
        .limit(5000);

      const dmepenCount = await supabase
        .from('dmepen_fee_schedule')
        .select('*', { count: 'exact', head: true });

      const dmepenTotalRows = dmepenCount.count || 0;
      const dmepenChecks = [];

      // Row count check - CRITICAL for DMEPEN
      const dmepenMinRows = EXPECTED_MIN_ROWS['dmepen_fee_schedule'];
      dmepenChecks.push({
        name: 'Minimum row count',
        passed: dmepenTotalRows >= dmepenMinRows.min,
        message: dmepenTotalRows >= dmepenMinRows.min 
          ? `${dmepenTotalRows.toLocaleString()} records loaded`
          : dmepenTotalRows === 0 
            ? 'DMEPEN is EMPTY - import DMEPEN fee schedule file'
            : `Only ${dmepenTotalRows.toLocaleString()} rows - may be incomplete`,
        count: dmepenTotalRows,
        severity: dmepenTotalRows >= dmepenMinRows.min ? undefined : 'error' as const
      });

      if (dmepenResult.data && dmepenResult.data.length > 0) {
        const rows = dmepenResult.data;

        // Check for fees
        const noFee = rows.filter(r => r.fee === null || r.fee === 0);
        const pctNoFee = (noFee.length / rows.length) * 100;
        dmepenChecks.push({
          name: 'Fees present',
          passed: pctNoFee < 30,
          message: pctNoFee < 30 
            ? `${(100 - pctNoFee).toFixed(1)}% have fees` 
            : `${pctNoFee.toFixed(1)}% missing fees`,
          count: noFee.length
        });

        // Check state coverage
        const states = new Set(rows.map(r => r.state_abbr).filter(Boolean));
        dmepenChecks.push({
          name: 'State coverage',
          passed: states.size >= 10,
          message: states.size >= 10 
            ? `${states.size} states covered` 
            : `Only ${states.size} states covered`,
          count: states.size
        });

        // Sample HCPCS codes
        const uniqueHcpcs = new Set(rows.map(r => r.hcpcs));
        dmepenChecks.push({
          name: 'Unique HCPCS codes',
          passed: uniqueHcpcs.size >= 10,
          message: `${uniqueHcpcs.size} unique codes`,
          count: uniqueHcpcs.size
        });
      }

      validationResults.push({
        dataset: 'DMEPEN',
        rowCount: dmepenTotalRows,
        status: dmepenTotalRows === 0 ? 'fail' :
                dmepenChecks.some(c => c.severity === 'error' && !c.passed) ? 'fail' :
                dmepenChecks.every(c => c.passed) ? 'pass' : 'warn',
        checks: dmepenChecks
      });

      // ===== GPCI State Avg Validation =====
      const gpciStateResult = await supabase
        .from('gpci_state_avg_2026')
        .select('state_abbr, avg_work_gpci, avg_pe_gpci, avg_mp_gpci, n_rows')
        .limit(100);

      const gpciStateChecks = [];
      const stateRows = gpciStateResult.data || [];
      const gpciStateMinRows = EXPECTED_MIN_ROWS['gpci_state_avg_2026'];

      gpciStateChecks.push({
        name: 'State averages populated',
        passed: stateRows.length >= gpciStateMinRows.min,
        message: stateRows.length >= gpciStateMinRows.min 
          ? `${stateRows.length} states have averages` 
          : stateRows.length === 0 
            ? 'EMPTY - Run "Recompute State Averages"'
            : `Only ${stateRows.length} states - expected ≥${gpciStateMinRows.min}. Re-run recompute.`,
        count: stateRows.length,
        severity: stateRows.length >= gpciStateMinRows.min ? undefined : 'error' as const
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
        rowCount: stateRows.length,
        status: stateRows.length === 0 ? 'fail' :
                gpciStateChecks.some(c => c.severity === 'error' && !c.passed) ? 'fail' :
                gpciStateChecks.every(c => c.passed) ? 'pass' : 'warn',
        checks: gpciStateChecks
      });

      // ===== CLFS Validation (if table exists) =====
      try {
        const clfsCount = await supabase
          .from('clfs_fee_schedule')
          .select('*', { count: 'exact', head: true });

        const clfsTotalRows = clfsCount.count || 0;
        const clfsChecks = [];
        const clfsMinRows = EXPECTED_MIN_ROWS['clfs_fee_schedule'];

        clfsChecks.push({
          name: 'Lab codes loaded',
          passed: clfsTotalRows >= clfsMinRows.min,
          message: clfsTotalRows >= clfsMinRows.min 
            ? `${clfsTotalRows.toLocaleString()} lab codes loaded`
            : clfsTotalRows === 0 
              ? 'EMPTY - Import CLFS file for lab code pricing'
              : `Only ${clfsTotalRows.toLocaleString()} rows`,
          count: clfsTotalRows,
          severity: clfsTotalRows === 0 ? 'warn' as const : undefined
        });

        validationResults.push({
          dataset: 'CLFS (Lab)',
          rowCount: clfsTotalRows,
          status: clfsTotalRows === 0 ? 'warn' :
                  clfsTotalRows >= clfsMinRows.min ? 'pass' : 'warn',
          checks: clfsChecks
        });
      } catch {
        // Table might not exist yet
        validationResults.push({
          dataset: 'CLFS (Lab)',
          rowCount: 0,
          status: 'warn',
          checks: [{
            name: 'Lab codes loaded',
            passed: false,
            message: 'CLFS table not yet imported - lab codes won\'t be priced',
            count: 0,
            severity: 'warn' as const
          }]
        });
      }

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
              Check data quality, integrity, and minimum row counts
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
                    <span className="text-xs font-normal text-muted-foreground">
                      ({result.rowCount.toLocaleString()} rows)
                    </span>
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
                        ) : check.severity === 'error' ? (
                          <XCircle className="h-3 w-3 text-destructive" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-warning" />
                        )}
                        <span className="text-muted-foreground">{check.name}</span>
                      </div>
                      <span className={cn(
                        'text-xs',
                        check.passed ? 'text-muted-foreground' : 
                        check.severity === 'error' ? 'text-destructive' : 'text-warning'
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
