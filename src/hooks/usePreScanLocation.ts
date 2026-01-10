/**
 * Hook for pre-scanning uploaded documents for ZIP/State
 * 
 * Triggers automatically when a file is uploaded in 'bill' mode,
 * and populates form fields with detected values.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { preScanLocation, PreScanLocationResult, LocationSource, extractTextFromFilename } from '@/lib/preScanLocation';
import { UploadedFile } from '@/types';
import { extractAddressWithFallback, AddressDetectionResult } from '@/lib/billAddressExtractor';

export interface LocationSourceState {
  zipSource: LocationSource;
  stateSource: LocationSource;
}

export interface PreScanState {
  isScanning: boolean;
  result: PreScanLocationResult | null;
  detectedAddress: AddressDetectionResult | null;
}

interface UsePreScanLocationOptions {
  uploadedFile: UploadedFile | null;
  analysisMode: string;
  currentZip: string;
  currentState: string;
  onZipDetected: (zip: string) => void;
  onStateDetected: (state: string) => void;
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
    detectedAddress: null,
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
        detectedAddress: null,
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
      
      try {
        // For now, we can only extract from filename on client-side
        // The full OCR happens server-side during analysis
        // But we can still try the filename approach
        const filenameText = extractTextFromFilename(uploadedFile.file.name);
        
        // Run pre-scan on filename text (limited but immediate)
        let result = await preScanLocation(filenameText);
        
        // Also try the billAddressExtractor for any text we might have
        let detectedAddress: AddressDetectionResult | null = null;
        if (filenameText) {
          detectedAddress = extractAddressWithFallback(filenameText);
        }
        
        // Merge results
        const finalZip = result.zip5 || detectedAddress?.detected_zip;
        const finalState = result.stateAbbr || detectedAddress?.detected_state;
        
        if (finalZip) {
          result = { ...result, zip5: finalZip };
        }
        if (finalState) {
          result = { ...result, stateAbbr: finalState };
        }
        
        setScanState({
          isScanning: false,
          result,
          detectedAddress,
        });
        
        // Apply detected values if user hasn't manually edited
        if (finalZip && !userEditedZipRef.current && !currentZip) {
          onZipDetected(finalZip);
          setSourceState(prev => ({ ...prev, zipSource: 'detected' }));
        }
        
        if (finalState && !userEditedStateRef.current && !currentState) {
          onStateDetected(finalState);
          setSourceState(prev => ({ ...prev, stateSource: 'detected' }));
        }
        
        console.log('[usePreScanLocation] Scan complete:', {
          ran: result.ran,
          zip: finalZip,
          state: finalState,
          confidence: result.confidence,
          evidence: result.evidence,
        });
        
      } catch (err) {
        console.error('[usePreScanLocation] Scan error:', err);
        setScanState({
          isScanning: false,
          result: {
            ran: true,
            confidence: 'low',
            error: err instanceof Error ? err.message : 'Scan failed',
          },
          detectedAddress: null,
        });
      }
    };
    
    runScan();
  }, [uploadedFile?.id, uploadedFile?.file, analysisMode, currentZip, currentState, onZipDetected, onStateDetected]);
  
  return {
    ...scanState,
    ...sourceState,
    markZipAsUserEdited,
    markStateAsUserEdited,
  };
}
