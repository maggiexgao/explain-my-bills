import { useState } from 'react';
import { ImportCard } from '@/components/admin/ImportCard';
import { SelfTestCard } from '@/components/admin/SelfTestCard';
import { CoverageMetricsCard } from '@/components/admin/CoverageMetricsCard';
import { DatasetStatusBar } from '@/components/admin/DatasetStatusBar';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDataImport() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleImportComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Dataset Status Bar */}
      <DatasetStatusBar refreshTrigger={refreshTrigger} />
      
      {/* Main Content - Natural scroll without nested containers */}
      <div className="mx-auto max-w-2xl space-y-6 p-4 pb-32">
          <div className="text-center pt-4">
            <h1 className="text-3xl font-bold">Medicare Data Import</h1>
            <p className="mt-2 text-muted-foreground">
              Import MPFS, GPCI, OPPS, DMEPOS data via server-side processing
            </p>
          </div>

          {/* Self-Test */}
          <SelfTestCard />

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
