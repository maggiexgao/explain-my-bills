/**
 * ImportCard Component
 * 
 * Reusable card for data import operations with:
 * - File upload with timeout and cancellation
 * - Dry run toggle
 * - Progress display with elapsed time
 * - Structured error display with expandable details
 * - Database status display
 * - Data verification modal
 * - Unified admin context for auth
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Database, 
  ChevronDown, 
  ChevronUp,
  Upload,
  Eye,
  Clock
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAdminContextStandalone } from '@/hooks/useAdminContext';
import { DatasetStatusDisplay } from './DatasetStatusDisplay';
import { VerifyDataModal } from './VerifyDataModal';

// Map dataType to table name for status display
const DATA_TYPE_TO_TABLE: Record<string, 'mpfs_benchmarks' | 'opps_addendum_b' | 'clfs_fee_schedule' | 
  'dmepos_fee_schedule' | 'dmepen_fee_schedule' | 'gpci_localities' | 'zip_to_locality'> = {
  mpfs: 'mpfs_benchmarks',
  opps: 'opps_addendum_b',
  clfs: 'clfs_fee_schedule',
  dmepos: 'dmepos_fee_schedule',
  dmepen: 'dmepen_fee_schedule',
  gpci: 'gpci_localities',
  'zip-crosswalk': 'zip_to_locality'
};

const MIN_EXPECTED_ROWS: Record<string, number> = {
  mpfs: 10000,
  opps: 5000,
  clfs: 1000,
  dmepos: 1000,
  dmepen: 100,
  gpci: 100,
  'zip-crosswalk': 30000
};

type ImportStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

const IMPORT_TIMEOUT_MS = 90000; // 90 seconds

interface ImportDetails {
  totalRowsRead?: number;
  validRows?: number;
  imported?: number;
  skipped?: number;
  sheetName?: string;
  headerRowIndex?: number;
  columnsDetected?: string[];
  sampleRows?: unknown[];
  skippedReasons?: Record<string, number>;
  rowsProcessed?: number;
  batchesCompleted?: number;
  rawResponse?: string;
  httpStatus?: number;
  httpStatusText?: string;
  authMode?: string;
}

interface ImportResult {
  ok: boolean;
  errorCode?: string;
  message: string;
  details?: ImportDetails;
}

interface ImportCardProps {
  title: string;
  description: string;
  dataType: 'opps' | 'mpfs' | 'dmepos' | 'dmepen' | 'gpci' | 'zip-crosswalk' | 'clfs';
  acceptedFileTypes?: string;
  sourceInfo?: {
    source: string;
    columns: string;
    purpose: string;
  };
  onImportComplete?: () => void;
}

export function ImportCard({
  title,
  description,
  dataType,
  acceptedFileTypes = '.xlsx,.xls,.csv',
  sourceInfo,
  onImportComplete
}: ImportCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [dryRun, setDryRun] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [statusRefreshTrigger, setStatusRefreshTrigger] = useState(0);
  
  const tableName = DATA_TYPE_TO_TABLE[dataType];
  const minExpectedRows = MIN_EXPECTED_ROWS[dataType] || 100;
  
  // Use standalone admin context (works without provider)
  const adminCtx = useAdminContextStandalone();

  // Update elapsed time while processing
  useEffect(() => {
    if (!startTime || status === 'idle' || status === 'success' || status === 'error') {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, status]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    setProgress(0);
    setElapsedTime(0);
    setStartTime(null);
    setResult({
      ok: false,
      errorCode: 'CANCELLED',
      message: 'Import cancelled by user'
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if we have admin access
    if (!adminCtx.isAdmin) {
      setResult({
        ok: false,
        errorCode: 'AUTH_REQUIRED',
        message: 'Please sign in or use ?bypass=admin123 for dev mode',
        details: { authMode: adminCtx.authMode }
      });
      setStatus('error');
      setDetailsOpen(true);
      return;
    }

    // Log auth method for debugging
    console.log('[ImportCard] Auth method:', adminCtx.authMode, {
      bypassToken: adminCtx.bypassToken ? `${adminCtx.bypassToken.substring(0, 4)}...` : null,
      bypassSource: adminCtx.bypassSource
    });

    // Clear previous state
    setResult(null);
    setDetailsOpen(false);
    setStatus('uploading');
    setProgress(10);
    setElapsedTime(0);
    setStartTime(Date.now());

    // Create abort controller for timeout
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, IMPORT_TIMEOUT_MS);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dataType', dataType);
      formData.append('dryRun', dryRun.toString());

      setProgress(30);
      setStatus('processing');

      // Get the Supabase URL from the client
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Build URL - always append bypass token as query param (primary mechanism)
      let importUrl = `${supabaseUrl}/functions/v1/admin-import`;
      if (adminCtx.authMode === 'bypass' && adminCtx.bypassToken) {
        importUrl += `?bypass=${encodeURIComponent(adminCtx.bypassToken)}`;
      }
      
      // Build headers - always include apikey for Supabase functions
      const headers: Record<string, string> = {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      
      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      
      // Include auth token if available
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      // Also include bypass as header for belt-and-suspenders
      if (adminCtx.authMode === 'bypass' && adminCtx.bypassToken) {
        headers['X-Dev-Bypass'] = adminCtx.bypassToken;
      }
      
      console.log('[ImportCard] Calling import:', { 
        importUrl: importUrl.replace(adminCtx.bypassToken || '', '***'),
        authMode: adminCtx.authMode,
        hasAuth: !!session?.access_token, 
        hasBypassParam: !!adminCtx.bypassToken,
        fileSize: file.size,
        fileName: file.name
      });
      
      // Call edge function with abort signal
      const response = await fetch(importUrl, {
        method: 'POST',
        body: formData,
        headers,
        signal: abortController.signal
      });

      clearTimeout(timeoutId);
      setProgress(80);

      // Safely read response
      let data: ImportResult;
      const responseText = await response.text();
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        // JSON parse failed - show raw response
        console.error('[ImportCard] Failed to parse response as JSON:', parseError);
        data = {
          ok: false,
          errorCode: 'INVALID_RESPONSE',
          message: `Server returned invalid JSON (HTTP ${response.status} ${response.statusText})`,
          details: {
            httpStatus: response.status,
            httpStatusText: response.statusText,
            rawResponse: responseText.substring(0, 5000) // First 5KB
          }
        };
      }

      // Handle non-OK HTTP responses
      if (!response.ok && data.ok !== false) {
        data = {
          ok: false,
          errorCode: `HTTP_${response.status}`,
          message: data.message || `Server error: HTTP ${response.status} ${response.statusText}`,
          details: {
            ...data.details,
            httpStatus: response.status,
            httpStatusText: response.statusText
          }
        };
      }

      // Add auth mode to result for debugging
      if (data.details) {
        data.details.authMode = adminCtx.authMode;
      } else {
        data.details = { authMode: adminCtx.authMode };
      }

      setResult(data);
      setProgress(100);

      if (data.ok) {
        setStatus('success');
        setStatusRefreshTrigger(prev => prev + 1); // Refresh dataset status
        if (!dryRun && onImportComplete) {
          onImportComplete();
        }
      } else {
        setStatus('error');
        setDetailsOpen(true); // Auto-expand details on error
      }

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[ImportCard] Import error:', error);
      
      // Check if this was an abort (timeout or cancel)
      if (error instanceof Error && error.name === 'AbortError') {
        // Check if it was user cancellation or timeout
        if (abortControllerRef.current?.signal.aborted) {
          setResult({
            ok: false,
            errorCode: 'TIMEOUT',
            message: `Import timed out after ${IMPORT_TIMEOUT_MS / 1000}s while processing file. The file may be too large for XLSX format.`,
            details: {
              rawResponse: 'Consider using CSV format for large OPPS files - it processes much faster.'
            }
          });
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setResult({
          ok: false,
          errorCode: 'NETWORK_ERROR',
          message: `Network error: ${errorMessage}`,
          details: {
            rawResponse: 'Check browser console (F12) for more details. Common causes: CORS issues, network timeout, or server error.'
          }
        });
      }
      setStatus('error');
      setDetailsOpen(true);
    } finally {
      abortControllerRef.current = null;
      setStartTime(null);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderStatusIcon = () => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Database className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const formatElapsedTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const isProcessing = status === 'uploading' || status === 'processing';
  const isOpps = dataType === 'opps';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {renderStatusIcon()}
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Database Status Display */}
        {tableName && (
          <DatasetStatusDisplay 
            tableName={tableName}
            minExpectedRows={minExpectedRows}
            refreshTrigger={statusRefreshTrigger}
          />
        )}

        {/* Source Info */}
        {sourceInfo && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p><strong>Source:</strong> {sourceInfo.source}</p>
            <p><strong>Columns:</strong> {sourceInfo.columns}</p>
            <p><strong>Purpose:</strong> {sourceInfo.purpose}</p>
          </div>
        )}

        {/* CSV recommendation for large files */}
        {isOpps && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200">
            <strong>Tip:</strong> CSV format is strongly recommended for large OPPS files (&gt;10k rows). 
            XLSX parsing can timeout on very large files.
          </div>
        )}

        {/* Auth status indicator */}
        {!adminCtx.loading && (
          <div className={`rounded-md p-2 text-xs flex items-center gap-2 ${
            adminCtx.isAdmin 
              ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300' 
              : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
          }`}>
            {adminCtx.isAdmin ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            <span>
              {adminCtx.authMode === 'bypass' && `Auth: bypass (${adminCtx.bypassSource})`}
              {adminCtx.authMode === 'session' && 'Auth: session'}
              {adminCtx.authMode === 'none' && 'No auth - add ?bypass=admin123 to URL'}
            </span>
          </div>
        )}

        {/* Progress with elapsed time */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Elapsed: {formatElapsedTime(elapsedTime)}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Result Message */}
        {result && (
          <div className={`rounded-md p-3 text-sm ${
            result.ok 
              ? 'bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}>
            <div className="flex items-start gap-2">
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-medium">{result.message}</p>
                {result.errorCode && (
                  <p className="text-xs opacity-75 mt-1">Error code: {result.errorCode}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Expandable Details */}
        {result?.details && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  View Details
                </span>
                {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-md border bg-muted/50 p-3 text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {result.details.authMode && (
                    <>
                      <span className="text-muted-foreground">Auth Mode:</span>
                      <span className="font-mono">{result.details.authMode}</span>
                    </>
                  )}
                  {result.details.httpStatus !== undefined && (
                    <>
                      <span className="text-muted-foreground">HTTP Status:</span>
                      <span className="font-mono">{result.details.httpStatus} {result.details.httpStatusText}</span>
                    </>
                  )}
                  {result.details.sheetName && (
                    <>
                      <span className="text-muted-foreground">Sheet:</span>
                      <span className="font-mono">{result.details.sheetName}</span>
                    </>
                  )}
                  {result.details.headerRowIndex !== undefined && (
                    <>
                      <span className="text-muted-foreground">Header row:</span>
                      <span className="font-mono">{result.details.headerRowIndex + 1}</span>
                    </>
                  )}
                  {result.details.totalRowsRead !== undefined && (
                    <>
                      <span className="text-muted-foreground">Rows read:</span>
                      <span className="font-mono">{result.details.totalRowsRead.toLocaleString()}</span>
                    </>
                  )}
                  {result.details.rowsProcessed !== undefined && (
                    <>
                      <span className="text-muted-foreground">Rows processed:</span>
                      <span className="font-mono">{result.details.rowsProcessed.toLocaleString()}</span>
                    </>
                  )}
                  {result.details.validRows !== undefined && (
                    <>
                      <span className="text-muted-foreground">Valid rows:</span>
                      <span className="font-mono text-green-600">{result.details.validRows.toLocaleString()}</span>
                    </>
                  )}
                  {result.details.imported !== undefined && (
                    <>
                      <span className="text-muted-foreground">Imported:</span>
                      <span className="font-mono text-green-600">{result.details.imported.toLocaleString()}</span>
                    </>
                  )}
                  {result.details.batchesCompleted !== undefined && (
                    <>
                      <span className="text-muted-foreground">Batches:</span>
                      <span className="font-mono">{result.details.batchesCompleted}</span>
                    </>
                  )}
                  {result.details.skipped !== undefined && result.details.skipped > 0 && (
                    <>
                      <span className="text-muted-foreground">Skipped:</span>
                      <span className="font-mono text-amber-600">{result.details.skipped.toLocaleString()}</span>
                    </>
                  )}
                </div>
                
                {result.details.columnsDetected && result.details.columnsDetected.length > 0 && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground">Columns detected: </span>
                    <span className="font-mono">{result.details.columnsDetected.join(', ')}</span>
                  </div>
                )}
                
                {result.details.skippedReasons && Object.keys(result.details.skippedReasons).length > 0 && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground block mb-1">Skip reasons:</span>
                    <ul className="list-disc list-inside text-amber-600">
                      {Object.entries(result.details.skippedReasons).map(([reason, count]) => (
                        <li key={reason} className="truncate">
                          {reason}: {count as number}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {result.details.rawResponse && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground block mb-1">Raw Response:</span>
                    <pre className="whitespace-pre-wrap break-all bg-muted p-2 rounded text-[10px] max-h-40 overflow-auto">
                      {result.details.rawResponse}
                    </pre>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id={`dry-run-${dataType}`}
              checked={dryRun}
              onCheckedChange={setDryRun}
              disabled={isProcessing}
            />
            <Label htmlFor={`dry-run-${dataType}`} className="text-sm">
              Dry run (validate only)
            </Label>
          </div>

          <div className="flex-1 flex gap-2 justify-end">
            {/* Verify Data Button */}
            {tableName && !isProcessing && (
              <VerifyDataModal tableName={tableName} displayName={title} />
            )}
            
            {isProcessing ? (
              <Button variant="destructive" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
            ) : (
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={!adminCtx.isAdmin}
                size="sm"
              >
                <Upload className="h-4 w-4 mr-2" />
                Select File
              </Button>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFileTypes}
          className="hidden"
          onChange={handleFileSelect}
        />
      </CardContent>
    </Card>
  );
}
