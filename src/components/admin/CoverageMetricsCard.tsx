/**
 * CoverageMetricsCard Component
 * 
 * Shows current dataset row counts across all Medicare reference sources.
 * Uses exact counts from database (no distinct code calculation which has bugs).
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet, RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DatasetMetric {
  label: string;
  count: number | null;
  minExpected: number;
  unit: string;
}

interface CoverageMetricsCardProps {
  refreshTrigger?: number;
}

export function CoverageMetricsCard({ refreshTrigger }: CoverageMetricsCardProps) {
  const [metrics, setMetrics] = useState<DatasetMetric[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel queries for exact row counts only (no distinct code calculation)
      const [
        mpfsResult,
        oppsResult,
        clfsResult,
        dmeposResult,
        dmepenResult,
        gpciResult,
        gpciStateAvgResult,
        zipResult
      ] = await Promise.all([
        supabase.from('mpfs_benchmarks').select('*', { count: 'exact', head: true }),
        supabase.from('opps_addendum_b').select('*', { count: 'exact', head: true }),
        supabase.from('clfs_fee_schedule').select('*', { count: 'exact', head: true }),
        supabase.from('dmepos_fee_schedule').select('*', { count: 'exact', head: true }),
        supabase.from('dmepen_fee_schedule').select('*', { count: 'exact', head: true }),
        supabase.from('gpci_localities').select('*', { count: 'exact', head: true }),
        supabase.from('gpci_state_avg_2026').select('*', { count: 'exact', head: true }),
        supabase.from('zip_to_locality').select('*', { count: 'exact', head: true })
      ]);

      setMetrics([
        { label: 'MPFS (Physician)', count: mpfsResult.count, minExpected: 10000, unit: 'records' },
        { label: 'OPPS (Outpatient)', count: oppsResult.count, minExpected: 8000, unit: 'records' },
        { label: 'CLFS (Lab)', count: clfsResult.count, minExpected: 500, unit: 'records' },
        { label: 'DMEPOS (Equipment)', count: dmeposResult.count, minExpected: 1000, unit: 'records' },
        { label: 'DMEPEN (Nutrition)', count: dmepenResult.count, minExpected: 100, unit: 'records' },
        { label: 'GPCI Localities', count: gpciResult.count, minExpected: 1000, unit: 'localities' },
        { label: 'GPCI State Avg', count: gpciStateAvgResult.count, minExpected: 45, unit: 'states' },
        { label: 'ZIP Crosswalk', count: zipResult.count, minExpected: 30000, unit: 'ZIPs' }
      ]);
    } catch (error) {
      console.error('Error loading coverage metrics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics, refreshTrigger]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Coverage Metrics</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={loadMetrics} 
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <CardDescription>
          Row counts across all Medicare reference tables
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <MetricBox key={m.label} metric={m} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBox({ metric }: { metric: DatasetMetric }) {
  const isLoaded = metric.count !== null && metric.count > 0;
  const isSufficient = metric.count !== null && metric.count >= metric.minExpected;
  
  return (
    <div className={`p-3 rounded-lg border text-center ${
      isLoaded 
        ? isSufficient 
          ? 'bg-success/5 border-success/30' 
          : 'bg-warning/5 border-warning/30'
        : 'bg-destructive/5 border-destructive/30'
    }`}>
      <div className="flex items-center justify-center gap-1 mb-1">
        {isLoaded ? (
          <CheckCircle2 className={`h-3 w-3 ${isSufficient ? 'text-success' : 'text-warning'}`} />
        ) : (
          <AlertCircle className="h-3 w-3 text-destructive" />
        )}
        <span className="text-xs font-medium text-muted-foreground truncate">
          {metric.label}
        </span>
      </div>
      <div className={`text-lg font-bold ${
        isLoaded 
          ? isSufficient ? 'text-success' : 'text-warning'
          : 'text-destructive'
      }`}>
        {metric.count !== null ? metric.count.toLocaleString() : '—'}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {metric.unit}
      </div>
    </div>
  );
}
