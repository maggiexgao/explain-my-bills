/**
 * ImportHistorySection Component
 * Shows recent import history from import_logs table
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  RefreshCw,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ImportLog {
  id: string;
  dataset_name: string;
  file_name: string | null;
  rows_imported: number;
  rows_skipped: number;
  rows_before_dedup: number | null;
  status: string;
  error_message: string | null;
  imported_at: string;
  imported_by: string | null;
}

interface ImportHistorySectionProps {
  refreshTrigger?: number;
  limit?: number;
}

// Dataset display names
const DATASET_NAMES: Record<string, string> = {
  mpfs: 'MPFS',
  opps: 'OPPS',
  clfs: 'CLFS',
  dmepos: 'DMEPOS',
  dmepen: 'DMEPEN',
  gpci: 'GPCI',
  'zip-crosswalk': 'ZIP'
};

export function ImportHistorySection({ 
  refreshTrigger = 0,
  limit = 10 
}: ImportHistorySectionProps) {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('import_logs')
        .select('*')
        .order('imported_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching import logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load import history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [refreshTrigger, limit]);

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">Success</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Partial</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Pending</Badge>;
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-primary" />
            Recent Imports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {error.includes('does not exist') 
              ? 'Import history will appear here after imports are logged.'
              : `Error: ${error}`
            }
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              Recent Imports
            </CardTitle>
            <CardDescription>
              Last {limit} import operations
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No imports recorded yet. Import history will appear here.
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div 
                key={log.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                {getStatusIcon(log.status)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      {DATASET_NAMES[log.dataset_name] || log.dataset_name}
                    </Badge>
                    {log.file_name && (
                      <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {log.file_name}
                      </span>
                    )}
                  </div>
                  {log.error_message && (
                    <p className="text-xs text-destructive mt-0.5 truncate">
                      {log.error_message}
                    </p>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono">
                    {log.rows_imported.toLocaleString()} rows
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(log.imported_at)}
                  </div>
                </div>

                {getStatusBadge(log.status)}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
