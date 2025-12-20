import { useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { UploadPage } from '@/components/UploadPage';
import { AnalysisPage } from '@/components/AnalysisPage';
import { supabase } from '@/integrations/supabase/client';
import { AppState, UploadedFile, Language, AnalysisResult } from '@/types';
import { toast } from 'sonner';

// Helper to ensure value is always an array
const ensureArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'object') return Object.values(value);
  return [value];
};

const Index = () => {
  const [state, setState] = useState<AppState>({
    currentStep: 'upload',
    uploadedFile: null,
    selectedState: '',
    selectedLanguage: 'en',
    analysisResult: null,
    isAnalyzing: false,
    activeHighlight: null,
  });

  const handleFileSelect = useCallback((file: UploadedFile) => {
    setState((prev) => ({ ...prev, uploadedFile: file }));
  }, []);

  const handleRemoveFile = useCallback(() => {
    if (state.uploadedFile?.preview) {
      URL.revokeObjectURL(state.uploadedFile.preview);
    }
    setState((prev) => ({ ...prev, uploadedFile: null }));
  }, [state.uploadedFile]);

  const handleStateChange = useCallback((selectedState: string) => {
    setState((prev) => ({ ...prev, selectedState }));
  }, []);

  const handleLanguageChange = useCallback((selectedLanguage: Language) => {
    setState((prev) => ({ ...prev, selectedLanguage }));
  }, []);

  const extractTextFromFile = async (file: File): Promise<string> => {
    // For images, we'll convert to base64 and let the AI analyze visually
    if (file.type.startsWith('image/')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(`[IMAGE DATA]\nBase64 encoded image: ${base64}`);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    
    // For PDFs and other files, extract text
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        // For PDF, we'll send as base64 since we can't parse it client-side
        if (file.type === 'application/pdf') {
          const base64 = btoa(text);
          resolve(`[PDF DOCUMENT]\nBase64 encoded PDF content. Please analyze this medical document.`);
        } else {
          resolve(text);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleAnalyze = useCallback(async () => {
    if (!state.uploadedFile) return;
    
    setState((prev) => ({ ...prev, currentStep: 'analysis', isAnalyzing: true }));
    
    try {
      // Extract file content
      let documentContent: string;
      const file = state.uploadedFile.file;
      const fileName = file.name.toLowerCase();
      
      // Determine if this is an image (check MIME type and extension for HEIC)
      const isImage = file.type.startsWith('image/') || 
                      fileName.endsWith('.heic') || 
                      fileName.endsWith('.heif') ||
                      fileName.endsWith('.webp') ||
                      fileName.endsWith('.tiff') ||
                      fileName.endsWith('.tif') ||
                      fileName.endsWith('.bmp') ||
                      fileName.endsWith('.gif');
      
      const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');
      
      if (isImage) {
        // For images, convert to base64 with proper MIME type detection
        documentContent = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            let result = reader.result as string;
            // If MIME type is missing or empty, try to detect from extension
            if (result.startsWith('data:;base64,') || result.startsWith('data:application/octet-stream;base64,')) {
              let mimeType = 'image/jpeg'; // default
              if (fileName.endsWith('.heic') || fileName.endsWith('.heif')) mimeType = 'image/heic';
              else if (fileName.endsWith('.webp')) mimeType = 'image/webp';
              else if (fileName.endsWith('.png')) mimeType = 'image/png';
              else if (fileName.endsWith('.gif')) mimeType = 'image/gif';
              else if (fileName.endsWith('.tiff') || fileName.endsWith('.tif')) mimeType = 'image/tiff';
              else if (fileName.endsWith('.bmp')) mimeType = 'image/bmp';
              result = result.replace(/^data:[^;]*;/, `data:${mimeType};`);
            }
            resolve(result);
          };
          reader.readAsDataURL(file);
        });
      } else if (isPdf) {
        // For PDFs, convert to base64
        documentContent = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = btoa(
              new Uint8Array(reader.result as ArrayBuffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            resolve(`data:application/pdf;base64,${base64}`);
          };
          reader.readAsArrayBuffer(file);
        });
      } else {
        // For other files, read as data URL
        documentContent = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }
      
      // Call the edge function
      const { data, error } = await supabase.functions.invoke('analyze-document', {
        body: {
          documentContent,
          documentType: state.uploadedFile.file.type,
          state: state.selectedState,
          language: state.selectedLanguage,
        },
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to analyze document');
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      // Transform the AI response to match our AnalysisResult type
      const aiAnalysis = data.analysis;
      const analysisResult: AnalysisResult = {
        documentType: aiAnalysis.documentType?.toLowerCase() as any || 'unknown',
        issuer: aiAnalysis.issuer || 'Unknown Provider',
        dateOfService: aiAnalysis.dateOfService || 'Not specified',
        documentPurpose: aiAnalysis.documentPurpose || 'This document contains medical billing or healthcare information.',
        charges: ensureArray(aiAnalysis.lineItems || aiAnalysis.charges).map((item: any, index: number) => ({
          id: item.id || `item-${index + 1}`,
          description: item.description || 'Item',
          amount: typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount).replace(/[^0-9.-]/g, '')) || 0,
          explanation: item.explanation || 'No additional details available.',
        })),
        medicalCodes: ensureArray(aiAnalysis.medicalCodes).map((code: any) => ({
          code: code.code || 'Unknown',
          type: (code.type?.toUpperCase() || 'CPT') as 'CPT' | 'ICD' | 'HCPCS',
          description: code.description || 'Medical procedure code',
          typicalPurpose: code.typicalPurpose || code.description || 'Standard medical procedure',
          commonQuestions: ensureArray(code.commonQuestions),
        })),
        faqs: ensureArray(aiAnalysis.faqs).map((faq: any) => ({
          question: faq.question || 'Question',
          answer: faq.answer || 'Answer not available.',
        })),
        possibleIssues: ensureArray(aiAnalysis.potentialIssues || aiAnalysis.possibleIssues).map((issue: any) => ({
          issue: issue.title || issue.issue || 'Note',
          explanation: issue.description || issue.explanation || 'No details available.',
        })),
        financialAssistance: ensureArray(aiAnalysis.financialAssistance),
        patientRights: ensureArray(aiAnalysis.patientProtections || aiAnalysis.patientRights),
        actionPlan: ensureArray(aiAnalysis.actionPlan).map((step: any, index: number) => ({
          step: step.step || index + 1,
          action: step.action || 'Review your options',
          description: step.details || step.description || 'Consider your next steps carefully.',
        })),
      };
      
      setState((prev) => ({
        ...prev,
        isAnalyzing: false,
        analysisResult,
      }));
      
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze document. Please try again.');
      setState((prev) => ({
        ...prev,
        isAnalyzing: false,
        currentStep: 'upload',
      }));
    }
  }, [state.uploadedFile, state.selectedState, state.selectedLanguage]);

  const handleBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: 'upload',
      analysisResult: null,
      isAnalyzing: false,
    }));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        selectedLanguage={state.selectedLanguage}
        onLanguageChange={handleLanguageChange}
        showLanguageSelector={state.currentStep === 'analysis'}
      />

      <main className="flex-1">
        {state.currentStep === 'upload' ? (
          <UploadPage
            uploadedFile={state.uploadedFile}
            selectedState={state.selectedState}
            onFileSelect={handleFileSelect}
            onRemoveFile={handleRemoveFile}
            onStateChange={handleStateChange}
            onAnalyze={handleAnalyze}
          />
        ) : (
          state.uploadedFile && (
            <AnalysisPage
              file={state.uploadedFile}
              analysis={state.analysisResult}
              isAnalyzing={state.isAnalyzing}
              onBack={handleBack}
            />
          )
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Index;
