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
  parseZipToLocalityData,
  importZipToLocalityDatabase,
} from '@/lib/medicareDataImporter';
import { MapPin } from 'lucide-react';

type ImportStatus = 'idle' | 'loading' | 'importing' | 'success' | 'error';

interface ImportStats {
  rowsRead: number;
  rowsInserted: number;
  rowsSkippedBlankHcpcs: number;
  rowsSkippedInvalid: number;
  rowsWithFeeNull: number;
  rowsWithRvusZero: number;
}

interface ImportState {
  status: ImportStatus;
  progress: number;
  total: number;
  message: string;
  stats?: ImportStats;
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

  const [zipCrosswalkState, setZipCrosswalkState] = useState<ImportState>({
    status: 'idle',
    progress: 0,
    total: 0,
    message: '',
  });

  // Parse numeric value, return null if invalid/blank
  // Coerces "not found" (case-insensitive) to null
  const parseNumber = (value: string | undefined | null): number | null => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    if (trimmed === '') return null;
    // Handle "not found" literal as null (case-insensitive)
    if (trimmed.toLowerCase() === 'not found') return null;
    // Handle other non-numeric placeholders
    if (trimmed.toLowerCase() === 'n/a' || trimmed === '-') return null;
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? null : parsed;
  };

  // Parse integer, return null if invalid/blank
  const parseInteger = (value: string | undefined | null): number | null => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = parseInt(trimmed, 10);
    return isNaN(parsed) ? null : parsed;
  };

  // Check if a row has a valid (non-blank) HCPCS code
  const hasValidHcpcs = (row: MpfsCsvRawRow): boolean => {
    const hcpcs = getRowValue(row, 'hcpcs');
    if (!hcpcs) return false;
    const trimmed = hcpcs.trim();
    return trimmed !== '';
  };

  // Check if a column name is valid (not unnamed/empty)
  const isValidColumnName = (name: string): boolean => {
    if (!name) return false;
    const lower = name.toLowerCase().trim();
    // Skip unnamed columns (from pandas/Excel exports)
    if (lower.startsWith('unnamed:') || lower.startsWith('unnamed ')) return false;
    if (lower === '' || lower === 'undefined') return false;
    return true;
  };

  // Filter out unnamed/empty columns from a row
  const filterValidColumns = (row: MpfsCsvRawRow): MpfsCsvRawRow => {
    const filtered: MpfsCsvRawRow = {};
    for (const [key, value] of Object.entries(row)) {
      if (isValidColumnName(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
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
  // Returns record stats for tracking fee/RVU nulls
  const transformRow = (row: MpfsCsvRawRow, rowIndex: number): { 
    record: MpfsDbRecord | null; 
    error: string | null;
    hasFeeNull: boolean;
    hasRvusZero: boolean;
  } => {
    // Filter out unnamed/empty columns first
    const cleanRow = filterValidColumns(row);
    
    // Get HCPCS - required field, preserve as text (leading zeros, letters)
    const hcpcs = getRowValue(cleanRow, 'hcpcs')?.trim();
    if (!hcpcs) {
      return { record: null, error: `Row ${rowIndex + 1}: Missing HCPCS code`, hasFeeNull: false, hasRvusZero: false };
    }

    // Get modifier - normalize: trim, uppercase, default to '' if blank
    const rawModifier = getRowValue(cleanRow, 'modifier');
    const modifier = rawModifier?.trim().toUpperCase() || '';

    // Get year - default to 2026 if missing (for our current dataset)
    let yearValue = parseInteger(getRowValue(cleanRow, 'year'));
    if (yearValue === null) {
      yearValue = 2026; // Default year for current MPFS dataset
    }

    // Get qp_status - default to 'nonQP' if missing
    const qpStatus = getRowValue(cleanRow, 'qp_status')?.trim() || 'nonQP';

    // Get source - default to 'CMS MPFS' if missing
    const source = getRowValue(cleanRow, 'source')?.trim() || 'CMS MPFS';

    // Parse numeric fields (allow null) - "not found" coerced to null
    const workRvu = parseNumber(getRowValue(cleanRow, 'work_rvu'));
    const nonfacPeRvu = parseNumber(getRowValue(cleanRow, 'nonfac_pe_rvu'));
    const facPeRvu = parseNumber(getRowValue(cleanRow, 'fac_pe_rvu'));
    const mpRvu = parseNumber(getRowValue(cleanRow, 'mp_rvu'));
    const nonfacFee = parseNumber(getRowValue(cleanRow, 'nonfac_fee'));
    const facFee = parseNumber(getRowValue(cleanRow, 'fac_fee'));
    const conversionFactor = parseNumber(getRowValue(cleanRow, 'conversion_factor'));

    // Track stats
    const hasFeeNull = nonfacFee === null && facFee === null;
    const hasRvusZero = (workRvu === null || workRvu === 0) && 
                        (nonfacPeRvu === null || nonfacPeRvu === 0) && 
                        (facPeRvu === null || facPeRvu === 0) && 
                        (mpRvu === null || mpRvu === 0);

    // String fields (keep as text)
    const description = getRowValue(cleanRow, 'description')?.trim() || null;
    const status = getRowValue(cleanRow, 'status')?.trim() || null;
    const pctc = getRowValue(cleanRow, 'pctc')?.trim() || null;
    const globalDays = getRowValue(cleanRow, 'global_days')?.trim() || null; // Keep as text (can be "XXX")
    const multSurgeryIndicator = getRowValue(cleanRow, 'mult_surgery_indicator')?.trim() || null;

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
      hasFeeNull,
      hasRvusZero,
    };
  };

  const handleMpfsFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMpfsState({ status: 'loading', progress: 0, total: 0, message: 'Parsing CSV file...' });

    Papa.parse<MpfsCsvRawRow>(file, {
      header: true,
      skipEmptyLines: 'greedy', // Skip all empty lines including whitespace-only
      complete: async (results) => {
        if (results.errors.length > 0) {
          // Filter out "TooFewFields" errors which are common in padded CSVs
          const criticalErrors = results.errors.filter(e => e.type !== 'FieldMismatch');
          if (criticalErrors.length > 0) {
            console.error('CSV parsing errors:', criticalErrors);
            setMpfsState({
              status: 'error',
              progress: 0,
              total: 0,
              message: `CSV parsing error: ${criticalErrors[0].message}`,
            });
            return;
          }
        }

        const allRows = results.data;
        
        // Filter out valid column names from headers
        const rawHeaders = results.meta.fields || [];
        const validHeaders = rawHeaders.filter(isValidColumnName);
        const droppedColumns = rawHeaders.filter(h => !isValidColumnName(h));
        
        console.log(`CSV headers (${rawHeaders.length} total):`, rawHeaders);
        console.log(`Valid headers (${validHeaders.length}):`, validHeaders);
        if (droppedColumns.length > 0) {
          console.log(`Dropped unnamed/empty columns (${droppedColumns.length}):`, droppedColumns);
        }
        
        // CRITICAL: Filter out rows with blank HCPCS BEFORE processing
        const validRows = allRows.filter(hasValidHcpcs);
        const blankHcpcsCount = allRows.length - validRows.length;
        
        console.log(`Total rows read: ${allRows.length}`);
        console.log(`Rows with blank HCPCS (skipped): ${blankHcpcsCount}`);
        console.log(`Rows with valid HCPCS: ${validRows.length}`);
        
        if (validRows.length === 0) {
          setMpfsState({
            status: 'error',
            progress: 0,
            total: 0,
            message: `No valid HCPCS rows found in CSV. All ${allRows.length} rows had blank HCPCS.`,
          });
          return;
        }
        
        setMpfsState({
          status: 'importing',
          progress: 0,
          total: validRows.length,
          message: `Processing ${validRows.length} valid rows (${blankHcpcsCount} blank rows skipped)...`,
        });

        try {
          const BATCH_SIZE = 500;
          let totalImported = 0;
          let rowsSkippedInvalid = 0;
          let rowsWithFeeNull = 0;
          let rowsWithRvusZero = 0;
          const errors: string[] = [];

          for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
            const batchRows = validRows.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const records: MpfsDbRecord[] = [];
            
            for (let j = 0; j < batchRows.length; j++) {
              const { record, error, hasFeeNull, hasRvusZero } = transformRow(batchRows[j], i + j);
              if (error) {
                errors.push(error);
                rowsSkippedInvalid++;
                if (errors.length <= 5) {
                  console.warn(error);
                }
              } else if (record) {
                records.push(record);
                if (hasFeeNull) rowsWithFeeNull++;
                if (hasRvusZero) rowsWithRvusZero++;
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
              message: `Imported ${totalImported} of ${validRows.length} records (batch ${batchNum})...`,
            }));
          }

          const stats: ImportStats = {
            rowsRead: allRows.length,
            rowsInserted: totalImported,
            rowsSkippedBlankHcpcs: blankHcpcsCount,
            rowsSkippedInvalid,
            rowsWithFeeNull,
            rowsWithRvusZero,
          };
          
          console.log('=== MPFS Import Complete ===');
          console.log(`Rows read from CSV: ${stats.rowsRead}`);
          console.log(`Rows inserted: ${stats.rowsInserted}`);
          console.log(`Rows skipped (blank HCPCS): ${stats.rowsSkippedBlankHcpcs}`);
          console.log(`Rows skipped (invalid): ${stats.rowsSkippedInvalid}`);
          console.log(`Rows with NULL fees: ${stats.rowsWithFeeNull}`);
          console.log(`Rows with zero/null RVUs: ${stats.rowsWithRvusZero}`);

          setMpfsState({
            status: 'success',
            progress: totalImported,
            total: allRows.length,
            message: `Successfully imported ${totalImported} MPFS records!`,
            stats,
          });

          if (errors.length > 0) {
            console.warn(`Import completed with ${errors.length} row errors:`, errors.slice(0, 10));
          }
        } catch (error) {
          console.error('Import error:', error);
          setMpfsState({
            status: 'error',
            progress: 0,
            total: validRows.length,
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

  const importZipCrosswalk = async () => {
    setZipCrosswalkState({ status: 'loading', progress: 0, total: 0, message: 'Loading ZIP crosswalk Excel file...' });
    
    try {
      const data = await fetchAndParseExcel('/data/ZIP5_JAN2026.xlsx');
      console.log(`ZIP crosswalk: loaded ${data.length} rows from Excel`);
      
      const records = parseZipToLocalityData(data);
      console.log(`ZIP crosswalk: parsed ${records.length} valid records`);
      
      if (records.length === 0) {
        setZipCrosswalkState({
          status: 'error',
          progress: 0,
          total: 0,
          message: 'No valid ZIP records found. Check that the file has STATE, ZIP CODE, CARRIER, LOCALITY columns.',
        });
        return;
      }
      
      setZipCrosswalkState({
        status: 'importing',
        progress: 0,
        total: records.length,
        message: `Importing ${records.length} ZIP→Locality mappings...`,
      });
      
      const result = await importZipToLocalityDatabase(records, (imported, total) => {
        setZipCrosswalkState(prev => ({
          ...prev,
          progress: imported,
          message: `Imported ${imported.toLocaleString()} of ${total.toLocaleString()} unique ZIPs...`,
        }));
      });
      
      if (result.success) {
        setZipCrosswalkState({
          status: 'success',
          progress: result.imported,
          total: records.length,
          message: `Successfully imported ${result.imported.toLocaleString()} unique ZIP mappings!${result.duplicatesSkipped > 0 ? ` (${result.duplicatesSkipped.toLocaleString()} duplicates merged)` : ''}`,
        });
      } else {
        setZipCrosswalkState({
          status: 'error',
          progress: result.imported,
          total: records.length,
          message: result.error || 'Unknown error occurred',
        });
      }
    } catch (error) {
      console.error('ZIP crosswalk import error:', error);
      setZipCrosswalkState({
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
            
            {/* Import Statistics */}
            {mpfsState.stats && mpfsState.status === 'success' && (
              <div className="rounded-md border bg-muted/50 p-4 text-sm space-y-1">
                <p className="font-medium text-foreground">Import Statistics:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                  <span>Rows read from CSV:</span>
                  <span className="font-mono">{mpfsState.stats.rowsRead.toLocaleString()}</span>
                  <span>Rows inserted:</span>
                  <span className="font-mono text-green-600">{mpfsState.stats.rowsInserted.toLocaleString()}</span>
                  <span>Skipped (blank HCPCS):</span>
                  <span className="font-mono text-amber-600">{mpfsState.stats.rowsSkippedBlankHcpcs.toLocaleString()}</span>
                  <span>Skipped (invalid):</span>
                  <span className="font-mono">{mpfsState.stats.rowsSkippedInvalid.toLocaleString()}</span>
                  <span>With NULL fees:</span>
                  <span className="font-mono">{mpfsState.stats.rowsWithFeeNull.toLocaleString()}</span>
                  <span>With zero RVUs:</span>
                  <span className="font-mono">{mpfsState.stats.rowsWithRvusZero.toLocaleString()}</span>
                </div>
              </div>
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
              <p className="text-xs text-muted-foreground">
                Note: Blank/padded rows (empty HCPCS) and unnamed columns are automatically skipped. "not found" values in fee columns are stored as NULL.
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

        {/* ZIP→Locality Crosswalk Import */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {zipCrosswalkState.status === 'idle' ? (
                <MapPin className="h-5 w-5 text-muted-foreground" />
              ) : (
                renderStatusIcon(zipCrosswalkState.status)
              )}
              <CardTitle>ZIP → Locality Crosswalk</CardTitle>
            </div>
            <CardDescription>
              CMS ZIP code to Medicare carrier/locality mapping (2026) — enables ZIP-based GPCI adjustments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {zipCrosswalkState.status === 'importing' && zipCrosswalkState.total > 0 && (
              <Progress value={(zipCrosswalkState.progress / zipCrosswalkState.total) * 100} />
            )}
            
            {zipCrosswalkState.message && (
              <p className={`text-sm ${zipCrosswalkState.status === 'error' ? 'text-destructive' : zipCrosswalkState.status === 'success' ? 'text-green-600' : 'text-muted-foreground'}`}>
                {zipCrosswalkState.message}
              </p>
            )}
            
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Source:</strong> CMS ZIP Code to Carrier Locality File (ZIP5_JAN2026.xlsx)</p>
              <p><strong>Columns:</strong> STATE, ZIP CODE, CARRIER, LOCALITY, YEAR/QTR</p>
              <p><strong>Purpose:</strong> Maps user ZIP codes to Medicare payment localities for accurate geographic fee adjustments</p>
            </div>
            
            <Button
              onClick={importZipCrosswalk}
              disabled={zipCrosswalkState.status === 'loading' || zipCrosswalkState.status === 'importing'}
              className="w-full"
            >
              {zipCrosswalkState.status === 'loading' || zipCrosswalkState.status === 'importing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : zipCrosswalkState.status === 'success' ? (
                'Re-import ZIP Crosswalk'
              ) : (
                'Import ZIP → Locality Crosswalk'
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
