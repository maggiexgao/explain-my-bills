/**
 * DatasetStatusBar Component
 * 
 * Sticky status bar showing all dataset coverage at a glance.
 * Uses dataset registry for accurate stats and validation.
 */

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle2, 
  AlertCircle, 
  MinusCircle, 
  RefreshCw,
  Loader2,
  Database,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DATASET_CONFIG, analyzeCodeColumn, validateDatasetStats, type DatasetInfo } from '@/lib/datasetConfig';

interface DatasetStatus {
  key: string;
  name: string;
  description: string;
  status: 'loaded' | 'partial' | 'missing';
  validationStatus: 'pass' | 'warn' | 'fail';
  rowCount: number;
  distinctCodes: number;
  codeColumnUsed: string | null;
  isEstimated: boolean;
  nullOrEmptyRate: number;
  alphaCodeRate: number;
  sampleCodes: string[];
  topPrefixes: Record<string, number>;
  validationMessages: string[];
  notes?: string;
}

interface DatasetStatusBarProps {
  refreshTrigger?: number;
}

/**
 * Fetch stats for a single dataset
 */
async function fetchDatasetStats(config: DatasetInfo): Promise<DatasetStatus> {
  const result: DatasetStatus = {
    key: config.key,
    name: config.displayName,
    description: config.description,
    status: 'missing',
    validationStatus: 'pass',
    rowCount: 0,
    distinctCodes: 0,
    codeColumnUsed: config.codeColumn,
    isEstimated: false,
    nullOrEmptyRate: 0,
    alphaCodeRate: 0,
    sampleCodes: [],
    topPrefixes: {},
    validationMessages: [],
    notes: config.notes
  };

  try {
    // Get row count
    const countResult = await supabase
      .from(config.tableName as any)
      .select('*', { count: 'exact', head: true });
    
    result.rowCount = countResult.count || 0;
    result.status = result.rowCount > 0 ? 'loaded' : 'missing';

    // If there's a code column, analyze it
    if (config.codeColumn && result.rowCount > 0) {
      // Fetch sample for analysis (up to 50k rows for accuracy)
      const sampleSize = Math.min(result.rowCount, 50000);
      const sampleResult = await supabase
        .from(config.tableName as any)
        .select(config.codeColumn)
        .limit(sampleSize);

      if (sampleResult.data && sampleResult.data.length > 0) {
        const analysis = analyzeCodeColumn(sampleResult.data, config.codeColumn, config);
        
        result.distinctCodes = analysis.distinctCount;
        result.sampleCodes = analysis.sampleCodes;
        result.topPrefixes = analysis.prefixBreakdown;
        result.nullOrEmptyRate = analysis.totalChecked > 0 
          ? (analysis.nullOrEmptyCount / analysis.totalChecked) * 100 
          : 0;
        result.alphaCodeRate = analysis.distinctCount > 0 
          ? (analysis.alphaCodeCount / analysis.totalChecked) * 100 
          : 0;
        result.isEstimated = sampleSize < result.rowCount;
      }
    }

    // Run validation
    const validation = validateDatasetStats(
      {
        rowCount: result.rowCount,
        distinctCodes: result.distinctCodes,
        nullOrEmptyRate: result.nullOrEmptyRate,
        alphaCodeRate: result.alphaCodeRate
      },
      config
    );
    
    result.validationStatus = validation.status;
    result.validationMessages = validation.messages;
    
    // Set overall status based on validation
    if (result.rowCount === 0) {
      result.status = 'missing';
    } else if (validation.status === 'fail') {
      result.status = 'partial';
    }

  } catch (error) {
    console.error(`Error fetching stats for ${config.tableName}:`, error);
    result.validationMessages = [`Error: ${error instanceof Error ? error.message : 'Unknown'}`];
    result.validationStatus = 'fail';
  }

  return result;
}

