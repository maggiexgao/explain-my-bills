import { useState, useCallback } from 'react';

// Dynamically import heic2any only when needed
const convertHeicToJpeg = async (file: File): Promise<Blob> => {
  const heic2any = (await import('heic2any')).default;
  const result = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9,
  });
  
  // heic2any can return a single Blob or an array of Blobs
  return Array.isArray(result) ? result[0] : result;
};

export interface ConversionResult {
  previewUrl: string;
  originalUrl: string;
  isConverted: boolean;
  conversionError?: string;
}

export function useHeicConverter() {
  const [isConverting, setIsConverting] = useState(false);

  const isHeicFile = useCallback((file: File): boolean => {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith('.heic') || fileName.endsWith('.heif');
  }, []);

  const convertFile = useCallback(async (file: File): Promise<ConversionResult> => {
    const originalUrl = URL.createObjectURL(file);
    
    // If not HEIC, just return the original URL for both
    if (!isHeicFile(file)) {
      return {
        previewUrl: originalUrl,
        originalUrl,
        isConverted: false,
      };
    }

    // HEIC file - try to convert
    setIsConverting(true);
    try {
      console.log('Converting HEIC file to JPEG...');
      const jpegBlob = await convertHeicToJpeg(file);
      const previewUrl = URL.createObjectURL(jpegBlob);
      console.log('HEIC conversion successful');
      
      return {
        previewUrl,
        originalUrl,
        isConverted: true,
      };
    } catch (error) {
      console.error('HEIC conversion failed:', error);
      return {
        previewUrl: originalUrl, // Fallback to original
        originalUrl,
        isConverted: false,
        conversionError: 'Could not convert HEIC file for preview. The file will still be analyzed.',
      };
    } finally {
      setIsConverting(false);
    }
  }, [isHeicFile]);

  return { convertFile, isConverting, isHeicFile };
}
