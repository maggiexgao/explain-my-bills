/**
 * ImportCard Component
 * 
 * Reusable card for data import operations with:
 * - File upload with timeout and cancellation
 * - Dry run toggle
 * - Progress display with elapsed time
 * - Structured error display with expandable details
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
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
  XCircle,
  Clock
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';

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
  dataType: 'opps' | 'dmepos' | 'dmepen' | 'gpci' | 'zip-crosswalk' | 'clfs';
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

  // Determine bypass token from various sources
  const getBypassToken = (): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    // Priority: explicit bypass param > admin=bypass shorthand > localStorage
    if (urlParams.get('bypass')) return urlParams.get('bypass');
    if (urlParams.get('admin') === 'bypass') return 'admin123';
    return localStorage.getItem('admin_bypass_token');
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Get bypass token and session
    const bypassToken = getBypassToken();
    const { data: { session } } = await supabase.auth.getSession();
    
    // Determine auth method
    const authMethod = session?.access_token ? 'session' : (bypassToken ? 'bypass' : 'none');
    
    // Log for debugging
    console.log('[ImportCard] Auth method:', authMethod, { 
      hasSession: !!session?.access_token,
      bypassToken: bypassToken ? `${bypassToken.substring(0, 4)}...` : null,
      bypassSource: bypassToken ? (
        new URLSearchParams(window.location.search).get('bypass') ? 'url_param' :
        new URLSearchParams(window.location.search).get('admin') === 'bypass' ? 'admin_shorthand' :
        'localStorage'
      ) : null
    });

    // Require at least one auth method
    if (authMethod === 'none') {
      setResult({
        ok: false,
        errorCode: 'AUTH_REQUIRED',
        message: 'Please sign in or use ?bypass=admin123 for dev mode'
      });
      setStatus('error');
      setDetailsOpen(true);
      return;
    }

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
      if (bypassToken) {
        importUrl += `?bypass=${encodeURIComponent(bypassToken)}`;
      }
      
      // Build headers - always include apikey for Supabase functions
      const headers: Record<string, string> = {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      
      // Include auth token if available (NOT mutually exclusive with bypass)
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      // Also include bypass as header for belt-and-suspenders
      // Note: This may trigger CORS preflight but provides redundancy
      if (bypassToken && !session?.access_token) {
        headers['X-Dev-Bypass'] = bypassToken;
      }
      
      console.log('[ImportCard] Calling import:', { 
        importUrl: importUrl.replace(bypassToken || '', '***'),
        authMethod,
        hasAuth: !!session?.access_token, 
        hasBypassParam: !!bypassToken,
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

      setResult(data);
      setProgress(100);

      if (data.ok) {
        setStatus('success');
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
                
                {result.details.rawResponse && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground mb-1">Response:</p>
                    <pre className="text-[10px] overflow-x-auto max-h-40 overflow-y-auto bg-background rounded p-2 whitespace-pre-wrap">
                      {result.details.rawResponse}
                    </pre>
                  </div>
                )}
                
                {result.details.sampleRows && result.details.sampleRows.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground mb-1">Sample rows (first {Math.min(result.details.sampleRows.length, 5)}):</p>
                    <pre className="text-[10px] overflow-x-auto max-h-40 overflow-y-auto bg-background rounded p-2">
                      {JSON.stringify(result.details.sampleRows.slice(0, 5), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Dry Run Toggle */}
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="space-y-0.5">
            <Label htmlFor={`dry-run-${dataType}`} className="font-medium">Validate only (dry run)</Label>
            <p className="text-xs text-muted-foreground">
              Parse and validate without writing to database
            </p>
          </div>
          <Switch
            id={`dry-run-${dataType}`}
            checked={dryRun}
            onCheckedChange={setDryRun}
            disabled={isProcessing}
          />
        </div>

        {/* File Upload */}
        <div className="flex flex-col gap-2">
          <Label htmlFor={`file-${dataType}`} className="sr-only">Select file</Label>
          <div className="relative">
            <Input
              id={`file-${dataType}`}
              ref={fileInputRef}
              type="file"
              accept={acceptedFileTypes}
              onChange={handleFileSelect}
              disabled={isProcessing}
              className="cursor-pointer"
            />
          </div>
        </div>

        {/* Processing state with Cancel button */}
        {isProcessing && (
          <div className="flex gap-2">
            <Button disabled className="flex-1">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {status === 'uploading' ? 'Uploading...' : 'Processing...'}
            </Button>
            <Button variant="destructive" size="icon" onClick={handleCancel} title="Cancel import">
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
