/**
 * DatasetStatusBar Component
 * 
 * Sticky status bar showing all dataset coverage at a glance.
 * This provides a quick overview of database upload status.
 */

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  AlertCircle, 
  MinusCircle, 
  RefreshCw,
  Loader2,
  Database
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DatasetStatus {
  name: string;
  description: string;
  status: 'loaded' | 'partial' | 'missing';
  rowCount: number;
  uniqueCodes: number;
  yearsAvailable?: string;
  lastUpdated?: string;
}

interface DatasetStatusBarProps {
  refreshTrigger?: number;
}

export function DatasetStatusBar({ refreshTrigger }: DatasetStatusBarProps) {
  const [datasets, setDatasets] = useState<DatasetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      // Parallel queries for all datasets
      const [
        mpfsResult,
        gpciResult,
        zipResult,
        oppsResult,
        dmeposResult,
        dmepenResult
      ] = await Promise.all([
        supabase.from('mpfs_benchmarks').select('hcpcs, created_at', { count: 'exact' }).limit(1),
        supabase.from('gpci_localities').select('locality_num, created_at', { count: 'exact' }).limit(1),
        supabase.from('zip_to_locality').select('zip5, updated_at', { count: 'exact' }).limit(1),
        supabase.from('opps_addendum_b').select('hcpcs, created_at', { count: 'exact' }).limit(1),
        supabase.from('dmepos_fee_schedule').select('hcpcs, created_at', { count: 'exact' }).limit(1),
        supabase.from('dmepen_fee_schedule').select('hcpcs, created_at', { count: 'exact' }).limit(1),
      ]);

      // Get unique code counts using proper string handling
      // CRITICAL: Never use numeric coercion on HCPCS codes!
      const [mpfsUnique, oppsUnique, dmeposUnique, dmepenUnique] = await Promise.all([
        supabase.from('mpfs_benchmarks').select('hcpcs').limit(50000),
        supabase.from('opps_addendum_b').select('hcpcs').limit(50000),
        supabase.from('dmepos_fee_schedule').select('hcpcs').limit(100000),
        supabase.from('dmepen_fee_schedule').select('hcpcs').limit(20000),
      ]);
      
      // Helper function to count unique codes with proper string normalization
      const countUniqueCodes = (data: { hcpcs: unknown }[] | null): number => {
        if (!data) return 0;
        const uniqueSet = new Set<string>();
        for (const row of data) {
          // CRITICAL: Always treat codes as strings, NEVER use Number() or parseInt()!
          const code = String(row.hcpcs || '').trim().toUpperCase();
          if (code && code.length >= 4 && code.length <= 5 && /^[A-Z0-9]{4,5}$/.test(code)) {
            uniqueSet.add(code);
          }
        }
        return uniqueSet.size;
      };

      const getStatus = (count: number | null): 'loaded' | 'partial' | 'missing' => {
        if (!count || count === 0) return 'missing';
        return 'loaded';
      };

      const formatDate = (dateStr?: string) => {
        if (!dateStr) return undefined;
        return new Date(dateStr).toLocaleDateString();
      };

      setDatasets([
        {
          name: 'MPFS',
          description: 'Medicare Physician Fee Schedule',
          status: getStatus(mpfsResult.count),
          rowCount: mpfsResult.count || 0,
          uniqueCodes: countUniqueCodes(mpfsUnique.data),
          yearsAvailable: '2026',
          lastUpdated: formatDate(mpfsResult.data?.[0]?.created_at)
        },
        {
          name: 'GPCI',
          description: 'Geographic Practice Cost Indices',
          status: getStatus(gpciResult.count),
          rowCount: gpciResult.count || 0,
          uniqueCodes: 0, // Localities, not codes
          yearsAvailable: '2026',
          lastUpdated: formatDate(gpciResult.data?.[0]?.created_at)
        },
        {
          name: 'ZIP Crosswalk',
          description: 'ZIP to Medicare Locality',
          status: getStatus(zipResult.count),
          rowCount: zipResult.count || 0,
          uniqueCodes: 0, // ZIPs, not codes
          yearsAvailable: '2026',
          lastUpdated: formatDate(zipResult.data?.[0]?.updated_at)
        },
        {
          name: 'OPPS',
          description: 'Hospital Outpatient Payment',
          status: getStatus(oppsResult.count),
          rowCount: oppsResult.count || 0,
          uniqueCodes: countUniqueCodes(oppsUnique.data),
          yearsAvailable: '2025',
          lastUpdated: formatDate(oppsResult.data?.[0]?.created_at)
        },
        {
          name: 'DMEPOS',
          description: 'Durable Medical Equipment',
          status: getStatus(dmeposResult.count),
          rowCount: dmeposResult.count || 0,
          uniqueCodes: countUniqueCodes(dmeposUnique.data),
          yearsAvailable: '2026',
          lastUpdated: formatDate(dmeposResult.data?.[0]?.created_at)
        },
        {
          name: 'DMEPEN',
          description: 'Enteral/Parenteral Nutrition',
          status: getStatus(dmepenResult.count),
          rowCount: dmepenResult.count || 0,
          uniqueCodes: countUniqueCodes(dmepenUnique.data),
          yearsAvailable: '2026',
          lastUpdated: formatDate(dmepenResult.data?.[0]?.created_at)
        },
      ]);
    } catch (error) {
      console.error('Error loading dataset status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus, refreshTrigger]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStatus();
  };

  const StatusIcon = ({ status }: { status: 'loaded' | 'partial' | 'missing' }) => {
    switch (status) {
      case 'loaded':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'partial':
        return <MinusCircle className="h-4 w-4 text-warning" />;
      case 'missing':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const StatusBadge = ({ status }: { status: 'loaded' | 'partial' | 'missing' }) => {
    const config = {
      loaded: { label: 'Loaded', className: 'bg-success/10 text-success border-success/30' },
      partial: { label: 'Partial', className: 'bg-warning/10 text-warning border-warning/30' },
      missing: { label: 'Missing', className: 'bg-destructive/10 text-destructive border-destructive/30' }
    };
    const { label, className } = config[status];
    return <Badge variant="outline" className={`text-[10px] h-5 ${className}`}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-5 w-5 text-primary" />
          <span className="font-semibold">Database Upload Status</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  const loadedCount = datasets.filter(d => d.status === 'loaded').length;
  const totalCount = datasets.length;

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <span className="font-semibold">Database Upload Status</span>
          <Badge variant="outline" className="text-xs">
            {loadedCount}/{totalCount} datasets loaded
          </Badge>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {datasets.map((dataset) => (
          <div 
            key={dataset.name}
            className={`p-2 rounded-lg border ${
              dataset.status === 'loaded' 
                ? 'bg-success/5 border-success/30' 
                : dataset.status === 'partial'
                  ? 'bg-warning/5 border-warning/30'
                  : 'bg-destructive/5 border-destructive/30'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">{dataset.name}</span>
              <StatusIcon status={dataset.status} />
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight">
              {dataset.description}
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <StatusBadge status={dataset.status} />
              <span className="text-[10px] text-muted-foreground">
                {dataset.rowCount > 0 
                  ? `${dataset.rowCount.toLocaleString()} rows`
                  : '—'}
              </span>
            </div>
            {dataset.uniqueCodes > 0 && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {dataset.uniqueCodes.toLocaleString()} codes
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
