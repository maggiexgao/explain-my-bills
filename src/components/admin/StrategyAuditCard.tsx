/**
 * Strategy Audit Card
 * 
 * Generates a comprehensive strategy audit report showing:
 * - Datasets loaded (rows, codes, years)
 * - What each dataset enables
 * - Runtime decision trees
 * - Coverage & data gaps
 * - Recommendations
 * - Misinformation guardrails
 * - Persistence: Save & view past audit runs
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  FileText, 
  Copy, 
  Check, 
  Database, 
  Shield, 
  GitBranch, 
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Save,
  History,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DatasetStatus {
  name: string;
  table: string;
  rowCount: number;
  uniqueCodes: number;
  years: number[];
  lastUpdated: string | null;
  enables: string;
}

interface GapMetrics {
  totalAnalyses: number;
  noTotalsRate: number;
  onlyPatientBalanceRate: number;
  geoFallbackRate: number;
  noPricedItemsRate: number;
  topMissingCodes: Array<{ code: string; count: number; system: string }>;
}

interface AuditReport {
  generatedAt: string;
  datasets: DatasetStatus[];
  gapMetrics: GapMetrics | null;
  recommendations: string[];
  guardrails: string[];
  summaryPass: number;
  summaryWarn: number;
  summaryFail: number;
}

interface PastAuditRun {
  id: string;
  created_at: string;
  status: string;
  summary_pass: number;
  summary_warn: number;
  summary_fail: number;
  report_markdown: string | null;
}

export function StrategyAuditCard() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [pastRuns, setPastRuns] = useState<PastAuditRun[]>([]);
  const [loadingPastRuns, setLoadingPastRuns] = useState(false);
  const [selectedPastRun, setSelectedPastRun] = useState<PastAuditRun | null>(null);

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel dataset queries
      const [
        mpfsResult,
        gpciResult,
        gpciStateAvgResult,
        zipResult,
        oppsResult,
        dmeposResult,
        dmepenResult,
        clfsResult,
        gapEventsResult,
        missingCodesResult
      ] = await Promise.all([
        supabase.from('mpfs_benchmarks').select('hcpcs, year, created_at', { count: 'exact' }),
        supabase.from('gpci_localities').select('state_abbr, created_at', { count: 'exact' }),
        supabase.from('gpci_state_avg_2026').select('state_abbr', { count: 'exact' }),
        supabase.from('zip_to_locality').select('zip5, effective_year, created_at', { count: 'exact' }),
        supabase.from('opps_addendum_b').select('hcpcs, year, created_at', { count: 'exact' }),
        supabase.from('dmepos_fee_schedule').select('hcpcs, year, created_at', { count: 'exact' }),
        supabase.from('dmepen_fee_schedule').select('hcpcs, year, created_at', { count: 'exact' }),
        supabase.from('clfs_fee_schedule').select('hcpcs, year, created_at', { count: 'exact' }),
        supabase.from('analysis_gap_events').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('analysis_missing_codes').select('*').order('count', { ascending: false }).limit(20)
      ]);

      // Track pass/warn/fail counts
      let passCount = 0;
      let warnCount = 0;
      let failCount = 0;

      // Dataset thresholds for validation
      const thresholds: Record<string, number> = {
        'mpfs_benchmarks': 10000,
        'gpci_localities': 1000,
        'gpci_state_avg_2026': 45,
        'zip_to_locality': 30000,
        'opps_addendum_b': 8000,
        'dmepos_fee_schedule': 10000,
        'dmepen_fee_schedule': 500,
        'clfs_fee_schedule': 1000
      };

      // Process dataset status
      const datasets: DatasetStatus[] = [
        {
          name: 'MPFS (Physician Fee Schedule)',
          table: 'mpfs_benchmarks',
          rowCount: mpfsResult.count || 0,
          uniqueCodes: new Set(mpfsResult.data?.map(r => r.hcpcs)).size,
          years: [...new Set(mpfsResult.data?.map(r => r.year))].filter(Boolean).sort() as number[],
          lastUpdated: mpfsResult.data?.[0]?.created_at || null,
          enables: 'Professional services pricing (RVU-based), E/M codes, procedures'
        },
        {
          name: 'GPCI Localities',
          table: 'gpci_localities',
          rowCount: gpciResult.count || 0,
          uniqueCodes: new Set(gpciResult.data?.map(r => r.state_abbr)).size,
          years: [2026],
          lastUpdated: gpciResult.data?.[0]?.created_at || null,
          enables: 'Geographic adjustment factors for locality-specific pricing'
        },
        {
          name: 'GPCI State Averages',
          table: 'gpci_state_avg_2026',
          rowCount: gpciStateAvgResult.count || 0,
          uniqueCodes: gpciStateAvgResult.count || 0,
          years: [2026],
          lastUpdated: null,
          enables: 'State-level fallback when exact locality not mapped'
        },
        {
          name: 'ZIP Crosswalk',
          table: 'zip_to_locality',
          rowCount: zipResult.count || 0,
          uniqueCodes: new Set(zipResult.data?.map(r => r.zip5)).size,
          years: [...new Set(zipResult.data?.map(r => r.effective_year))].filter(Boolean).sort() as number[],
          lastUpdated: zipResult.data?.[0]?.created_at || null,
          enables: 'ZIP → Medicare locality mapping for geographic adjustments'
        },
        {
          name: 'OPPS Addendum B',
          table: 'opps_addendum_b',
          rowCount: oppsResult.count || 0,
          uniqueCodes: new Set(oppsResult.data?.map(r => r.hcpcs)).size,
          years: [...new Set(oppsResult.data?.map(r => r.year))].filter(Boolean).sort() as number[],
          lastUpdated: oppsResult.data?.[0]?.created_at || null,
          enables: 'Hospital outpatient payments (APC-based)'
        },
        {
          name: 'DMEPOS Fee Schedule',
          table: 'dmepos_fee_schedule',
          rowCount: dmeposResult.count || 0,
          uniqueCodes: new Set(dmeposResult.data?.map(r => r.hcpcs)).size,
          years: [...new Set(dmeposResult.data?.map(r => r.year))].filter(Boolean).sort() as number[],
          lastUpdated: dmeposResult.data?.[0]?.created_at || null,
          enables: 'Durable medical equipment pricing'
        },
        {
          name: 'DMEPEN Fee Schedule',
          table: 'dmepen_fee_schedule',
          rowCount: dmepenResult.count || 0,
          uniqueCodes: new Set(dmepenResult.data?.map(r => r.hcpcs)).size,
          years: [...new Set(dmepenResult.data?.map(r => r.year))].filter(Boolean).sort() as number[],
          lastUpdated: dmepenResult.data?.[0]?.created_at || null,
          enables: 'Enteral/parenteral nutrition fee schedule'
        },
        {
          name: 'CLFS (Clinical Lab)',
          table: 'clfs_fee_schedule',
          rowCount: clfsResult.count || 0,
          uniqueCodes: new Set(clfsResult.data?.map(r => r.hcpcs)).size,
          years: [...new Set(clfsResult.data?.map(r => r.year))].filter(Boolean).sort() as number[],
          lastUpdated: clfsResult.data?.[0]?.created_at || null,
          enables: 'Clinical laboratory test pricing'
        }
      ];

      // Count pass/fail based on thresholds
      datasets.forEach(d => {
        const threshold = thresholds[d.table] || 0;
        if (d.rowCount === 0) {
          failCount++;
        } else if (d.rowCount < threshold) {
          warnCount++;
        } else {
          passCount++;
        }
      });

      // Compute gap metrics
      let gapMetrics: GapMetrics | null = null;
      const events = gapEventsResult.data || [];
      if (events.length > 0) {
        gapMetrics = {
          totalAnalyses: events.length,
          noTotalsRate: events.filter((e: Record<string, unknown>) => 
            !e.totals_detected_type || e.totals_detected_type === 'none'
          ).length / events.length,
          onlyPatientBalanceRate: events.filter((e: Record<string, unknown>) => 
            e.totals_detected_type === 'patient_balance' || e.totals_detected_type === 'amount_due'
          ).length / events.length,
          geoFallbackRate: events.filter((e: Record<string, unknown>) => e.used_state_fallback).length / events.length,
          noPricedItemsRate: events.filter((e: Record<string, unknown>) => 
            (Number(e.priced_item_count) || 0) === 0
          ).length / events.length,
          topMissingCodes: (missingCodesResult.data || []).slice(0, 10).map((c: Record<string, unknown>) => ({
            code: String(c.code),
            count: Number(c.count) || 0,
            system: String(c.code_system_guess || 'unknown')
          }))
        };
      }

      // Generate recommendations
      const recommendations: string[] = [];
      
      if ((gpciStateAvgResult.count || 0) === 0) {
        recommendations.push('CRITICAL: Run "Recompute GPCI State Averages" to enable state-level fallback pricing');
      } else if ((gpciStateAvgResult.count || 0) < 45) {
        recommendations.push(`WARNING: GPCI state averages incomplete (${gpciStateAvgResult.count} states) - expected 50+`);
        warnCount++;
      }

      if ((dmepenResult.count || 0) === 0) {
        recommendations.push('CRITICAL: DMEPEN fee schedule is empty - import DMEPEN file to enable nutrition equipment pricing');
      }

      if ((oppsResult.count || 0) < 8000) {
        recommendations.push(`WARNING: OPPS rowcount is low (${oppsResult.count}) - expected 8000+ for full coverage`);
      }

      if ((clfsResult.count || 0) === 0) {
        recommendations.push('Import CLFS (Clinical Lab Fee Schedule) to enable lab code pricing');
      }
      
      if (gapMetrics && gapMetrics.noTotalsRate > 0.3) {
        recommendations.push(`High totals extraction failure rate (${Math.round(gapMetrics.noTotalsRate * 100)}%) - consider improving prompt`);
      }
      
      if (gapMetrics && gapMetrics.geoFallbackRate > 0.5) {
        recommendations.push(`High geo fallback rate (${Math.round(gapMetrics.geoFallbackRate * 100)}%) - improve ZIP detection in documents`);
      }

      // Check for missing datasets
      const labCodesMissing = (missingCodesResult.data || []).filter((c: Record<string, unknown>) => {
        const code = String(c.code);
        const num = parseInt(code.replace(/\D/g, ''), 10);
        return num >= 80000 && num <= 89999;
      });
      if (labCodesMissing.length > 0 && (clfsResult.count || 0) === 0) {
        recommendations.push(`${labCodesMissing.length} lab codes detected but not priceable - import CLFS`);
      }

      // Guardrails
      const guardrails: string[] = [
        'Multiple computed ONLY when numerator scope matches denominator scope',
        'Prefer matched_billed_total vs medicare_reference_matched_total',
        'NEVER compute multiple using patientBalance or amountDue',
        'If totals are null/unknown: show "Not detected" not $0',
        'Minimum coverage threshold (70%) required for document total comparison',
        'Patient balance detected triggers "Limited Data" status',
        'All code explanations labeled with source and confidence'
      ];

      setReport({
        generatedAt: new Date().toISOString(),
        datasets,
        gapMetrics,
        recommendations,
        guardrails,
        summaryPass: passCount,
        summaryWarn: warnCount,
        summaryFail: failCount
      });

    } catch (error) {
      console.error('Error generating audit report:', error);
      toast.error('Failed to generate audit report');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAudit = useCallback(async () => {
    if (!report) return;
    
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in to save audits');
        return;
      }

      const markdownReport = generateMarkdown(report);
      
      const insertData = {
        report_markdown: markdownReport,
        report_json: report as unknown,
        dataset_snapshot: {
          datasets: report.datasets.map(d => ({
            table: d.table,
            rowCount: d.rowCount,
            uniqueCodes: d.uniqueCodes
          }))
        } as unknown,
        summary_pass: report.summaryPass,
        summary_warn: report.summaryWarn,
        summary_fail: report.summaryFail,
        status: report.summaryFail > 0 ? 'fail' : report.summaryWarn > 0 ? 'warn' : 'pass'
      };
      
      const { error } = await supabase
        .from('strategy_audit_runs')
        .insert(insertData as any);

      if (error) throw error;
      
      toast.success('Audit saved successfully');
      loadPastRuns();
    } catch (error) {
      console.error('Error saving audit:', error);
      toast.error('Failed to save audit');
    } finally {
      setSaving(false);
    }
  }, [report]);

  const loadPastRuns = useCallback(async () => {
    setLoadingPastRuns(true);
    try {
      const { data, error } = await supabase
        .from('strategy_audit_runs')
        .select('id, created_at, status, summary_pass, summary_warn, summary_fail, report_markdown')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setPastRuns(data || []);
    } catch (error) {
      console.error('Error loading past runs:', error);
    } finally {
      setLoadingPastRuns(false);
    }
  }, []);

  useEffect(() => {
    generateReport();
    loadPastRuns();
  }, [generateReport, loadPastRuns]);

  const generateMarkdown = (r: AuditReport): string => {
    return `
# Strategy Audit Report
Generated: ${new Date(r.generatedAt).toLocaleString()}

## Summary
- ✅ Pass: ${r.summaryPass}
- ⚠️ Warn: ${r.summaryWarn}
- ❌ Fail: ${r.summaryFail}

## Datasets Loaded
${r.datasets.map(d => `
### ${d.name}
- Table: ${d.table}
- Rows: ${d.rowCount.toLocaleString()}
- Unique Codes: ${d.uniqueCodes.toLocaleString()}
- Years: ${d.years.join(', ') || 'N/A'}
- Enables: ${d.enables}
`).join('')}

## Gap Metrics (Last 100 Analyses)
${r.gapMetrics ? `
- Total Analyses: ${r.gapMetrics.totalAnalyses}
- No Totals Rate: ${Math.round(r.gapMetrics.noTotalsRate * 100)}%
- Patient Balance Only Rate: ${Math.round(r.gapMetrics.onlyPatientBalanceRate * 100)}%
- Geo Fallback Rate: ${Math.round(r.gapMetrics.geoFallbackRate * 100)}%
- No Priced Items Rate: ${Math.round(r.gapMetrics.noPricedItemsRate * 100)}%
- Top Missing Codes: ${r.gapMetrics.topMissingCodes.map(c => `${c.code} (${c.count}×)`).join(', ')}
` : 'No telemetry data available'}

## Recommendations
${r.recommendations.map(rec => `- ${rec}`).join('\n')}

## Misinformation Guardrails
${r.guardrails.map(g => `- ${g}`).join('\n')}
`.trim();
  };

  const copyToClipboard = useCallback(() => {
    if (!report) return;
    navigator.clipboard.writeText(generateMarkdown(report));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [report]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Strategy Audit
            </CardTitle>
            <CardDescription>
              Comprehensive report on datasets, coverage, and guardrails
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={generateReport} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={saveAudit} disabled={!report || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={loadPastRuns}>
                  <History className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Past Audit Runs</DialogTitle>
                </DialogHeader>
                {loadingPastRuns ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : pastRuns.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No saved audits yet</p>
                ) : (
                  <div className="space-y-2">
                    {pastRuns.map(run => (
                      <div
                        key={run.id}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                          selectedPastRun?.id === run.id && "ring-2 ring-primary"
                        )}
                        onClick={() => setSelectedPastRun(selectedPastRun?.id === run.id ? null : run)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {run.status === 'pass' && <CheckCircle className="h-4 w-4 text-success" />}
                            {run.status === 'warn' && <AlertCircle className="h-4 w-4 text-warning" />}
                            {run.status === 'fail' && <XCircle className="h-4 w-4 text-destructive" />}
                            <span className="text-sm font-medium">
                              {new Date(run.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <Badge variant="outline" className="text-success border-success/30">
                              {run.summary_pass} pass
                            </Badge>
                            <Badge variant="outline" className="text-warning border-warning/30">
                              {run.summary_warn} warn
                            </Badge>
                            <Badge variant="outline" className="text-destructive border-destructive/30">
                              {run.summary_fail} fail
                            </Badge>
                          </div>
                        </div>
                        {selectedPastRun?.id === run.id && run.report_markdown && (
                          <div className="mt-3 pt-3 border-t">
                            <ScrollArea className="h-64">
                              <pre className="text-xs whitespace-pre-wrap font-mono">
                                {run.report_markdown}
                              </pre>
                            </ScrollArea>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(run.report_markdown || '');
                                toast.success('Copied to clipboard');
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={copyToClipboard} disabled={!report}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {expanded && report && (
        <CardContent className="space-y-6">
          {/* Summary Badges */}
          <div className="flex gap-2">
            <Badge variant="outline" className={cn(
              "px-3 py-1",
              report.summaryPass > 0 && "text-success border-success/30 bg-success/5"
            )}>
              <CheckCircle className="h-3 w-3 mr-1" />
              {report.summaryPass} Pass
            </Badge>
            <Badge variant="outline" className={cn(
              "px-3 py-1",
              report.summaryWarn > 0 && "text-warning border-warning/30 bg-warning/5"
            )}>
              <AlertCircle className="h-3 w-3 mr-1" />
              {report.summaryWarn} Warn
            </Badge>
            <Badge variant="outline" className={cn(
              "px-3 py-1",
              report.summaryFail > 0 && "text-destructive border-destructive/30 bg-destructive/5"
            )}>
              <XCircle className="h-3 w-3 mr-1" />
              {report.summaryFail} Fail
            </Badge>
          </div>

          {/* Datasets */}
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Database className="h-4 w-4" />
              Datasets Loaded
            </h3>
            <div className="grid gap-2">
              {report.datasets.map((d, i) => (
                <div key={i} className={cn(
                  'p-3 rounded-lg border text-sm',
                  d.rowCount > 0 ? 'bg-success/5 border-success/30' : 'bg-destructive/5 border-destructive/30'
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{d.name}</span>
                    <Badge variant="outline" className={cn(
                      'text-xs',
                      d.rowCount > 0 ? 'text-success border-success/30' : 'text-destructive border-destructive/30'
                    )}>
                      {d.rowCount > 0 ? `${d.rowCount.toLocaleString()} rows` : 'Empty'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{d.enables}</p>
                  {d.rowCount > 0 && (
                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{d.uniqueCodes} unique codes</span>
                      {d.years.length > 0 && <span>• Years: {d.years.join(', ')}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Gap Metrics */}
          {report.gapMetrics && (
            <>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <GitBranch className="h-4 w-4" />
                  Coverage & Data Gaps
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricBox 
                    label="No Totals" 
                    value={`${Math.round(report.gapMetrics.noTotalsRate * 100)}%`}
                    warning={report.gapMetrics.noTotalsRate > 0.3}
                  />
                  <MetricBox 
                    label="Balance Only" 
                    value={`${Math.round(report.gapMetrics.onlyPatientBalanceRate * 100)}%`}
                    warning={report.gapMetrics.onlyPatientBalanceRate > 0.2}
                  />
                  <MetricBox 
                    label="Geo Fallback" 
                    value={`${Math.round(report.gapMetrics.geoFallbackRate * 100)}%`}
                    warning={report.gapMetrics.geoFallbackRate > 0.5}
                  />
                  <MetricBox 
                    label="No Priced Items" 
                    value={`${Math.round(report.gapMetrics.noPricedItemsRate * 100)}%`}
                    warning={report.gapMetrics.noPricedItemsRate > 0.3}
                  />
                </div>
                
                {report.gapMetrics.topMissingCodes.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-2">Top Missing Codes:</div>
                    <div className="flex flex-wrap gap-1">
                      {report.gapMetrics.topMissingCodes.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {c.code} <span className="text-muted-foreground ml-1">{c.count}×</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Recommendations
                </h3>
                <div className="space-y-2">
                  {report.recommendations.map((r, i) => (
                    <div key={i} className={cn(
                      "p-2 rounded border text-sm",
                      r.includes('CRITICAL') 
                        ? 'bg-destructive/5 border-destructive/30' 
                        : 'bg-warning/5 border-warning/30'
                    )}>
                      {r}
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Guardrails */}
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-success" />
              Misinformation Guardrails
            </h3>
            <ScrollArea className="h-32">
              <ul className="space-y-1 text-sm text-muted-foreground">
                {report.guardrails.map((g, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="h-3 w-3 mt-1 text-success shrink-0" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function MetricBox({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className={cn(
      'p-2 rounded text-center border',
      warning ? 'bg-warning/5 border-warning/30' : 'bg-muted/30 border-border/30'
    )}>
      <div className={cn('text-lg font-bold', warning && 'text-warning')}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}