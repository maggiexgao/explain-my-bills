import { useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { UploadPage } from '@/components/UploadPage';
import { AnalysisPage } from '@/components/AnalysisPage';
import { mockAnalysisResult } from '@/data/mockAnalysis';
import { AppState, UploadedFile, Language, AnalysisResult } from '@/types';

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

  const handleAnalyze = useCallback(() => {
    setState((prev) => ({ ...prev, currentStep: 'analysis', isAnalyzing: true }));
    
    // Simulate analysis delay
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        isAnalyzing: false,
        analysisResult: mockAnalysisResult,
      }));
    }, 2500);
  }, []);

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
