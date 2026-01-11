import { useState } from 'react';
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
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function AdminDataImport() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [recomputingGpci, setRecomputingGpci] = useState(false);

  const handleImportComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleRecomputeGpciStateAvg = async () => {
    setRecomputingGpci(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recompute-gpci-state-avg`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
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
      </div>
    </div>
  );
}
