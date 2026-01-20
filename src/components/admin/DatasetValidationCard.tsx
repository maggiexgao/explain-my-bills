/**
 * Dataset Validation Card
 * 
 * Validates loaded datasets for data quality issues using the dataset registry.
 * Includes:
 * - Row count thresholds
 * - Distinct code validation
 * - Code coercion detection (numeric vs alphanumeric)
 * - Prefix distribution analysis
 * - Ingestion self-test per dataset
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  ShieldCheck,
  Database,
  ChevronDown,
  ChevronUp,
  Play
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { DATASET_CONFIG, analyzeCodeColumn, validateDatasetStats, type DatasetInfo } from '@/lib/datasetConfig';

interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  count?: number;
  severity?: 'error' | 'warn' | 'info';
}

interface ValidationResult {
  dataset: string;
  tableName: string;
  status: 'pass' | 'warn' | 'fail';
  rowCount: number;
  distinctCodes: number;
  checks: ValidationCheck[];
  sampleCodes: string[];
  topPrefixes: Record<string, number>;
  notes?: string;
}

export function DatasetValidationCard() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleExpanded = (dataset: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dataset)) {
        newSet.delete(dataset);
      } else {
        newSet.add(dataset);
      }
      return newSet;
    });
  };

  /**
   * Run validation for a single dataset
   */
  const validateDataset = async (config: DatasetInfo): Promise<ValidationResult> => {
    const checks: ValidationCheck[] = [];
    let rowCount = 0;
    let distinctCodes = 0;
    let sampleCodes: string[] = [];
    let topPrefixes: Record<string, number> = {};

    try {
      // Get row count
      const countResult = await supabase
        .from(config.tableName as any)
        .select('*', { count: 'exact', head: true });
      
      rowCount = countResult.count || 0;

      // Check 1: Minimum row count
      checks.push({
        name: 'Minimum row count',
        passed: rowCount >= config.minExpectedRows,
        message: rowCount === 0 
          ? `EMPTY - no data imported`
          : rowCount >= config.minExpectedRows
            ? `${rowCount.toLocaleString()} rows loaded`
            : `Only ${rowCount.toLocaleString()} rows (need ≥${config.minExpectedRows.toLocaleString()})`,
        count: rowCount,
        severity: rowCount === 0 ? 'error' : rowCount < config.minExpectedRows ? 'error' : undefined
      });

      // If table is empty, skip further checks
      if (rowCount === 0) {
        return {
          dataset: config.displayName,
          tableName: config.tableName,
          status: 'fail',
          rowCount: 0,
          distinctCodes: 0,
          checks,
          sampleCodes: [],
          topPrefixes: {},
          notes: config.notes
        };
      }

      // For datasets with a code column, run detailed analysis
      if (config.codeColumn) {
        // Fetch sample (up to 50k for accuracy)
        const sampleSize = Math.min(rowCount, 50000);
        const sampleResult = await supabase
          .from(config.tableName as any)
          .select(config.codeColumn)
          .limit(sampleSize);

        if (sampleResult.data && sampleResult.data.length > 0) {
          const analysis = analyzeCodeColumn(sampleResult.data, config.codeColumn, config);
          
          distinctCodes = analysis.distinctCount;
          sampleCodes = analysis.sampleCodes;
          topPrefixes = analysis.prefixBreakdown;

          const nullRate = analysis.totalChecked > 0 
            ? (analysis.nullOrEmptyCount / analysis.totalChecked) * 100 
            : 0;
          const alphaRate = analysis.totalChecked > 0 
            ? (analysis.alphaCodeCount / analysis.totalChecked) * 100 
            : 0;

          // Check 2: Distinct codes (for HCPCS datasets)
          if (config.minExpectedDistinctCodes > 0) {
            const lowDistinct = distinctCodes < config.minExpectedDistinctCodes;
            const veryLowDistinct = distinctCodes < 50 && rowCount > 5000;
            
            checks.push({
              name: 'Distinct code count',
              passed: !lowDistinct && !veryLowDistinct,
              message: veryLowDistinct
                ? `CRITICAL: Only ${distinctCodes} distinct codes from ${rowCount.toLocaleString()} rows - likely data coercion!`
                : lowDistinct
                  ? `${distinctCodes} distinct (expected ≥${config.minExpectedDistinctCodes})`
                  : `${distinctCodes.toLocaleString()} distinct codes`,
              count: distinctCodes,
              severity: veryLowDistinct ? 'error' : lowDistinct ? 'warn' : undefined
            });
          }

          // Check 3: Null/empty code rate
          checks.push({
            name: `Empty ${config.codeColumn} rate`,
            passed: nullRate <= 5,
            message: nullRate <= 5 
              ? `${nullRate.toFixed(1)}% empty (acceptable)` 
              : `${nullRate.toFixed(1)}% empty (too high!)`,
            count: analysis.nullOrEmptyCount,
            severity: nullRate > 5 ? 'warn' : undefined
          });

          // Check 4: Alpha code rate (for HCPCS datasets that should have alpha codes)
          if (config.expectedCodeType === 'hcpcs') {
            if (['dmepos_fee_schedule', 'dmepen_fee_schedule'].includes(config.tableName)) {
              // DME datasets should have mostly alpha codes (A/E/K/L/B)
              checks.push({
                name: 'Alpha codes present',
                passed: alphaRate >= 50,
                message: alphaRate >= 50 
                  ? `${alphaRate.toFixed(1)}% codes have letters (correct for DME)` 
                  : `Only ${alphaRate.toFixed(1)}% alpha codes - expected A/E/K/L/B codes. Possible numeric coercion!`,
                severity: alphaRate < 50 ? 'error' : undefined
              });
            } else if (config.tableName === 'opps_addendum_b') {
              // OPPS should have some alpha codes (C/G/J/Q)
              checks.push({
                name: 'Alpha codes present',
                passed: alphaRate >= 10,
                message: alphaRate >= 10 
                  ? `${alphaRate.toFixed(1)}% codes have letters` 
                  : `Only ${alphaRate.toFixed(1)}% alpha - expected some C/G/J/Q codes`,
                severity: alphaRate < 10 ? 'warn' : undefined
              });
            } else if (config.tableName === 'clfs_fee_schedule') {
              // CLFS lab codes are mostly numeric (80xxx-89xxx)
              checks.push({
                name: 'Numeric lab codes',
                passed: alphaRate < 30,
                message: alphaRate < 30 
                  ? `${(100 - alphaRate).toFixed(1)}% numeric codes (correct for lab)` 
                  : `${alphaRate.toFixed(1)}% alpha codes - lab codes should be mostly numeric`,
                severity: alphaRate >= 30 ? 'warn' : 'info'
              });
            }
          }

          // Check 5: Code prefix distribution
          const prefixCount = Object.keys(topPrefixes).length;
          if (config.expectedCodeType === 'hcpcs' && prefixCount > 0) {
            // Check for suspicious patterns
            const topPrefix = Object.entries(topPrefixes).sort((a, b) => b[1] - a[1])[0];
            const topPrefixPct = (topPrefix[1] / analysis.totalChecked) * 100;
            
            // If one prefix dominates >80%, might indicate issue
            if (topPrefixPct > 80 && config.tableName !== 'dmepen_fee_schedule') {
              checks.push({
                name: 'Prefix diversity',
                passed: false,
                message: `${topPrefixPct.toFixed(0)}% of codes start with "${topPrefix[0]}" - unusual concentration`,
                severity: 'warn'
              });
            }
          }
        }
      }

      // Determine overall status
      const hasError = checks.some(c => c.severity === 'error' && !c.passed);
      const hasWarn = checks.some(c => c.severity === 'warn' && !c.passed);
      const status = hasError ? 'fail' : hasWarn ? 'warn' : 'pass';

      return {
        dataset: config.displayName,
        tableName: config.tableName,
        status,
        rowCount,
        distinctCodes,
        checks,
        sampleCodes,
        topPrefixes,
        notes: config.notes
      };

    } catch (error) {
      console.error(`Validation error for ${config.tableName}:`, error);
      checks.push({
        name: 'Table access',
        passed: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
        severity: 'error'
      });

      return {
        dataset: config.displayName,
        tableName: config.tableName,
        status: 'fail',
        rowCount: 0,
        distinctCodes: 0,
        checks,
        sampleCodes: [],
        topPrefixes: {}
      };
    }
  };

  const runValidation = useCallback(async () => {
    setLoading(true);
    setResults([]);

    try {
      // Validate all datasets in parallel
      const configs = [
        DATASET_CONFIG.mpfs_benchmarks,
        DATASET_CONFIG.gpci_localities,
        DATASET_CONFIG.zip_to_locality,
        DATASET_CONFIG.opps_addendum_b,
        DATASET_CONFIG.dmepos_fee_schedule,
        DATASET_CONFIG.dmepen_fee_schedule,
        DATASET_CONFIG.clfs_fee_schedule,
        DATASET_CONFIG.gpci_state_avg_2026,
      ];

      const validationResults = await Promise.all(configs.map(validateDataset));
      setResults(validationResults);

      // Auto-expand failed results
      const failed = validationResults.filter(r => r.status === 'fail').map(r => r.dataset);
      setExpandedResults(new Set(failed));

    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const passCount = results.filter(r => r.status === 'pass').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const failCount = results.filter(r => r.status === 'fail').length;

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
              Check data quality, code coercion, and ingestion integrity
            </CardDescription>
          </div>
          <Button onClick={runValidation} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Run Validation
          </Button>
        </div>
      </CardHeader>
      
      {results.length > 0 && (
        <CardContent>
          {/* Summary badges */}
          <div className="flex gap-2 mb-4">
            {passCount > 0 && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                {passCount} Passed
              </Badge>
            )}
            {warnCount > 0 && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                {warnCount} Warning
              </Badge>
            )}
            {failCount > 0 && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                {failCount} Failed
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            {results.map((result) => (
              <Collapsible 
                key={result.dataset}
                open={expandedResults.has(result.dataset)}
                onOpenChange={() => toggleExpanded(result.dataset)}
              >
                <div 
                  className={cn(
                    'p-3 rounded-lg border',
                    result.status === 'pass' ? 'bg-success/5 border-success/30' :
                    result.status === 'warn' ? 'bg-warning/5 border-warning/30' :
                    'bg-destructive/5 border-destructive/30'
                  )}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between">
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
                          {result.rowCount.toLocaleString()} rows
                          {result.distinctCodes > 0 && ` • ${result.distinctCodes.toLocaleString()} distinct`}
                        </span>
                      </h4>
                      <div className="flex items-center gap-2">
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
                        {expandedResults.has(result.dataset) ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                      {/* Validation checks */}
                      <div className="space-y-1.5">
                        {result.checks.map((check, j) => (
                          <div key={j} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {check.passed ? (
                                <CheckCircle className="h-3 w-3 text-success" />
                              ) : check.severity === 'error' ? (
                                <XCircle className="h-3 w-3 text-destructive" />
                              ) : check.severity === 'warn' ? (
                                <AlertTriangle className="h-3 w-3 text-warning" />
                              ) : (
                                <CheckCircle className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className="text-muted-foreground">{check.name}</span>
                            </div>
                            <span className={cn(
                              'text-xs',
                              check.passed ? 'text-muted-foreground' : 
                              check.severity === 'error' ? 'text-destructive' : 
                              check.severity === 'warn' ? 'text-warning' : 'text-muted-foreground'
                            )}>
                              {check.message}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Sample codes */}
                      {result.sampleCodes.length > 0 && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Sample codes: </span>
                          <code className="bg-muted px-1 rounded text-[10px]">
                            {result.sampleCodes.slice(0, 10).join(', ')}
                          </code>
                        </div>
                      )}

                      {/* Top prefixes */}
                      {Object.keys(result.topPrefixes).length > 0 && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Prefix distribution: </span>
                          <span className="font-mono">
                            {Object.entries(result.topPrefixes)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 8)
                              .map(([prefix, count]) => `${prefix}:${count}`)
                              .join(' ')}
                          </span>
                        </div>
                      )}

                      {/* Notes */}
                      {result.notes && (
                        <div className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded">
                          💡 {result.notes}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
