/**
 * AdminGateDebug - Debug panel for admin authorization
 * 
 * Shows detailed gate state when ?debug=1 is in URL
 * Also shows import readiness status to help debug import failures
 */

import { useSearchParams } from 'react-router-dom';
import { AdminContext } from '@/hooks/useAdminContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock, Bug, Upload, RefreshCw } from 'lucide-react';

interface AdminGateDebugProps {
  adminContext: AdminContext;
}

export function AdminGateDebug({ adminContext }: AdminGateDebugProps) {
  const [searchParams] = useSearchParams();
  const showDebug = searchParams.get('debug') === '1' || import.meta.env.DEV;

  if (!showDebug) return null;

  const authModeIcon = {
    bypass: <CheckCircle className="h-4 w-4 text-yellow-500" />,
    session: <CheckCircle className="h-4 w-4 text-success" />,
    none: <XCircle className="h-4 w-4 text-destructive" />,
  };

  const authModeBadge = {
    bypass: 'bg-yellow-500/10 text-yellow-600',
    session: 'bg-success/10 text-success',
    none: 'bg-destructive/10 text-destructive',
  };

  return (
    <Card className="border-dashed border-warning/50 bg-warning/5">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bug className="h-4 w-4" />
          Admin Context Debug
          <Badge className={authModeBadge[adminContext.authMode]}>
            {authModeIcon[adminContext.authMode]}
            <span className="ml-1">{adminContext.authMode.toUpperCase()}</span>
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 space-y-2 text-xs font-mono">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-muted-foreground">Auth Mode:</span>
          <span className={adminContext.isAdmin ? 'text-success font-bold' : 'text-destructive'}>
            {adminContext.authMode}
          </span>
          
          <span className="text-muted-foreground">Is Admin:</span>
          <span className={adminContext.isAdmin ? 'text-success' : 'text-destructive'}>
            {adminContext.isAdmin ? '✓ YES' : '✗ NO'}
          </span>
          
          <span className="text-muted-foreground">Bypass Token:</span>
          <span>{adminContext.bypassToken ? `${adminContext.bypassToken.substring(0, 8)}...` : 'null'}</span>
          
          <span className="text-muted-foreground">Bypass Source:</span>
          <span className={adminContext.bypassSource ? 'text-success' : 'text-muted-foreground'}>
            {adminContext.bypassSource || 'none'}
          </span>
          
          <span className="text-muted-foreground">Session User:</span>
          <span className="truncate">{adminContext.sessionUserId || 'null'}</span>
          
          <span className="text-muted-foreground">Session Email:</span>
          <span>{adminContext.sessionEmail || 'null'}</span>
        </div>

        {/* Import Readiness Section */}
        <div className="border-t border-border/50 pt-2 mt-2">
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <Upload className="h-3 w-3" />
            Import Readiness:
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Can Import:</span>
            <span className={adminContext.isAdmin ? 'text-success font-bold' : 'text-destructive font-bold'}>
              {adminContext.isAdmin ? '✓ YES' : '✗ NO'}
            </span>
            
            <span className="text-muted-foreground">Reason:</span>
            <span>
              {adminContext.authMode === 'bypass' ? 'Bypass token valid' :
               adminContext.authMode === 'session' ? 'Authenticated session' :
               'No auth - add ?bypass=admin123'}
            </span>
          </div>
        </div>

        {/* Refresh Status */}
        <div className="border-t border-border/50 pt-2 mt-2">
          <p className="text-muted-foreground mb-1 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Refresh Status:
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Refresh Count:</span>
            <span>{adminContext.refreshCount}</span>
            
            <span className="text-muted-foreground">Last Refresh:</span>
            <span>{adminContext.lastRefresh?.toLocaleTimeString() || 'never'}</span>
            
            <span className="text-muted-foreground">Refreshing:</span>
            <span>{adminContext.refreshing ? '⏳ yes' : 'no'}</span>
          </div>
        </div>

        {/* Debug Info */}
        <div className="border-t border-border/50 pt-2 mt-2">
          <p className="text-muted-foreground mb-1">Debug Info:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Origin:</span>
            <span className="truncate">{adminContext.debugInfo.origin}</span>
            
            <span className="text-muted-foreground">Has Session:</span>
            <span>{adminContext.debugInfo.hasSession ? '✓' : '✗'}</span>
            
            <span className="text-muted-foreground">Bypass Attempted:</span>
            <span>{adminContext.debugInfo.bypassAttempted ? '✓' : '✗'}</span>
            
            <span className="text-muted-foreground">Checked at:</span>
            <span>{new Date(adminContext.debugInfo.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
