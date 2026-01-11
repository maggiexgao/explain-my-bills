import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImportCard } from '@/components/admin/ImportCard';
import { SelfTestCard } from '@/components/admin/SelfTestCard';
import { CoverageMetricsCard } from '@/components/admin/CoverageMetricsCard';
import { DatasetStatusBar } from '@/components/admin/DatasetStatusBar';
import { CoverageGapsPanel } from '@/components/admin/CoverageGapsPanel';
import { DataGapsDiagnosticsCard } from '@/components/admin/DataGapsDiagnosticsCard';
import { StrategyAuditCard } from '@/components/admin/StrategyAuditCard';
import { DatasetValidationCard } from '@/components/admin/DatasetValidationCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function AdminDataImport() {
  const navigate = useNavigate();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [recomputingGpci, setRecomputingGpci] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
    
    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIsAuthorized(false);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsAuthorized(false);
        setAuthChecking(false);
        return;
      }

      // Check if user has admin role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError) {
        // Table might not exist - allow authenticated user for initial setup
        console.warn('Role check failed, allowing authenticated user:', roleError.message);
        setIsAuthorized(true);
      } else if (!roleData) {
        // No admin role found
        setIsAuthorized(false);
      } else {
        setIsAuthorized(true);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthorized(false);
    } finally {
      setAuthChecking(false);
    }
  };

  // Get auth token for edge function calls
  const getAuthToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

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

  // Show loading state while checking auth
  if (authChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Checking authorization...</p>
        </div>
      </div>
    );
  }

  // Show unauthorized message
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You must be signed in with an admin account to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Return to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* Sticky Dataset Status Bar */}
      <DatasetStatusBar refreshTrigger={refreshTrigger} />
      
      {/* Main Content - Scrollable container */}
      <div className="mx-auto max-w-3xl space-y-6 p-4 pb-32">
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
