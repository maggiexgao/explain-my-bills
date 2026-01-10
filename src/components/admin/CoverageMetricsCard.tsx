/**
 * CoverageMetricsCard Component
 * 
 * Shows current dataset coverage across all Medicare reference sources
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CoverageMetrics {
  mpfs: { total: number; unique: number } | null;
  opps: { total: number; unique: number } | null;
  dmepos: { total: number; unique: number } | null;
  dmepen: { total: number; unique: number } | null;
  zipCrosswalk: { total: number } | null;
  gpci: { total: number } | null;
}

interface CoverageMetricsCardProps {
  refreshTrigger?: number; // Increment to trigger refresh
}

export function CoverageMetricsCard({ refreshTrigger }: CoverageMetricsCardProps) {
  const [metrics, setMetrics] = useState<CoverageMetrics>({
    mpfs: null,
    opps: null,
    dmepos: null,
    dmepen: null,
    zipCrosswalk: null,
    gpci: null
  });
  const [loading, setLoading] = useState(false);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel queries for all counts
      const [
        mpfsResult,
        mpfsUnique,
        oppsResult,
        oppsUnique,
        dmeposResult,
        dmeposUnique,
        dmepenResult,
        dmepenUnique,
        zipResult,
        gpciResult
      ] = await Promise.all([
        supabase.from('mpfs_benchmarks').select('*', { count: 'exact', head: true }),
        supabase.from('mpfs_benchmarks').select('hcpcs').limit(50000),
        supabase.from('opps_addendum_b').select('*', { count: 'exact', head: true }),
        supabase.from('opps_addendum_b').select('hcpcs').limit(50000),
        supabase.from('dmepos_fee_schedule').select('*', { count: 'exact', head: true }),
        supabase.from('dmepos_fee_schedule').select('hcpcs').limit(50000),
        supabase.from('dmepen_fee_schedule').select('*', { count: 'exact', head: true }),
        supabase.from('dmepen_fee_schedule').select('hcpcs').limit(50000),
        supabase.from('zip_to_locality').select('*', { count: 'exact', head: true }),
        supabase.from('gpci_localities').select('*', { count: 'exact', head: true })
      ]);

      setMetrics({
        mpfs: {
          total: mpfsResult.count || 0,
          unique: new Set(mpfsUnique.data?.map(r => r.hcpcs) || []).size
        },
        opps: {
          total: oppsResult.count || 0,
          unique: new Set(oppsUnique.data?.map(r => r.hcpcs) || []).size
        },
        dmepos: {
          total: dmeposResult.count || 0,
          unique: new Set(dmeposUnique.data?.map(r => r.hcpcs) || []).size
        },
        dmepen: {
          total: dmepenResult.count || 0,
          unique: new Set(dmepenUnique.data?.map(r => r.hcpcs) || []).size
        },
        zipCrosswalk: {
          total: zipResult.count || 0
        },
        gpci: {
          total: gpciResult.count || 0
        }
      });
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
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <CardTitle>Coverage Metrics</CardTitle>
        </div>
        <CardDescription>
          Current dataset coverage across all Medicare reference sources
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <MetricBox
            label="MPFS (Physician)"
            value={metrics.mpfs ? `${metrics.mpfs.total.toLocaleString()} rows, ${metrics.mpfs.unique.toLocaleString()} codes` : 'Not loaded'}
          />
          <MetricBox
            label="OPPS (Hospital Outpatient)"
            value={metrics.opps ? `${metrics.opps.total.toLocaleString()} rows, ${metrics.opps.unique.toLocaleString()} codes` : 'Not loaded'}
          />
          <MetricBox
            label="DMEPOS (Equipment)"
            value={metrics.dmepos ? `${metrics.dmepos.total.toLocaleString()} rows, ${metrics.dmepos.unique.toLocaleString()} codes` : 'Not loaded'}
          />
          <MetricBox
            label="DMEPEN (Nutrition)"
            value={metrics.dmepen ? `${metrics.dmepen.total.toLocaleString()} rows, ${metrics.dmepen.unique.toLocaleString()} codes` : 'Not loaded'}
          />
          <MetricBox
            label="ZIP → Locality"
            value={metrics.zipCrosswalk ? `${metrics.zipCrosswalk.total.toLocaleString()} ZIPs` : 'Not loaded'}
          />
          <MetricBox
            label="GPCI Localities"
            value={metrics.gpci ? `${metrics.gpci.total.toLocaleString()} localities` : 'Not loaded'}
          />
        </div>
        <Button 
          variant="outline" 
          onClick={loadMetrics} 
          disabled={loading}
          className="w-full mt-4"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Metrics
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-md border bg-muted/30">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground text-xs">{value}</p>
    </div>
  );
}
