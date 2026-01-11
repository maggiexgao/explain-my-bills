/**
 * Data Gaps Diagnostic Card
 * 
 * Admin panel showing live gap detection from telemetry:
 * - Top missing codes (last 7d/30d)
 * - Totals extraction failure rate
 * - Geo fallback rate
 * - % analyses with no priced items
 * - Recommendations based on gaps
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle,
  TrendingUp,
  Code,
  FileWarning,
  MapPin,
  Lightbulb,
  RefreshCw,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface MissingCodeRow {
  code: string;
  code_system_guess: string;
  context_type: string;
  count: number;
  last_seen_at: string;
}

interface TotalsFailureRow {
  doc_type: string;
  failure_reason: string;
  count: number;
}

interface GapEventStats {
  totalAnalyses: number;
  zipPresentRate: number;
  stateFallbackRate: number;
  avgPricedItems: number;
  avgMissingCodes: number;
  noTotalsRate: number;
  noPricedItemsRate: number;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  impact: string;
}

export function DataGapsDiagnosticsCard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [missingCodes7d, setMissingCodes7d] = useState<MissingCodeRow[]>([]);
  const [missingCodes30d, setMissingCodes30d] = useState<MissingCodeRow[]>([]);
  const [totalsFailures, setTotalsFailures] = useState<TotalsFailureRow[]>([]);
  const [gapStats, setGapStats] = useState<GapEventStats | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const now = new Date();
      const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Parallel queries
      const [
        missingCodes7dResult,
        missingCodes30dResult,
        totalsFailuresResult,
        gapEventsResult
      ] = await Promise.all([
        supabase
          .from('analysis_missing_codes')
          .select('*')
          .gte('last_seen_at', days7Ago)
          .order('count', { ascending: false })
          .limit(20),
        supabase
          .from('analysis_missing_codes')
          .select('*')
          .gte('last_seen_at', days30Ago)
          .order('count', { ascending: false })
          .limit(30),
        supabase
          .from('analysis_totals_failures')
          .select('*')
          .order('count', { ascending: false })
          .limit(10),
        supabase
          .from('analysis_gap_events')
          .select('*')
          .gte('created_at', days30Ago)
          .order('created_at', { ascending: false })
          .limit(500)
      ]);

      // Safe type casting
      setMissingCodes7d((missingCodes7dResult.data || []) as MissingCodeRow[]);
      setMissingCodes30d((missingCodes30dResult.data || []) as MissingCodeRow[]);
      setTotalsFailures((totalsFailuresResult.data || []) as TotalsFailureRow[]);

      // Compute gap stats from events
      const events = gapEventsResult.data || [];
      if (events.length > 0) {
        const stats: GapEventStats = {
          totalAnalyses: events.length,
          zipPresentRate: events.filter((e: Record<string, unknown>) => e.zip_present).length / events.length,
          stateFallbackRate: events.filter((e: Record<string, unknown>) => e.used_state_fallback).length / events.length,
          avgPricedItems: events.reduce((sum: number, e: Record<string, unknown>) => sum + (Number(e.priced_item_count) || 0), 0) / events.length,
          avgMissingCodes: events.reduce((sum: number, e: Record<string, unknown>) => sum + (Number(e.missing_code_count) || 0), 0) / events.length,
          noTotalsRate: events.filter((e: Record<string, unknown>) => e.totals_detected_type === 'none' || !e.totals_detected_type).length / events.length,
          noPricedItemsRate: events.filter((e: Record<string, unknown>) => (Number(e.priced_item_count) || 0) === 0).length / events.length
        };
        setGapStats(stats);

        // Generate recommendations
        const recs: Recommendation[] = [];

        // Check for lab codes missing
        const labCodesMissing = (missingCodes30dResult.data as MissingCodeRow[] || [])
          .filter(c => {
            const num = parseInt(c.code.replace(/\D/g, ''), 10);
            return num >= 80000 && num <= 89999;
          });
        if (labCodesMissing.length > 0) {
          recs.push({
            priority: 'high',
            title: 'Add Clinical Lab Fee Schedule (CLFS)',
            reason: `${labCodesMissing.length} lab codes (80000-89999) detected but not priceable`,
            impact: 'Cover common lab tests like CBC, metabolic panels, urinalysis'
          });
        }

        // Check for drug codes (J-codes)
        const drugCodesMissing = (missingCodes30dResult.data as MissingCodeRow[] || [])
          .filter(c => c.code.startsWith('J'));
        if (drugCodesMissing.length > 0) {
          recs.push({
            priority: 'medium',
            title: 'Add Average Sales Price (ASP) for drugs',
            reason: `${drugCodesMissing.length} J-codes detected for injectable drugs`,
            impact: 'Enable drug pricing comparison for infusion and injection services'
          });
        }

        // Check for S-codes (private payer)
        const sCodesMissing = (missingCodes30dResult.data as MissingCodeRow[] || [])
          .filter(c => c.code.startsWith('S'));
        if (sCodesMissing.length > 3) {
          recs.push({
            priority: 'low',
            title: 'Note: S-codes detected frequently',
            reason: `${sCodesMissing.length} S-codes (private payer codes) detected`,
            impact: 'These are not Medicare codes and cannot be priced against Medicare'
          });
        }

        // High totals failure rate
        if (stats.noTotalsRate > 0.3) {
          recs.push({
            priority: 'high',
            title: 'Improve totals extraction',
            reason: `${Math.round(stats.noTotalsRate * 100)}% of analyses have no detected totals`,
            impact: 'Better prompt engineering or document preprocessing needed'
          });
        }

        // High geo fallback rate
        if (stats.stateFallbackRate > 0.5) {
          recs.push({
            priority: 'medium',
            title: 'Improve ZIP detection',
            reason: `${Math.round(stats.stateFallbackRate * 100)}% of analyses use state fallback`,
            impact: 'Add ZIP extraction from document addresses'
          });
        }

        setRecommendations(recs);
      } else {
        setGapStats(null);
        setRecommendations([]);
      }

    } catch (error) {
      console.error('Error loading gap diagnostics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Data Gap Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = gapStats && gapStats.totalAnalyses > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Data Gap Diagnostics
            </CardTitle>
            <CardDescription>
              Live gap detection from analysis telemetry (last 30 days)
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasData ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No analysis telemetry data yet.</p>
            <p className="text-sm">Run some bill analyses to populate gap diagnostics.</p>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                label="Total Analyses"
                value={gapStats.totalAnalyses.toString()}
                subtext="last 30 days"
              />
              <MetricCard
                label="No Priced Items"
                value={`${Math.round(gapStats.noPricedItemsRate * 100)}%`}
                subtext="of analyses"
                status={gapStats.noPricedItemsRate > 0.3 ? 'warning' : 'ok'}
              />
              <MetricCard
                label="Avg Missing Codes"
                value={gapStats.avgMissingCodes.toFixed(1)}
                subtext="per analysis"
                status={gapStats.avgMissingCodes > 3 ? 'warning' : 'ok'}
              />
              <MetricCard
                label="Geo Fallback"
                value={`${Math.round(gapStats.stateFallbackRate * 100)}%`}
                subtext="use state avg"
                status={gapStats.stateFallbackRate > 0.5 ? 'warning' : 'ok'}
              />
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Recommendations
                </h3>
                <div className="space-y-2">
                  {recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className={cn(
                        'p-3 rounded-lg border flex items-start gap-3',
                        rec.priority === 'high' ? 'bg-destructive/5 border-destructive/30' :
                        rec.priority === 'medium' ? 'bg-warning/5 border-warning/30' :
                        'bg-muted/30 border-border/30'
                      )}
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          'shrink-0 text-[10px]',
                          rec.priority === 'high' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                          rec.priority === 'medium' ? 'bg-warning/10 text-warning border-warning/30' :
                          ''
                        )}
                      >
                        {rec.priority}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{rec.title}</div>
                        <p className="text-xs text-muted-foreground">{rec.reason}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Impact:</span> {rec.impact}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Codes Tabs */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Code className="h-4 w-4" />
                Top Missing Codes
              </h3>
              <Tabs defaultValue="7d" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-8">
                  <TabsTrigger value="7d" className="text-xs">Last 7 Days</TabsTrigger>
                  <TabsTrigger value="30d" className="text-xs">Last 30 Days</TabsTrigger>
                </TabsList>
                <TabsContent value="7d" className="mt-2">
                  <MissingCodesList codes={missingCodes7d} />
                </TabsContent>
                <TabsContent value="30d" className="mt-2">
                  <MissingCodesList codes={missingCodes30d} />
                </TabsContent>
              </Tabs>
            </div>

            {/* Totals Failures */}
            {totalsFailures.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileWarning className="h-4 w-4" />
                  Totals Extraction Failures
                </h3>
                <div className="space-y-1">
                  {totalsFailures.slice(0, 5).map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded bg-warning/5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{f.doc_type}</Badge>
                        <span className="text-muted-foreground text-xs">{f.failure_reason}</span>
                      </div>
                      <span className="font-mono text-xs">{f.count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({ 
  label, 
  value, 
  subtext, 
  status = 'ok' 
}: { 
  label: string; 
  value: string; 
  subtext: string; 
  status?: 'ok' | 'warning' 
}) {
  return (
    <div className={cn(
      'p-3 rounded-lg border text-center',
      status === 'warning' ? 'bg-warning/5 border-warning/30' : 'bg-muted/30 border-border/30'
    )}>
      <div className={cn(
        'text-xl font-bold',
        status === 'warning' ? 'text-warning' : ''
      )}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-[10px] text-muted-foreground">{subtext}</div>
    </div>
  );
}

function MissingCodesList({ codes }: { codes: MissingCodeRow[] }) {
  if (codes.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No missing codes recorded
      </div>
    );
  }

  return (
    <div className="max-h-48 overflow-y-auto space-y-1">
      {codes.map((c, i) => (
        <div
          key={`${c.code}-${c.context_type}-${i}`}
          className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm"
        >
          <div className="flex items-center gap-2">
            <code className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">
              {c.code}
            </code>
            <Badge variant="outline" className="text-[10px]">{c.code_system_guess}</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{c.context_type}</span>
            <span className="font-mono">{c.count}×</span>
          </div>
        </div>
      ))}
    </div>
  );
}
