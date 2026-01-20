/**
 * AdminGateDebug - Debug panel for admin authorization
 * 
 * Shows detailed gate state when ?debug=1 is in URL
 * Also shows import readiness status to help debug import failures
 */

import { useSearchParams } from 'react-router-dom';
import { AdminGateResult } from '@/hooks/useAdminGate';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock, Bug, Upload } from 'lucide-react';
import { useMemo } from 'react';

interface AdminGateDebugProps {
  gate: AdminGateResult;
}

export function AdminGateDebug({ gate }: AdminGateDebugProps) {
  const [searchParams] = useSearchParams();
  const showDebug = searchParams.get('debug') === '1' || import.meta.env.DEV;

  // Compute import readiness info
  const importInfo = useMemo(() => {
    const bypassToken = searchParams.get('bypass') || (searchParams.get('admin') === 'bypass' ? 'admin123' : null);
    const isDevBypass = bypassToken === 'admin123';
    const hasSession = gate.debugInfo.sessionExists;
    const canImport = hasSession || isDevBypass;
    
    return {
      bypassTokenPresent: !!bypassToken,
      bypassToken: bypassToken,
      isDevBypass,
      hasSession,
      canImport,
      reason: canImport 
        ? (isDevBypass ? 'Bypass token valid' : 'Authenticated session') 
        : 'No session and no valid bypass token'
    };
  }, [searchParams, gate.debugInfo.sessionExists]);

  if (!showDebug) return null;

  const stateIcon = {
    loading: <Clock className="h-4 w-4 text-warning" />,
    allowed: <CheckCircle className="h-4 w-4 text-success" />,
    denied: <XCircle className="h-4 w-4 text-destructive" />,
  };

  const stateBadge = {
    loading: 'bg-warning/10 text-warning',
    allowed: 'bg-success/10 text-success',
    denied: 'bg-destructive/10 text-destructive',
  };

  return (
    <Card className="border-dashed border-warning/50 bg-warning/5">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bug className="h-4 w-4" />
          Admin Gate Debug
          <Badge className={stateBadge[gate.state]}>
            {stateIcon[gate.state]}
            <span className="ml-1">{gate.state.toUpperCase()}</span>
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 space-y-2 text-xs font-mono">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-muted-foreground">User ID:</span>
          <span className="truncate">{gate.userId || 'null'}</span>
          
          <span className="text-muted-foreground">Email:</span>
          <span>{gate.email || 'null'}</span>
          
          <span className="text-muted-foreground">Source:</span>
          <span className={gate.source !== 'none' ? 'text-success' : 'text-muted-foreground'}>
            {gate.source}
          </span>
          
          <span className="text-muted-foreground">Reason:</span>
          <span>{gate.reason}</span>
        </div>

        {/* Import Readiness Section */}
        <div className="border-t border-border/50 pt-2 mt-2">
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <Upload className="h-3 w-3" />
            Import Readiness:
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Bypass token in URL:</span>
            <span className={importInfo.bypassTokenPresent ? 'text-success' : 'text-muted-foreground'}>
              {importInfo.bypassTokenPresent ? `✓ (${importInfo.bypassToken})` : '✗'}
            </span>
            
            <span className="text-muted-foreground">Dev bypass active:</span>
            <span className={importInfo.isDevBypass ? 'text-success' : 'text-muted-foreground'}>
              {importInfo.isDevBypass ? '✓' : '✗'}
            </span>
            
            <span className="text-muted-foreground">Session exists:</span>
            <span className={importInfo.hasSession ? 'text-success' : 'text-muted-foreground'}>
              {importInfo.hasSession ? '✓' : '✗'}
            </span>
            
            <span className="text-muted-foreground">Can import:</span>
            <span className={importInfo.canImport ? 'text-success font-bold' : 'text-destructive font-bold'}>
              {importInfo.canImport ? '✓ YES' : '✗ NO'}
            </span>
            
            <span className="text-muted-foreground">Import auth reason:</span>
            <span>{importInfo.reason}</span>
          </div>
        </div>

        <div className="border-t border-border/50 pt-2 mt-2">
          <p className="text-muted-foreground mb-1">Debug Info:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Session exists:</span>
            <span>{gate.debugInfo.sessionExists ? '✓' : '✗'}</span>
            
            <span className="text-muted-foreground">JWT claim:</span>
            <span className="truncate">{gate.debugInfo.jwtClaimChecked || 'not checked'}</span>
            
            <span className="text-muted-foreground">Role query:</span>
            <span className="truncate">{gate.debugInfo.roleQueryResult || 'not checked'}</span>
            
            <span className="text-muted-foreground">Email allowlist:</span>
            <span>{gate.debugInfo.emailAllowlistChecked ? 'checked' : 'not checked'}</span>
            
            <span className="text-muted-foreground">Checked at:</span>
            <span>{new Date(gate.debugInfo.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>

        {gate.debugInfo.appMetadata && Object.keys(gate.debugInfo.appMetadata).length > 0 && (
          <div className="border-t border-border/50 pt-2 mt-2">
            <p className="text-muted-foreground mb-1">app_metadata:</p>
            <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-24">
              {JSON.stringify(gate.debugInfo.appMetadata, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
