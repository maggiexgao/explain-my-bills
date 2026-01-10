/**
 * ImportCard Component
 * 
 * Reusable card for data import operations with:
 * - File upload
 * - Dry run toggle
 * - Progress display
 * - Structured error display with expandable details
 */

import { useState, useRef } from 'react';
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
  Eye
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';

type ImportStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

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
  dataType: 'opps' | 'dmepos' | 'dmepen' | 'gpci' | 'zip-crosswalk';
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
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [dryRun, setDryRun] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear previous state
    setResult(null);
    setDetailsOpen(false);
    setStatus('uploading');
    setProgress(10);

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
      
      // Call edge function
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-import`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        }
      });

      setProgress(80);

      const data: ImportResult = await response.json();
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
      console.error('Import error:', error);
      setResult({
        ok: false,
        errorCode: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to connect to server'
      });
      setStatus('error');
      setDetailsOpen(true);
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

  const isProcessing = status === 'uploading' || status === 'processing';

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

        {/* Progress */}
        {isProcessing && (
          <Progress value={progress} className="h-2" />
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

        {/* Upload Button (alternative) */}
        {isProcessing && (
          <Button disabled className="w-full">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {status === 'uploading' ? 'Uploading...' : 'Processing...'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
