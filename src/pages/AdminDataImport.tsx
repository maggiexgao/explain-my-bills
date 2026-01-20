import { useState, useCallback } from 'react';
import { ImportCard } from '@/components/admin/ImportCard';
import { SelfTestCard } from '@/components/admin/SelfTestCard';
import { CoverageMetricsCard } from '@/components/admin/CoverageMetricsCard';
import { DatasetStatusBar } from '@/components/admin/DatasetStatusBar';
import { CoverageGapsPanel } from '@/components/admin/CoverageGapsPanel';
import { DataGapsDiagnosticsCard } from '@/components/admin/DataGapsDiagnosticsCard';
import { StrategyAuditCard } from '@/components/admin/StrategyAuditCard';
import { DatasetValidationCard } from '@/components/admin/DatasetValidationCard';
import { AdminGateDebug } from '@/components/admin/AdminGateDebug';
import { VerifyDmeposCard } from '@/components/admin/VerifyDmeposCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, RefreshCw, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AdminContextProvider, useAdminContext } from '@/hooks/useAdminContext';
import { supabase } from '@/integrations/supabase/client';

function AdminDataImportContent() {
  const adminContext = useAdminContext();
  const [recomputingGpci, setRecomputingGpci] = useState(false);

  const handleImportComplete = useCallback(() => {
    // Trigger global refresh after import
    adminContext.triggerRefresh();
    toast.success('Import complete - refreshing stats...');
  }, [adminContext]);

  const handleRecomputeGpciStateAvg = async () => {
    setRecomputingGpci(true);
    try {
      // Build URL with bypass if needed
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recompute-gpci-state-avg`;
      const url = adminContext.getImportUrl(baseUrl);
      
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...adminContext.getAuthHeaders(),
      };
      
      // Add auth header if session exists
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers
      });
      
      const result = await response.json();
      
      if (result.ok) {
        toast.success(`Computed GPCI state averages for ${result.rowsComputed} states`);
        adminContext.triggerRefresh();
      } else {
        toast.error(result.message || 'Failed to recompute GPCI state averages');
      }
    } catch (error) {
      console.error('Recompute GPCI error:', error);
      toast.error('Failed to recompute GPCI state averages');
    } finally {
      setRecomputingGpci(false);
    }
  };

  const handleGlobalRefresh = () => {
    adminContext.triggerRefresh();
    toast.success('Refreshing all stats...');
  };

  // Show loading while determining auth mode
  if (adminContext.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Checking authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* Sticky Dataset Status Bar */}
      <DatasetStatusBar refreshTrigger={adminContext.refreshCount} />
      
      {/* Main Content - Scrollable container */}
      <div className="mx-auto max-w-3xl space-y-6 p-4 pb-32">
        {/* Auth Mode Banner */}
        <div className={`rounded-lg p-3 flex items-center justify-between ${
          adminContext.authMode === 'bypass' 
            ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700' 
            : adminContext.authMode === 'session'
              ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
              : 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
        }`}>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={
              adminContext.authMode === 'bypass' ? 'bg-yellow-200 text-yellow-800' :
              adminContext.authMode === 'session' ? 'bg-green-200 text-green-800' :
              'bg-red-200 text-red-800'
            }>
              {adminContext.authMode === 'bypass' ? '🔓 Bypass' :
               adminContext.authMode === 'session' ? '✅ Session' :
               '❌ No Auth'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {adminContext.authMode === 'bypass' && `via ${adminContext.bypassSource}`}
              {adminContext.authMode === 'session' && adminContext.sessionEmail}
              {adminContext.authMode === 'none' && 'Add ?bypass=admin123 or sign in'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {adminContext.lastRefresh && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {adminContext.lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleGlobalRefresh}
              disabled={adminContext.refreshing}
            >
              {adminContext.refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-1 text-xs">Refresh All</span>
            </Button>
          </div>
        </div>
        
        {/* Admin Gate Debug - shows in dev or with ?debug=1 */}
        <AdminGateDebug adminContext={adminContext} />
        
        <div className="text-center pt-4">
          <h1 className="text-3xl font-bold">Medicare Data Import</h1>
          <p className="mt-2 text-muted-foreground">
            Import MPFS, GPCI, OPPS, DMEPOS data via server-side processing
          </p>
        </div>

        {/* Strategy Audit - Comprehensive Report */}
        <StrategyAuditCard key={`audit-${adminContext.refreshCount}`} />

        {/* Dataset Validation */}
        <DatasetValidationCard key={`validation-${adminContext.refreshCount}`} />

        {/* Data Gap Diagnostics - Live telemetry */}
        <DataGapsDiagnosticsCard />

        {/* GPCI State Averages Recompute */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Recompute Derived Tables
            </CardTitle>
            <CardDescription>
              Regenerate computed tables from source data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/30">
              <div>
                <p className="font-medium">GPCI State Averages</p>
                <p className="text-sm text-muted-foreground">
                  Computes state-level GPCI averages from gpci_localities for fallback pricing
                </p>
              </div>
              <Button 
                onClick={handleRecomputeGpciStateAvg} 
                disabled={recomputingGpci || !adminContext.isAdmin}
                variant="outline"
              >
                {recomputingGpci ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Computing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Recompute
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Self-Test */}
        <SelfTestCard />

        {/* Coverage & Gaps Panel */}
        <CoverageGapsPanel />

        {/* Coverage Metrics */}
        <CoverageMetricsCard refreshTrigger={adminContext.refreshCount} />

        {/* GPCI Import */}
        <ImportCard
          title="GPCI Localities"
          description="Geographic Practice Cost Index (2026 by Locality)"
          dataType="gpci"
          sourceInfo={{
            source: "CMS GPCI File (gpci_2026_by_locality.xlsx)",
            columns: "Locality, State, Work GPCI, PE GPCI, MP GPCI",
            purpose: "Geographic fee adjustments for MPFS calculations"
          }}
          onImportComplete={handleImportComplete}
        />

        {/* OPPS Import */}
        <ImportCard
          title="OPPS Addendum B (2025)"
          description="Hospital Outpatient Prospective Payment System — facility payment rates"
          dataType="opps"
          sourceInfo={{
            source: "CMS OPPS Addendum B (January 2025)",
            columns: "HCPCS, APC, Status Indicator, Payment Rate",
            purpose: "Hospital outpatient facility fee reference"
          }}
          onImportComplete={handleImportComplete}
        />

        {/* CLFS Import */}
        <ImportCard
          title="CLFS (Clinical Lab Fee Schedule)"
          description="Clinical Laboratory Fee Schedule — national payment limits for lab tests"
          dataType="clfs"
          sourceInfo={{
            source: "CMS CLFS 2026 Q1 (CLFS_2026_Q1V1.xlsx)",
            columns: "HCPCS, Short Description, Payment Amount",
            purpose: "Medicare reference pricing for lab codes (80000-89999)"
          }}
          onImportComplete={handleImportComplete}
        />

        {/* DMEPOS Import */}
        <ImportCard
          title="DMEPOS Fee Schedule (2026)"
          description="Durable Medical Equipment, Prosthetics, Orthotics & Supplies"
          dataType="dmepos"
          sourceInfo={{
            source: "CMS DMEPOS Fee Schedule (January 2026)",
            columns: "HCPCS, Modifier, State fees (NR/R)",
            purpose: "Reference pricing for medical equipment (A/E/K/L codes)"
          }}
          onImportComplete={handleImportComplete}
        />

        {/* Verify DMEPOS */}
        <VerifyDmeposCard />

        {/* DMEPEN Import */}
        <ImportCard
          title="DMEPEN Fee Schedule (2026)"
          description="Enteral and Parenteral Nutrition supplies"
          dataType="dmepen"
          sourceInfo={{
            source: "CMS DMEPEN Fee Schedule (January 2026)",
            columns: "HCPCS, Modifier, State fees",
            purpose: "Reference pricing for enteral/parenteral nutrition (B codes)"
          }}
          onImportComplete={handleImportComplete}
        />

        {/* ZIP Crosswalk Import */}
        <ImportCard
          title="ZIP → Locality Crosswalk"
          description="CMS ZIP code to Medicare carrier/locality mapping (2026)"
          dataType="zip-crosswalk"
          sourceInfo={{
            source: "CMS ZIP Code to Carrier Locality File (ZIP5_JAN2026.xlsx)",
            columns: "STATE, ZIP CODE, CARRIER, LOCALITY",
            purpose: "Maps ZIP codes to Medicare payment localities"
          }}
          onImportComplete={handleImportComplete}
        />

        {/* Back Link */}
        <div className="text-center pb-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        {/* Dev debug indicator - confirms scrolling works */}
        {import.meta.env.DEV && (
          <div className="text-center py-4 text-xs text-muted-foreground border-t border-dashed border-border">
            ✅ Bottom reached — scrolling works correctly
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDataImport() {
  return (
    <AdminContextProvider>
      <AdminDataImportContent />
    </AdminContextProvider>
  );
}