export function DatasetStatusBar({ refreshTrigger }: DatasetStatusBarProps) {
  const [datasets, setDatasets] = useState<DatasetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedDataset, setExpandedDataset] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      // Load all dataset stats in parallel
      const configs = [
        DATASET_CONFIG.mpfs_benchmarks,
        DATASET_CONFIG.gpci_localities,
        DATASET_CONFIG.zip_to_locality,
        DATASET_CONFIG.opps_addendum_b,
        DATASET_CONFIG.dmepos_fee_schedule,
        DATASET_CONFIG.dmepen_fee_schedule,
        DATASET_CONFIG.clfs_fee_schedule,
      ];

      const results = await Promise.all(configs.map(fetchDatasetStats));
      setDatasets(results);
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

  const StatusIcon = ({ status, validationStatus }: { status: string; validationStatus: string }) => {
    if (status === 'missing') {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    if (validationStatus === 'fail') {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    if (validationStatus === 'warn') {
      return <MinusCircle className="h-4 w-4 text-warning" />;
    }
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  };

  const StatusBadge = ({ status, validationStatus }: { status: string; validationStatus: string }) => {
    if (status === 'missing') {
      return <Badge variant="outline" className="text-[10px] h-5 bg-destructive/10 text-destructive border-destructive/30">Missing</Badge>;
    }
    if (validationStatus === 'fail') {
      return <Badge variant="outline" className="text-[10px] h-5 bg-destructive/10 text-destructive border-destructive/30">Error</Badge>;
    }
    if (validationStatus === 'warn') {
      return <Badge variant="outline" className="text-[10px] h-5 bg-warning/10 text-warning border-warning/30">Warning</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] h-5 bg-success/10 text-success border-success/30">OK</Badge>;
  };

  if (loading) {
    return (
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-5 w-5 text-primary" />
          <span className="font-semibold">Database Upload Status</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  const loadedCount = datasets.filter(d => d.status === 'loaded' && d.validationStatus !== 'fail').length;
  const totalCount = datasets.length;

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <span className="font-semibold">Database Upload Status</span>
          <Badge variant="outline" className="text-xs">
            {loadedCount}/{totalCount} OK
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
      
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {datasets.map((dataset) => (
          <Collapsible 
            key={dataset.key}
            open={expandedDataset === dataset.key}
            onOpenChange={(open) => setExpandedDataset(open ? dataset.key : null)}
          >
            <div 
              className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                dataset.status === 'missing'
                  ? 'bg-destructive/5 border-destructive/30 hover:bg-destructive/10' 
                  : dataset.validationStatus === 'fail'
                    ? 'bg-destructive/5 border-destructive/30 hover:bg-destructive/10'
                    : dataset.validationStatus === 'warn'
                      ? 'bg-warning/5 border-warning/30 hover:bg-warning/10'
                      : 'bg-success/5 border-success/30 hover:bg-success/10'
              }`}
            >
              <CollapsibleTrigger className="w-full text-left">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{dataset.name}</span>
                  <StatusIcon status={dataset.status} validationStatus={dataset.validationStatus} />
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight truncate">
                  {dataset.description}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <StatusBadge status={dataset.status} validationStatus={dataset.validationStatus} />
                  <span className="text-[10px] text-muted-foreground">
                    {dataset.rowCount > 0 
                      ? `${dataset.rowCount.toLocaleString()}`
                      : '—'}
                  </span>
                </div>
                {/* Show distinct codes for code-based datasets */}
                {dataset.codeColumnUsed && dataset.rowCount > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-between">
                    <span>{dataset.isEstimated ? '~' : ''}{dataset.distinctCodes.toLocaleString()} distinct</span>
                    <ChevronDown className="h-3 w-3" />
                  </div>
                )}
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                  {/* Validation messages */}
                  {dataset.validationMessages.length > 0 && (
                    <div className="space-y-1">
                      {dataset.validationMessages.map((msg, i) => (
                        <div key={i} className={`text-[10px] ${
                          dataset.validationStatus === 'fail' ? 'text-destructive' :
                          dataset.validationStatus === 'warn' ? 'text-warning' :
                          'text-success'
                        }`}>
                          {msg}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Stats details */}
                  {dataset.codeColumnUsed && (
                    <div className="text-[10px] space-y-1 text-muted-foreground">
                      <div>Column: <code className="bg-muted px-1 rounded">{dataset.codeColumnUsed}</code></div>
                      {dataset.nullOrEmptyRate > 0 && (
                        <div className={dataset.nullOrEmptyRate > 5 ? 'text-warning' : ''}>
                          Empty: {dataset.nullOrEmptyRate.toFixed(1)}%
                        </div>
                      )}
                      {dataset.alphaCodeRate !== undefined && dataset.rowCount > 0 && (
                        <div>Alpha codes: {dataset.alphaCodeRate.toFixed(1)}%</div>
                      )}
                    </div>
                  )}
                  
                  {/* Sample codes */}
                  {dataset.sampleCodes.length > 0 && (
                    <div className="text-[10px]">
                      <div className="text-muted-foreground mb-1">Sample:</div>
                      <div className="font-mono text-[9px] break-all">
                        {dataset.sampleCodes.slice(0, 8).join(', ')}
                      </div>
                    </div>
                  )}
                  
                  {/* Top prefixes */}
                  {Object.keys(dataset.topPrefixes).length > 0 && (
                    <div className="text-[10px]">
                      <div className="text-muted-foreground mb-1">Prefixes:</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(dataset.topPrefixes)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 6)
                          .map(([prefix, count]) => (
                            <span key={prefix} className="bg-muted px-1 rounded font-mono">
                              {prefix}: {count}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Notes */}
                  {dataset.notes && (
                    <div className="text-[9px] text-muted-foreground italic pt-1 border-t border-border/30">
                      {dataset.notes}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
