/**
 * DatasetStatusDisplay Component
 * Shows what data is currently loaded in a database table
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Loader2, 
  Database,
  Clock,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DatasetStatus {
  rowCount: number;
  lastImportedAt: string | null;
  sampleCodes: string[];
  loading: boolean;
  error: string | null;
}

interface DatasetStatusDisplayProps {
  tableName: 'mpfs_benchmarks' | 'opps_addendum_b' | 'clfs_fee_schedule' | 
             'dmepos_fee_schedule' | 'dmepen_fee_schedule' | 'gpci_localities' | 
             'zip_to_locality';
  codeColumn?: string;
  minExpectedRows?: number;
  refreshTrigger?: number;
}

const tableColumnMap: Record<string, string> = {
  mpfs_benchmarks: 'hcpcs',
  opps_addendum_b: 'hcpcs',
  clfs_fee_schedule: 'hcpcs',
  dmepos_fee_schedule: 'hcpcs',
  dmepen_fee_schedule: 'hcpcs',
  gpci_localities: 'locality_num',
  zip_to_locality: 'zip5'
};

export function DatasetStatusDisplay({ 
  tableName, 
  codeColumn,
  minExpectedRows = 100,
  refreshTrigger = 0
}: DatasetStatusDisplayProps) {
  const [status, setStatus] = useState<DatasetStatus>({
    rowCount: 0,
    lastImportedAt: null,
    sampleCodes: [],
    loading: true,
    error: null
  });

  const column = codeColumn || tableColumnMap[tableName] || 'hcpcs';

  const fetchStatus = async () => {
    setStatus(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const { data: samples, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (sampleError) throw sampleError;

      const sampleCodes = [...new Set((samples || []).map((s) => String((s as Record<string, unknown>)[column] || '')))]
        .filter(Boolean)
        .slice(0, 5);

      const lastImportedAt = (samples?.[0] as Record<string, unknown>)?.created_at as string || null;

      setStatus({
        rowCount: count || 0,
        lastImportedAt,
        sampleCodes,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error(`Error fetching status for ${tableName}:`, error);
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch status'
      }));
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [tableName, refreshTrigger]);

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    } catch {
      return 'Unknown';
    }
  };

  const getStatusIndicator = () => {
    if (status.loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (status.error) return <AlertCircle className="h-4 w-4 text-destructive" />;
    if (status.rowCount === 0) return <XCircle className="h-4 w-4 text-destructive" />;
    if (status.rowCount < minExpectedRows) return <AlertCircle className="h-4 w-4 text-amber-500" />;
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  };

  const getStatusBadge = () => {
    if (status.loading) return <Badge variant="outline" className="text-xs">Loading...</Badge>;
    if (status.error) return <Badge variant="destructive" className="text-xs">Error</Badge>;
    if (status.rowCount === 0) return <Badge variant="destructive" className="text-xs">Empty</Badge>;
    if (status.rowCount < minExpectedRows) return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Partial</Badge>;
    return <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">Complete</Badge>;
  };

  if (status.error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Error: {status.error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIndicator()}
          <span className="text-sm font-medium flex items-center gap-1">
            <Database className="h-3 w-3 text-muted-foreground" />
            Currently in Database
          </span>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={fetchStatus} disabled={status.loading}>
            <RefreshCw className={`h-3 w-3 ${status.loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {!status.loading && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">Rows:</span>
          <span className="font-mono font-medium">{status.rowCount.toLocaleString()}</span>
          <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Last Import:</span>
          <span className="font-mono">{formatDate(status.lastImportedAt)}</span>
        </div>
      )}

      {!status.loading && status.sampleCodes.length > 0 && (
        <div className="pt-1 border-t border-border/50">
          <div className="text-xs text-muted-foreground mb-1">Sample codes:</div>
          <div className="flex flex-wrap gap-1">
            {status.sampleCodes.map((code) => (
              <Badge key={code} variant="outline" className="text-[10px] font-mono px-1.5 py-0">{code}</Badge>
            ))}
          </div>
        </div>
      )}

      {!status.loading && status.rowCount === 0 && (
        <div className="text-xs text-muted-foreground italic">No data loaded. Upload a file to import.</div>
      )}
    </div>
  );
}
