/**
 * DatasetStatusDisplay Component
 * Shows what data is currently loaded in a database table
 * Displays: row count, codes detected, last import date, sample codes
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
  RefreshCw,
  Hash,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DatasetStatus {
  rowCount: number;
  codesDetected: number;
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
  minExpectedCodes?: number;
  refreshTrigger?: number;
}

// Map table names to their code columns and expected counts
// IMPORTANT: p_code_column values must match what's validated in count_distinct_codes RPC
const tableConfig: Record<string, { 
  codeColumn: string;  // Must be 'hcpcs', 'locality_num', or 'zip5' for RPC
  datasetName: string;
  codeLabel: string;
  minExpectedCodes: number;
}> = {
  mpfs_benchmarks: { codeColumn: 'hcpcs', datasetName: 'mpfs', codeLabel: 'Codes', minExpectedCodes: 15000 },
  opps_addendum_b: { codeColumn: 'hcpcs', datasetName: 'opps', codeLabel: 'Codes', minExpectedCodes: 15000 },
  clfs_fee_schedule: { codeColumn: 'hcpcs', datasetName: 'clfs', codeLabel: 'Codes', minExpectedCodes: 1500 },
  dmepos_fee_schedule: { codeColumn: 'hcpcs', datasetName: 'dmepos', codeLabel: 'Codes', minExpectedCodes: 2000 },
  dmepen_fee_schedule: { codeColumn: 'hcpcs', datasetName: 'dmepen', codeLabel: 'Codes', minExpectedCodes: 30 },
  gpci_localities: { codeColumn: 'locality_num', datasetName: 'gpci', codeLabel: 'Localities', minExpectedCodes: 100 },
  zip_to_locality: { codeColumn: 'zip5', datasetName: 'zip-crosswalk', codeLabel: 'ZIP Codes', minExpectedCodes: 40000 }
};

export function DatasetStatusDisplay({ 
  tableName, 
  codeColumn,
  minExpectedRows = 100,
  minExpectedCodes,
  refreshTrigger = 0
}: DatasetStatusDisplayProps) {
  const [status, setStatus] = useState<DatasetStatus>({
    rowCount: 0,
    codesDetected: 0,
    lastImportedAt: null,
    sampleCodes: [],
    loading: true,
    error: null
  });

  const config = tableConfig[tableName];
  const column = codeColumn || config?.codeColumn || 'hcpcs';
  const datasetName = config?.datasetName || tableName;
  const codeLabel = config?.codeLabel || 'Codes';
  const expectedMinCodes = minExpectedCodes ?? config?.minExpectedCodes ?? 100;

  const fetchStatus = async () => {
    setStatus(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Get row count
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      // Get distinct code count using RPC function (no limit!)
      // The RPC function count_distinct_codes is SECURITY DEFINER so it can count without RLS restrictions
      let codesDetected = 0;
      try {
        console.log(`[DatasetStatus] Calling RPC count_distinct_codes for ${tableName}.${column}`);
        const { data: distinctCount, error: rpcError } = await supabase
          .rpc('count_distinct_codes', { 
            p_table_name: tableName,
            p_code_column: column
          });
        
        if (rpcError) {
          console.error(`[DatasetStatus] RPC error for ${tableName}:`, rpcError);
          // Fallback: fetch all codes (no limit) and count distinct
          // This may be capped by RLS/pagination but better than nothing
          codesDetected = await manualCodeCount(tableName, column);
        } else {
          console.log(`[DatasetStatus] RPC returned ${distinctCount} for ${tableName}`);
          codesDetected = distinctCount || 0;
        }
      } catch (rpcErr) {
        console.error(`[DatasetStatus] RPC exception for ${tableName}:`, rpcErr);
        codesDetected = await manualCodeCount(tableName, column);
      }

      // Get sample codes (just 5 for display) - this can use a small limit
      const { data: samples } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Extract unique sample codes from the small sample
      const sampleCodesSet = new Set<string>();
      (samples || []).forEach((s) => {
        const code = String((s as Record<string, unknown>)[column] || '');
        if (code) sampleCodesSet.add(code);
      });
      const sampleCodes = [...sampleCodesSet].slice(0, 5);

      // Get last import from import_logs table
      let lastImportedAt: string | null = null;
      try {
        const { data: lastImport } = await supabase
          .from('import_logs')
          .select('imported_at, rows_imported, status')
          .eq('dataset_name', datasetName)
          .eq('status', 'success')
          .order('imported_at', { ascending: false })
          .limit(1)
          .single();
        
        if (lastImport?.imported_at) {
          lastImportedAt = lastImport.imported_at;
        }
      } catch {
        // Fallback to created_at from table if import_logs fails
        lastImportedAt = (samples?.[0] as Record<string, unknown>)?.created_at as string || null;
      }

      // If no import log, use the most recent created_at
      if (!lastImportedAt && samples?.[0]) {
        lastImportedAt = (samples[0] as Record<string, unknown>)?.created_at as string || null;
      }

      setStatus({
        rowCount: count || 0,
        codesDetected,
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

  // Manual fallback for counting distinct codes (no limit!)
  const manualCodeCount = async (table: string, col: string): Promise<number> => {
    try {
      // Fetch ALL codes - no limit! Use the typed table name for supabase
      const typedTable = table as typeof tableName;
      const { data, error } = await supabase
        .from(typedTable)
        .select('*');
      
      if (error || !data) {
        console.error(`Manual count failed for ${table}:`, error);
        return 0;
      }
      
      // Count distinct non-null codes
      const distinctCodes = new Set(
        data
          .map(row => {
            const rowData = row as unknown as Record<string, unknown>;
            return rowData[col];
          })
          .filter(code => code !== null && code !== undefined && code !== '')
      );
      
      return distinctCodes.size;
    } catch (err) {
      console.error(`Manual count exception for ${table}:`, err);
      return 0;
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

  const isCodeCountSuspicious = (): boolean => {
    if (status.codesDetected === 0) return false;
    return status.codesDetected < expectedMinCodes * 0.5;
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
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      {/* Header */}
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

      {/* Metrics Grid - Valid Rows & Codes Detected */}
      {!status.loading && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background/50 rounded-lg p-2 border border-border/50">
            <div className="text-xs text-muted-foreground">Valid Rows</div>
            <div className="text-lg font-bold font-mono">{status.rowCount.toLocaleString()}</div>
          </div>
          <div className="bg-background/50 rounded-lg p-2 border border-border/50">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {codeLabel} Detected
            </div>
            <div className="text-lg font-bold font-mono">{status.codesDetected.toLocaleString()}</div>
            {isCodeCountSuspicious() && (
              <div className="flex items-center gap-1 text-amber-600 text-[10px] mt-1">
                <AlertTriangle className="h-3 w-3" />
                <span>Expected ~{expectedMinCodes.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Last Import */}
      {!status.loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Last Import: {formatDate(status.lastImportedAt)}</span>
        </div>
      )}

      {/* Sample Codes */}
      {!status.loading && status.sampleCodes.length > 0 && (
        <div className="pt-1 border-t border-border/50">
          <div className="text-xs text-muted-foreground mb-1">Sample {codeLabel.toLowerCase()}:</div>
          <div className="flex flex-wrap gap-1">
            {status.sampleCodes.map((code) => (
              <Badge key={code} variant="outline" className="text-[10px] font-mono px-1.5 py-0">{code}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!status.loading && status.rowCount === 0 && (
        <div className="text-xs text-muted-foreground italic">No data loaded. Upload a file to import.</div>
      )}

      {/* Data Complete Indicator */}
      {!status.loading && status.rowCount >= minExpectedRows && status.codesDetected >= expectedMinCodes * 0.5 && (
        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded p-2">
          <CheckCircle2 className="h-3 w-3" />
          <span>Data appears complete</span>
        </div>
      )}
    </div>
  );
}
