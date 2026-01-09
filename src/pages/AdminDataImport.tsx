import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertCircle, Loader2, Database, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';
import {
  fetchAndParseExcel,
  parseGpciData,
  importGpciToDatabase,
} from '@/lib/medicareDataImporter';

type ImportStatus = 'idle' | 'loading' | 'importing' | 'success' | 'error';

interface ImportState {
  status: ImportStatus;
  progress: number;
  total: number;
  message: string;
}

interface MpfsCsvRow {
  hcpcs: string;
  modifier: string;
  description: string;
  status: string;
  work_rvu: string;
  nonfac_pe_rvu: string;
  fac_pe_rvu: string;
  mp_rvu: string;
  nonfac_fee: string;
  fac_fee: string;
  pctc: string;
  global_days: string;
  mult_surgery_indicator: string;
  conversion_factor: string;
  year: string;
  qp_status: string;
  source: string;
}

export default function AdminDataImport() {
  const mpfsFileInputRef = useRef<HTMLInputElement>(null);
  
  const [mpfsState, setMpfsState] = useState<ImportState>({
    status: 'idle',
    progress: 0,
    total: 0,
    message: '',
  });
  
  const [gpciState, setGpciState] = useState<ImportState>({
    status: 'idle',
    progress: 0,
    total: 0,
    message: '',
  });

  const parseNumber = (value: string | undefined | null): number | null => {
    if (!value || value.trim() === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  };

  const parseInteger = (value: string | undefined | null): number | null => {
    if (!value || value.trim() === '') return null;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  };

  const handleMpfsFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMpfsState({ status: 'loading', progress: 0, total: 0, message: 'Parsing CSV file...' });

    Papa.parse<MpfsCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.errors.length > 0) {
          setMpfsState({
            status: 'error',
            progress: 0,
            total: 0,
            message: `CSV parsing error: ${results.errors[0].message}`,
          });
          return;
        }

        const rows = results.data;
        setMpfsState({
          status: 'importing',
          progress: 0,
          total: rows.length,
          message: `Importing ${rows.length} MPFS records...`,
        });

        try {
          const BATCH_SIZE = 1000;
          let totalImported = 0;

          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            
            const records = batch.map((row) => ({
              hcpcs: row.hcpcs?.trim() || '',
              modifier: row.modifier?.trim() || null,
              description: row.description?.trim() || null,
              status: row.status?.trim() || null,
              work_rvu: parseNumber(row.work_rvu),
              nonfac_pe_rvu: parseNumber(row.nonfac_pe_rvu),
              fac_pe_rvu: parseNumber(row.fac_pe_rvu),
              mp_rvu: parseNumber(row.mp_rvu),
              nonfac_fee: parseNumber(row.nonfac_fee),
              fac_fee: parseNumber(row.fac_fee),
              pctc: row.pctc?.trim() || null,
              global_days: row.global_days?.trim() || null,
              mult_surgery_indicator: row.mult_surgery_indicator?.trim() || null,
              conversion_factor: parseNumber(row.conversion_factor),
              year: parseInteger(row.year),
              qp_status: row.qp_status?.trim() || null,
              source: row.source?.trim() || null,
            })).filter(record => record.hcpcs); // Filter out rows without HCPCS code

            const { error } = await supabase
              .from('mpfs_benchmarks')
              .upsert(records, { onConflict: 'hcpcs' });

            if (error) {
              throw new Error(error.message);
            }

            totalImported += records.length;
            setMpfsState(prev => ({
              ...prev,
              progress: totalImported,
              message: `Imported ${totalImported} of ${rows.length} records...`,
            }));
          }

          setMpfsState({
            status: 'success',
            progress: totalImported,
            total: rows.length,
            message: `Successfully imported ${totalImported} MPFS records!`,
          });
        } catch (error) {
          setMpfsState({
            status: 'error',
            progress: 0,
            total: rows.length,
            message: error instanceof Error ? error.message : 'Failed to import data',
          });
        }
      },
      error: (error) => {
        setMpfsState({
          status: 'error',
          progress: 0,
          total: 0,
          message: `Failed to parse CSV: ${error.message}`,
        });
      },
    });

    // Reset file input
    if (mpfsFileInputRef.current) {
      mpfsFileInputRef.current.value = '';
    }
  };

  const importGpci = async () => {
    setGpciState({ status: 'loading', progress: 0, total: 0, message: 'Loading Excel file...' });
    
    try {
      const data = await fetchAndParseExcel('/data/gpci_2026_by_locality.xlsx');
      const records = parseGpciData(data);
      
      setGpciState({
        status: 'importing',
        progress: 0,
        total: records.length,
        message: `Importing ${records.length} GPCI records...`,
      });
      
      const result = await importGpciToDatabase(records, (imported, total) => {
        setGpciState(prev => ({
          ...prev,
          progress: imported,
          message: `Imported ${imported} of ${total} records...`,
        }));
      });
      
      if (result.success) {
        setGpciState({
          status: 'success',
          progress: result.imported,
          total: records.length,
          message: `Successfully imported ${result.imported} GPCI records!`,
        });
      } else {
        setGpciState({
          status: 'error',
          progress: result.imported,
          total: records.length,
          message: result.error || 'Unknown error occurred',
        });
      }
    } catch (error) {
      setGpciState({
        status: 'error',
        progress: 0,
        total: 0,
        message: error instanceof Error ? error.message : 'Failed to load file',
      });
    }
  };

  const renderStatusIcon = (status: ImportStatus) => {
    switch (status) {
      case 'loading':
      case 'importing':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Database className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const isImporting = mpfsState.status === 'loading' || mpfsState.status === 'importing';

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Medicare Data Import</h1>
          <p className="mt-2 text-muted-foreground">
            Import MPFS and GPCI data from CSV/Excel files into the database
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {renderStatusIcon(mpfsState.status)}
              <CardTitle>MPFS Benchmarks</CardTitle>
            </div>
            <CardDescription>
              Medicare Physician Fee Schedule (2026 Non-QP National) - Select a CSV file to import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mpfsState.status === 'importing' && mpfsState.total > 0 && (
              <Progress value={(mpfsState.progress / mpfsState.total) * 100} />
            )}
            
            {mpfsState.message && (
              <p className={`text-sm ${mpfsState.status === 'error' ? 'text-destructive' : mpfsState.status === 'success' ? 'text-green-600' : 'text-muted-foreground'}`}>
                {mpfsState.message}
              </p>
            )}
            
            <div className="flex flex-col gap-2">
              <Input
                ref={mpfsFileInputRef}
                type="file"
                accept=".csv"
                onChange={handleMpfsFileSelect}
                disabled={isImporting}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Expected columns: hcpcs, modifier, description, status, work_rvu, nonfac_pe_rvu, fac_pe_rvu, mp_rvu, nonfac_fee, fac_fee, pctc, global_days, mult_surgery_indicator, conversion_factor, year, qp_status, source
              </p>
            </div>

            {isImporting && (
              <Button disabled className="w-full">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {renderStatusIcon(gpciState.status)}
              <CardTitle>GPCI Localities</CardTitle>
            </div>
            <CardDescription>
              Geographic Practice Cost Index (2026 by Locality)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gpciState.status === 'importing' && gpciState.total > 0 && (
              <Progress value={(gpciState.progress / gpciState.total) * 100} />
            )}
            
            {gpciState.message && (
              <p className={`text-sm ${gpciState.status === 'error' ? 'text-destructive' : gpciState.status === 'success' ? 'text-green-600' : 'text-muted-foreground'}`}>
                {gpciState.message}
              </p>
            )}
            
            <Button
              onClick={importGpci}
              disabled={gpciState.status === 'loading' || gpciState.status === 'importing'}
              className="w-full"
            >
              {gpciState.status === 'loading' || gpciState.status === 'importing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : gpciState.status === 'success' ? (
                'Re-import GPCI Data'
              ) : (
                'Import GPCI Data'
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="text-center">
          <a href="/" className="text-sm text-primary hover:underline">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
