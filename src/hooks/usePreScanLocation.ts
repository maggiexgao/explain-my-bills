/**
 * Hook for pre-scanning uploaded documents for ZIP/State
 * 
 * Triggers automatically when a file is uploaded in 'bill' mode,
 * and populates form fields with detected values.
 * 
 * Uses server-side vision API for actual document text extraction.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { UploadedFile } from '@/types';
import { supabase } from '@/integrations/supabase/client';

export type LocationSource = 'user' | 'detected' | 'none';

export interface PreScanLocationResult {
  zip5?: string;
  stateAbbr?: string;
  confidence: 'high' | 'medium' | 'low';
  evidence?: string;
  stateSource?: 'text_pattern' | 'zip_lookup' | 'zip_prefix';
  ran: boolean;
  extractedText?: string;
  error?: string;
}

export interface LocationSourceState {
  zipSource: LocationSource;
  stateSource: LocationSource;
}

export interface PreScanState {
  isScanning: boolean;
  result: PreScanLocationResult | null;
}

interface UsePreScanLocationOptions {
  uploadedFile: UploadedFile | null;
  analysisMode: string;
  currentZip: string;
  currentState: string;
  onZipDetected: (zip: string) => void;
  onStateDetected: (state: string) => void;
}

// Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function usePreScanLocation({
  uploadedFile,
  analysisMode,
  currentZip,
  currentState,
  onZipDetected,
  onStateDetected,
}: UsePreScanLocationOptions) {
  const [scanState, setScanState] = useState<PreScanState>({
    isScanning: false,
    result: null,
  });
  
  const [sourceState, setSourceState] = useState<LocationSourceState>({
    zipSource: 'none',
    stateSource: 'none',
  });
  
  // Track which file we've already scanned
  const scannedFileIdRef = useRef<string | null>(null);
  
  // Track if user has manually edited
  const userEditedZipRef = useRef(false);
  const userEditedStateRef = useRef(false);
  
  // Mark ZIP as user-edited
  const markZipAsUserEdited = useCallback(() => {
    userEditedZipRef.current = true;
    setSourceState(prev => ({ ...prev, zipSource: 'user' }));
  }, []);
  
  // Mark State as user-edited
  const markStateAsUserEdited = useCallback(() => {
    userEditedStateRef.current = true;
    setSourceState(prev => ({ ...prev, stateSource: 'user' }));
  }, []);
  
  // Reset when file is removed
  useEffect(() => {
    if (!uploadedFile) {
      setScanState({
        isScanning: false,
        result: null,
      });
      scannedFileIdRef.current = null;
      userEditedZipRef.current = false;
      userEditedStateRef.current = false;
      setSourceState({ zipSource: 'none', stateSource: 'none' });
    }
  }, [uploadedFile]);
  
  // Run pre-scan when file is uploaded
  useEffect(() => {
    // Only scan in bill mode
    if (analysisMode !== 'bill') return;
    
    // Skip if no file
    if (!uploadedFile?.file) return;
    
    // Skip if we already scanned this file
    if (scannedFileIdRef.current === uploadedFile.id) return;
    
    const runScan = async () => {
      scannedFileIdRef.current = uploadedFile.id;
      setScanState(prev => ({ ...prev, isScanning: true }));
      
      console.log('[usePreScanLocation] Starting scan for file:', uploadedFile.file.name);
      
      try {
        // Convert file to base64
        const documentContent = await fileToBase64(uploadedFile.file);
        
        // Call server-side pre-scan function
        const { data, error } = await supabase.functions.invoke('pre-scan-location', {
          body: {
            documentContent,
            documentType: uploadedFile.file.type,
          },
        });
        
        if (error) {
          console.error('[usePreScanLocation] Edge function error:', error);
          throw new Error(error.message || 'Pre-scan failed');
        }
        
        const result = data as PreScanLocationResult;
        
        console.log('[usePreScanLocation] Scan complete:', {
          ran: result.ran,
          zip: result.zip5,
          state: result.stateAbbr,
          confidence: result.confidence,
          evidence: result.evidence,
          stateSource: result.stateSource,
        });
        
        setScanState({
          isScanning: false,
          result,
        });
        
        // Apply detected values if user hasn't manually edited
        if (result.zip5 && !userEditedZipRef.current && !currentZip) {
          console.log('[usePreScanLocation] Auto-populating ZIP:', result.zip5);
          onZipDetected(result.zip5);
          setSourceState(prev => ({ ...prev, zipSource: 'detected' }));
        }
        
        if (result.stateAbbr && !userEditedStateRef.current && !currentState) {
          console.log('[usePreScanLocation] Auto-populating state:', result.stateAbbr);
          onStateDetected(result.stateAbbr);
          setSourceState(prev => ({ ...prev, stateSource: 'detected' }));
        }
        
      } catch (err) {
        console.error('[usePreScanLocation] Scan error:', err);
        setScanState({
          isScanning: false,
          result: {
            ran: true,
            confidence: 'low',
            error: err instanceof Error ? err.message : 'Scan failed',
          },
        });
      }
    };
    
    // Add a small delay to show the scanning UI
    const timeoutId = setTimeout(runScan, 300);
    
    return () => clearTimeout(timeoutId);
  }, [uploadedFile?.id, uploadedFile?.file, analysisMode, currentZip, currentState, onZipDetected, onStateDetected]);
  
  return {
    ...scanState,
    ...sourceState,
    markZipAsUserEdited,
    markStateAsUserEdited,
  };
}
