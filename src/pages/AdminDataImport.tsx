import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertCircle, Loader2, Database } from 'lucide-react';
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
  skippedRows?: number;
}

// Raw CSV row - using exact CSV headers (HCPCS, MOD, etc.)
interface MpfsCsvRawRow {
  [key: string]: string | undefined;
}

// Cleaned record ready for DB insert
interface MpfsDbRecord {
  hcpcs: string;
  modifier: string;
  description: string | null;
  status: string | null;
  work_rvu: number | null;
  nonfac_pe_rvu: number | null;
  fac_pe_rvu: number | null;
  mp_rvu: number | null;
  nonfac_fee: number | null;
  fac_fee: number | null;
  pctc: string | null;
  global_days: string | null;
  mult_surgery_indicator: string | null;
  conversion_factor: number | null;
  year: number;
  qp_status: string;
  source: string;
}

// CSV column name mapping (CSV header -> DB column)
const CSV_COLUMN_MAP: Record<string, string> = {
  'HCPCS': 'hcpcs',
  'hcpcs': 'hcpcs',
  'MOD': 'modifier',
  'modifier': 'modifier',
  'description': 'description',
  'status': 'status',
  'work_rvu': 'work_rvu',
  'nonfac_pe_rvu': 'nonfac_pe_rvu',
  'fac_pe_rvu': 'fac_pe_rvu',
  'mp_rvu': 'mp_rvu',
  'nonfac_fee': 'nonfac_fee',
  'fac_fee': 'fac_fee',
  'pctc': 'pctc',
  'global_days': 'global_days',
  'mult_surgery_indicator': 'mult_surgery_indicator',
  'conversion_factor': 'conversion_factor',
  'year': 'year',
  'qp_status': 'qp_status',
  'source': 'source',
};

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

  // Parse numeric value, return null if invalid/blank
  const parseNumber = (value: string | undefined | null): number | null => {
    if (!value || value.trim() === '') return null;
    const trimmed = value.trim().toLowerCase();
    // Handle "not found" literal as null (not an error)
    if (trimmed === 'not found') return null;
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? null : parsed;
  };

  // Parse integer, return null if invalid/blank
  const parseInteger = (value: string | undefined | null): number | null => {
    if (!value || value.trim() === '') return null;
    const parsed = parseInt(value.trim(), 10);
    return isNaN(parsed) ? null : parsed;
  };

  // Get value from row using either CSV header or DB column name
  const getRowValue = (row: MpfsCsvRawRow, dbColumn: string): string | undefined => {
    // Try direct DB column name first
    if (row[dbColumn] !== undefined) return row[dbColumn];
    
    // Try to find by CSV header mapping
    for (const [csvHeader, mappedColumn] of Object.entries(CSV_COLUMN_MAP)) {
      if (mappedColumn === dbColumn && row[csvHeader] !== undefined) {
        return row[csvHeader];
      }
    }
    return undefined;
  };

  // Transform a raw CSV row to a clean DB record
  const transformRow = (row: MpfsCsvRawRow, rowIndex: number): { record: MpfsDbRecord | null; error: string | null } => {
    // Get HCPCS - required field, preserve as text (leading zeros, letters)
    const hcpcs = getRowValue(row, 'hcpcs')?.trim();
    if (!hcpcs) {
      return { record: null, error: `Row ${rowIndex + 1}: Missing HCPCS code` };
    }

    // Get modifier - normalize: trim, uppercase, default to '' if blank
    const rawModifier = getRowValue(row, 'modifier');
    const modifier = rawModifier?.trim().toUpperCase() || '';

    // Get year - required field
    const yearValue = parseInteger(getRowValue(row, 'year'));
    if (yearValue === null) {
      return { record: null, error: `Row ${rowIndex + 1}: Missing or invalid year for HCPCS ${hcpcs}` };
    }

    // Get qp_status - default to 'nonQP' if missing
    const qpStatus = getRowValue(row, 'qp_status')?.trim() || 'nonQP';

    // Get source - default to 'CMS MPFS' if missing
    const source = getRowValue(row, 'source')?.trim() || 'CMS MPFS';

    // Parse numeric fields (allow null)
    const workRvu = parseNumber(getRowValue(row, 'work_rvu'));
    const nonfacPeRvu = parseNumber(getRowValue(row, 'nonfac_pe_rvu'));
    const facPeRvu = parseNumber(getRowValue(row, 'fac_pe_rvu'));
    const mpRvu = parseNumber(getRowValue(row, 'mp_rvu'));
    const nonfacFee = parseNumber(getRowValue(row, 'nonfac_fee'));
    const facFee = parseNumber(getRowValue(row, 'fac_fee'));
    const conversionFactor = parseNumber(getRowValue(row, 'conversion_factor'));

    // String fields (keep as text)
    const description = getRowValue(row, 'description')?.trim() || null;
    const status = getRowValue(row, 'status')?.trim() || null;
    const pctc = getRowValue(row, 'pctc')?.trim() || null;
    const globalDays = getRowValue(row, 'global_days')?.trim() || null; // Keep as text (can be "XXX")
    const multSurgeryIndicator = getRowValue(row, 'mult_surgery_indicator')?.trim() || null;

    return {
      record: {
        hcpcs,
        modifier,
        description,
        status,
        work_rvu: workRvu,
        nonfac_pe_rvu: nonfacPeRvu,
        fac_pe_rvu: facPeRvu,
        mp_rvu: mpRvu,
        nonfac_fee: nonfacFee,
        fac_fee: facFee,
        pctc,
        global_days: globalDays,
        mult_surgery_indicator: multSurgeryIndicator,
        conversion_factor: conversionFactor,
        year: yearValue,
        qp_status: qpStatus,
        source,
      },
      error: null,
    };
  };

  const handleMpfsFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMpfsState({ status: 'loading', progress: 0, total: 0, message: 'Parsing CSV file...' });

    Papa.parse<MpfsCsvRawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.errors.length > 0) {
          console.error('CSV parsing errors:', results.errors);
          setMpfsState({
            status: 'error',
            progress: 0,
            total: 0,
            message: `CSV parsing error: ${results.errors[0].message}`,
          });
          return;
        }

        const rows = results.data;
        console.log(`Parsed ${rows.length} rows from CSV`);
        console.log('CSV headers:', results.meta.fields);
        
        setMpfsState({
          status: 'importing',
          progress: 0,
          total: rows.length,
          message: `Processing ${rows.length} rows...`,
        });

        try {
          const BATCH_SIZE = 500;
          let totalImported = 0;
          let skippedRows = 0;
          const errors: string[] = [];

          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batchRows = rows.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const records: MpfsDbRecord[] = [];
            
            for (let j = 0; j < batchRows.length; j++) {
              const { record, error } = transformRow(batchRows[j], i + j);
              if (error) {
                errors.push(error);
                skippedRows++;
                if (errors.length <= 5) {
                  console.warn(error);
                }
              } else if (record) {
                records.push(record);
              }
            }

            if (records.length === 0) {
              continue;
            }

            // Upsert with the natural key constraint
            const { error } = await supabase
              .from('mpfs_benchmarks')
              .upsert(records, { 
                onConflict: 'hcpcs,modifier,year,qp_status,source',
                ignoreDuplicates: false 
              });

            if (error) {
              console.error('Supabase upsert error:', error);
              
              // Provide helpful error message for constraint issues
              if (error.message.includes('unique') || error.message.includes('ON CONFLICT')) {
                throw new Error(
                  `Batch ${batchNum} failed: Database constraint error. ` +
                  `First row in batch: HCPCS=${records[0]?.hcpcs}, MOD=${records[0]?.modifier}, ` +
                  `year=${records[0]?.year}, qp_status=${records[0]?.qp_status}, source=${records[0]?.source}. ` +
                  `Original error: ${error.message}`
                );
              }
              throw new Error(`Batch ${batchNum} failed: ${error.message}`);
            }

            totalImported += records.length;
            setMpfsState(prev => ({
              ...prev,
              progress: totalImported,
              message: `Imported ${totalImported} of ${rows.length} records (batch ${batchNum})...`,
            }));
          }

          const successMessage = skippedRows > 0
            ? `Successfully imported ${totalImported} records! (${skippedRows} rows skipped due to errors)`
            : `Successfully imported ${totalImported} MPFS records!`;

          setMpfsState({
            status: 'success',
            progress: totalImported,
            total: rows.length,
            message: successMessage,
            skippedRows,
          });

          if (errors.length > 0) {
            console.warn(`Import completed with ${errors.length} row errors:`, errors.slice(0, 10));
          }
        } catch (error) {
          console.error('Import error:', error);
          setMpfsState({
            status: 'error',
            progress: 0,
            total: rows.length,
            message: error instanceof Error ? error.message : 'Failed to import data',
          });
        }
      },
      error: (error) => {
        console.error('Papa parse error:', error);
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
                Expected columns: HCPCS, MOD, description, status, work_rvu, nonfac_pe_rvu, fac_pe_rvu, mp_rvu, nonfac_fee, fac_fee, pctc, global_days, mult_surgery_indicator, conversion_factor, year, qp_status, source
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
