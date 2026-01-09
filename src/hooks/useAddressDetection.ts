/**
 * Hook for detecting ZIP/State from uploaded bill files
 * 
 * Performs a lightweight pre-scan of uploaded documents to extract
 * address information for auto-populating the landing page.
 */

import { useState, useEffect, useCallback } from 'react';
import { extractAddressWithFallback, AddressDetectionResult } from '@/lib/billAddressExtractor';
import { UploadedFile } from '@/types';

export interface AddressDetectionState {
  isScanning: boolean;
  result: AddressDetectionResult | null;
  error: string | null;
}

/**
 * Extract text from an image using canvas OCR placeholder
 * In a real implementation, this would call an OCR service
 */
async function extractTextFromImage(file: File): Promise<string> {
  // For images, we can't do client-side OCR without a library
  // Return empty - the actual extraction happens server-side during analysis
  // But we can try to read EXIF data or filename patterns
  
  const fileName = file.name.toLowerCase();
  
  // Try to extract any meaningful info from filename
  const zipInFilename = fileName.match(/\b(\d{5})\b/);
  if (zipInFilename) {
    return `ZIP: ${zipInFilename[1]}`;
  }
  
  return '';
}

/**
 * Extract text from a PDF
 * Uses the pdf.js library if available, otherwise returns empty
 */
async function extractTextFromPdf(file: File): Promise<string> {
  // We don't have pdf.js, so we'll rely on server-side extraction
  // For now, check if there's any text content we can access
  return '';
}

/**
 * Hook to detect address from uploaded file
 */
export function useAddressDetection(
  uploadedFile: UploadedFile | null,
  analysisMode: string
) {
  const [state, setState] = useState<AddressDetectionState>({
    isScanning: false,
    result: null,
    error: null
  });

  // Reset when file changes
  useEffect(() => {
    if (!uploadedFile) {
      setState({
        isScanning: false,
        result: null,
        error: null
      });
    }
  }, [uploadedFile]);

  // Perform scan when file is uploaded and mode is 'bill'
  const scanForAddress = useCallback(async (file: File) => {
    if (analysisMode !== 'bill') {
      return null;
    }

    setState(prev => ({ ...prev, isScanning: true, error: null }));

    try {
      let text = '';
      
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractTextFromPdf(file);
      } else if (file.type.startsWith('image/')) {
        text = await extractTextFromImage(file);
      }

      // If we got text, try to extract address
      if (text) {
        const result = extractAddressWithFallback(text);
        setState({ isScanning: false, result, error: null });
        return result;
      } else {
        // No text available client-side
        setState({ 
          isScanning: false, 
          result: null, 
          error: null 
        });
        return null;
      }
    } catch (err) {
      console.error('[useAddressDetection] Error scanning file:', err);
      setState({ 
        isScanning: false, 
        result: null, 
        error: 'Failed to scan document for address' 
      });
      return null;
    }
  }, [analysisMode]);

  // Auto-scan when file changes
  useEffect(() => {
    if (uploadedFile?.file && analysisMode === 'bill') {
      scanForAddress(uploadedFile.file);
    }
  }, [uploadedFile?.file, analysisMode, scanForAddress]);

  return {
    ...state,
    scanForAddress
  };
}

/**
 * Process analysis response to extract address for future use
 */
export function extractAddressFromAnalysis(analysisText: string): AddressDetectionResult | null {
  if (!analysisText) return null;
  return extractAddressWithFallback(analysisText);
}
