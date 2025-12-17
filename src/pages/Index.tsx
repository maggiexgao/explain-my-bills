import { useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { UploadPage } from '@/components/UploadPage';
import { AnalysisPage } from '@/components/AnalysisPage';
import { supabase } from '@/integrations/supabase/client';
import { AppState, UploadedFile, Language, AnalysisResult } from '@/types';
import { toast } from 'sonner';

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
      
      if (state.uploadedFile.file.type.startsWith('image/')) {
        // For images, convert to base64
        documentContent = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(state.uploadedFile!.file);
        });
      } else {
        // For PDFs, also convert to base64
        documentContent = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = btoa(
              new Uint8Array(reader.result as ArrayBuffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            resolve(`data:${state.uploadedFile!.file.type};base64,${base64}`);
          };
          reader.readAsArrayBuffer(state.uploadedFile!.file);
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
        charges: (aiAnalysis.lineItems || aiAnalysis.charges || []).map((item: any, index: number) => ({
          id: item.id || `item-${index + 1}`,
          description: item.description || 'Item',
          amount: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0,
          explanation: item.explanation || 'No additional details available.',
        })),
        medicalCodes: (aiAnalysis.medicalCodes || []).map((code: any) => ({
          code: code.code || 'Unknown',
          type: (code.type?.toUpperCase() || 'CPT') as 'CPT' | 'ICD' | 'HCPCS',
          description: code.description || 'Medical procedure code',
          typicalPurpose: code.typicalPurpose || code.description || 'Standard medical procedure',
          commonQuestions: code.commonQuestions || [],
        })),
        faqs: (aiAnalysis.faqs || []).map((faq: any) => ({
          question: faq.question || 'Question',
          answer: faq.answer || 'Answer not available.',
        })),
        possibleIssues: (aiAnalysis.potentialIssues || aiAnalysis.possibleIssues || []).map((issue: any) => ({
          issue: issue.title || issue.issue || 'Note',
          explanation: issue.description || issue.explanation || 'No details available.',
        })),
        financialAssistance: Array.isArray(aiAnalysis.financialAssistance) 
          ? aiAnalysis.financialAssistance 
          : [aiAnalysis.financialAssistance?.overview || 'Contact your healthcare provider for financial assistance options.'],
        patientRights: aiAnalysis.patientProtections || aiAnalysis.patientRights || [],
        actionPlan: (aiAnalysis.actionPlan || []).map((step: any, index: number) => ({
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
