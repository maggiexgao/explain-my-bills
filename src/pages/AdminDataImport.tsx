import { useState } from 'react';
import { ImportCard } from '@/components/admin/ImportCard';
import { SelfTestCard } from '@/components/admin/SelfTestCard';
import { CoverageMetricsCard } from '@/components/admin/CoverageMetricsCard';
import { DatasetStatusBar } from '@/components/admin/DatasetStatusBar';
import { CoverageGapsPanel } from '@/components/admin/CoverageGapsPanel';
import { DataGapsDiagnosticsCard } from '@/components/admin/DataGapsDiagnosticsCard';
import { StrategyAuditCard } from '@/components/admin/StrategyAuditCard';
import { DatasetValidationCard } from '@/components/admin/DatasetValidationCard';
import { AdminGateDebug } from '@/components/admin/AdminGateDebug';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAdminGate } from '@/hooks/useAdminGate';
import { getAuthToken } from '@/lib/isAdmin';

export default function AdminDataImport() {
  const adminGate = useAdminGate();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [recomputingGpci, setRecomputingGpci] = useState(false);

  const handleImportComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleRecomputeGpciStateAvg = async () => {
    const token = await getAuthToken();
    if (!token) {
      toast.error('Please sign in to perform this action');
      return;
    }

    setRecomputingGpci(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recompute-gpci-state-avg`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const result = await response.json();
      
      if (result.ok) {
        toast.success(`Computed GPCI state averages for ${result.rowsComputed} states`);
        setRefreshTrigger(prev => prev + 1);
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

  // TEMP: Auth disabled for development - skip auth check entirely
  // To re-enable: uncomment the loading and access denied checks below

  // if (adminGate.loading) {
  //   return (
  //     <div className="min-h-screen bg-background flex items-center justify-center">
  //       <div className="text-center space-y-4">
  //         <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
  //         <p className="text-muted-foreground">Checking authorization...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // if (!adminGate.isAdmin) {
  //   return (
  //     <div className="min-h-screen bg-background flex items-center justify-center p-4">
  //       <div className="w-full max-w-md space-y-4">
  //         <Card>
  //           <CardHeader className="text-center">
  //             <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
  //               <ShieldAlert className="h-6 w-6 text-destructive" />
  //             </div>
  //             <CardTitle>Access Denied</CardTitle>
  //             <CardDescription>
  //               {adminGate.reason || 'You must be signed in with an admin account to access this page.'}
  //             </CardDescription>
  //           </CardHeader>
  //           <CardContent className="space-y-4">
  //             {adminGate.suggestion && (
  //               <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">
  //                 💡 {adminGate.suggestion}
  //               </div>
  //             )}
  //             <div className="text-center">
  //               <Link to="/">
  //                 <Button variant="outline" className="gap-2">
  //                   <ArrowLeft className="h-4 w-4" />
  //                   Return to Home
  //                 </Button>
  //               </Link>
  //             </div>
  //           </CardContent>
  //         </Card>
  //         <AdminGateDebug gate={adminGate} />
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* Sticky Dataset Status Bar */}
      <DatasetStatusBar refreshTrigger={refreshTrigger} />
      
      {/* Main Content - Scrollable container */}
      <div className="mx-auto max-w-3xl space-y-6 p-4 pb-32">
          {/* TEMP: Development mode warning banner */}
          <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <span className="font-semibold">Dev Mode:</span> Authentication temporarily disabled. Re-enable in AdminDataImport.tsx before production.
            </p>
          </div>
          
          {/* Admin Gate Debug - shows in dev or with ?debug=1 */}
          <AdminGateDebug gate={adminGate} />
          
          <div className="text-center pt-4">
            <h1 className="text-3xl font-bold">Medicare Data Import</h1>
            <p className="mt-2 text-muted-foreground">
              Import MPFS, GPCI, OPPS, DMEPOS data via server-side processing
            </p>
          </div>

          {/* Strategy Audit - Comprehensive Report */}
          <StrategyAuditCard />

          {/* Dataset Validation */}
          <DatasetValidationCard />

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
                  disabled={recomputingGpci}
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
          <CoverageMetricsCard refreshTrigger={refreshTrigger} />

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
