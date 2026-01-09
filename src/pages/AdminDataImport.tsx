import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle, Loader2, Database } from 'lucide-react';
import {
  fetchAndParseExcel,
  parseMpfsData,
  parseGpciData,
  importMpfsToDatabase,
  importGpciToDatabase,
} from '@/lib/medicareDataImporter';

type ImportStatus = 'idle' | 'loading' | 'importing' | 'success' | 'error';

interface ImportState {
  status: ImportStatus;
  progress: number;
  total: number;
  message: string;
}

export default function AdminDataImport() {
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

  const importMpfs = async () => {
    setMpfsState({ status: 'loading', progress: 0, total: 0, message: 'Loading Excel file...' });
    
    try {
      const data = await fetchAndParseExcel('/data/mpfs_2026_nonqp_national.xlsx');
      const records = parseMpfsData(data);
      
      setMpfsState({
        status: 'importing',
        progress: 0,
        total: records.length,
        message: `Importing ${records.length} MPFS records...`,
      });
      
      const result = await importMpfsToDatabase(records, (imported, total) => {
        setMpfsState(prev => ({
          ...prev,
          progress: imported,
          message: `Imported ${imported} of ${total} records...`,
        }));
      });
      
      if (result.success) {
        setMpfsState({
          status: 'success',
          progress: result.imported,
          total: records.length,
          message: `Successfully imported ${result.imported} MPFS records!`,
        });
      } else {
        setMpfsState({
          status: 'error',
          progress: result.imported,
          total: records.length,
          message: result.error || 'Unknown error occurred',
        });
      }
    } catch (error) {
      setMpfsState({
        status: 'error',
        progress: 0,
        total: 0,
        message: error instanceof Error ? error.message : 'Failed to load file',
      });
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

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Medicare Data Import</h1>
          <p className="mt-2 text-muted-foreground">
            Import MPFS and GPCI data from Excel files into the database
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {renderStatusIcon(mpfsState.status)}
              <CardTitle>MPFS Benchmarks</CardTitle>
            </div>
            <CardDescription>
              Medicare Physician Fee Schedule (2026 Non-QP National)
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
            
            <Button
              onClick={importMpfs}
              disabled={mpfsState.status === 'loading' || mpfsState.status === 'importing'}
              className="w-full"
            >
              {mpfsState.status === 'loading' || mpfsState.status === 'importing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : mpfsState.status === 'success' ? (
                'Re-import MPFS Data'
              ) : (
                'Import MPFS Data'
              )}
            </Button>
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
