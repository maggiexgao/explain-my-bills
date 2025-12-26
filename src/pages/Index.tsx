import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PondIntroScreen } from '@/components/PondIntroScreen';
import { UploadPage } from '@/components/UploadPage';
import { AnalysisPage } from '@/components/AnalysisPage';
import { MedicalDocAnalysisPage } from '@/components/MedicalDocAnalysisPage';
import { ZoomProvider } from '@/contexts/ZoomContext';
import { UploadedFile, AnalysisResult, MedicalDocumentResult, Language, AnalysisMode } from '@/types';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

// Helper to ensure a value is an array
function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value === null || value === undefined) return [];
  return [];
}

export default function Index() {
  const { toast } = useToast();
  const { language, setLanguage } = useLanguage();
  
  // State
  const [showIntro, setShowIntro] = useState(() => {
    // Check if user has seen intro before
    const hasSeenIntro = localStorage.getItem('pond_intro_seen');
    return !hasSeenIntro;
  });
  const [currentStep, setCurrentStep] = useState<'upload' | 'analysis'>('upload');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('bill');
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [eobFile, setEobFile] = useState<UploadedFile | null>(null);
  const [selectedState, setSelectedState] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [medicalDocResult, setMedicalDocResult] = useState<MedicalDocumentResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Mark intro as seen
  const handleIntroComplete = () => {
    localStorage.setItem('pond_intro_seen', 'true');
    setShowIntro(false);
  };

  // Handle file selection
  const handleFileSelect = (file: UploadedFile) => {
    setUploadedFile(file);
    setAnalysisResult(null);
    setMedicalDocResult(null);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setAnalysisResult(null);
    setMedicalDocResult(null);
  };

  const handleEOBSelect = (file: UploadedFile) => {
    setEobFile(file);
  };

  const handleRemoveEOB = () => {
    setEobFile(null);
  };

  const handleModeChange = (mode: AnalysisMode) => {
    setAnalysisMode(mode);
    // Clear results when mode changes
    setAnalysisResult(null);
    setMedicalDocResult(null);
  };

  const handleBack = () => {
    setCurrentStep('upload');
    setAnalysisResult(null);
    setMedicalDocResult(null);
    setUploadedFile(null);
    setEobFile(null);
  };

  // Convert file to base64
  const fileToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove the data:mime;base64, prefix
        const base64Content = base64.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = reject;
    });
  };

  // Analyze the document
  const handleAnalyze = async () => {
    if (!uploadedFile || !selectedState) return;

    setIsAnalyzing(true);
    setCurrentStep('analysis');

    try {
      // Convert file to base64
      const base64Content = await fileToBase64(uploadedFile.file);
      const eobBase64 = eobFile ? await fileToBase64(eobFile.file) : undefined;

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('analyze-document', {
        body: {
          file: base64Content,
          fileName: uploadedFile.file.name,
          fileType: uploadedFile.file.type,
          eobFile: eobBase64,
          eobFileName: eobFile?.file.name,
          eobFileType: eobFile?.file.type,
          state: selectedState,
          language: language,
          mode: analysisMode,
        },
      });

      if (error) {
        throw error;
      }

      if (analysisMode === 'medical_document') {
        // Transform and set medical document result
        const result: MedicalDocumentResult = {
          documentType: data.documentType || 'mixed_other',
          documentTypeLabel: data.documentTypeLabel || 'Medical Document',
          overview: data.overview || { summary: '', mainPurpose: '', overallAssessment: '' },
          lineByLine: ensureArray(data.lineByLine),
          definitions: ensureArray(data.definitions),
          commonlyAskedQuestions: ensureArray(data.commonlyAskedQuestions),
          providerQuestions: ensureArray(data.providerQuestions),
          resources: ensureArray(data.resources),
          nextSteps: ensureArray(data.nextSteps),
        };
        setMedicalDocResult(result);
      } else {
        // Transform and set bill analysis result
        const result: AnalysisResult = {
          documentType: data.documentType || 'bill',
          issuer: data.issuer || '',
          dateOfService: data.dateOfService || '',
          documentPurpose: data.documentPurpose || '',
          charges: ensureArray(data.charges),
          medicalCodes: ensureArray(data.medicalCodes),
          faqs: ensureArray(data.faqs),
          possibleIssues: ensureArray(data.possibleIssues),
          financialAssistance: ensureArray(data.financialAssistance),
          patientRights: ensureArray(data.patientRights),
          actionPlan: ensureArray(data.actionPlan),
          potentialErrors: ensureArray(data.potentialErrors),
          needsAttention: ensureArray(data.needsAttention),
          cptCodes: ensureArray(data.cptCodes),
          visitWalkthrough: ensureArray(data.visitWalkthrough),
          codeQuestions: ensureArray(data.codeQuestions),
          billingEducation: data.billingEducation || {
            billedVsAllowed: '',
            deductibleExplanation: '',
            copayCoinsurance: '',
          },
          stateHelp: data.stateHelp || {
            state: selectedState,
            medicaidInfo: { description: '', eligibilityLink: '' },
            debtProtections: [],
            reliefPrograms: [],
          },
          providerAssistance: data.providerAssistance || {
            providerName: '',
            providerType: 'hospital',
            charityCareSummary: '',
            eligibilityNotes: '',
          },
          debtAndCreditInfo: ensureArray(data.debtAndCreditInfo),
          financialOpportunities: ensureArray(data.financialOpportunities),
          providerContactInfo: data.providerContactInfo || {
            providerName: '',
          },
          actionSteps: ensureArray(data.actionSteps),
          billingTemplates: ensureArray(data.billingTemplates),
          insuranceTemplates: ensureArray(data.insuranceTemplates),
          whenToSeekHelp: ensureArray(data.whenToSeekHelp),
          billingIssues: ensureArray(data.billingIssues),
          eobData: data.eobData,
          billTotal: data.billTotal,
          disputePackageEligibility: data.disputePackageEligibility,
          referralContext: data.referralContext,
        };
        setAnalysisResult(result);
      }
    } catch (err) {
      console.error('Analysis error:', err);
      toast({
        title: 'Analysis Failed',
        description: 'There was an error analyzing your document. Please try again.',
        variant: 'destructive',
      });
      setCurrentStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Show intro screen if user hasn't seen it
  if (showIntro) {
    return <PondIntroScreen onComplete={handleIntroComplete} />;
  }

  return (
    <ZoomProvider>
      <div className="min-h-screen flex flex-col bg-background pond-water-bg">
        <Header />
        
        <main className="flex-1 flex flex-col">
          {currentStep === 'upload' ? (
            <UploadPage
              uploadedFile={uploadedFile}
              eobFile={eobFile}
              selectedState={selectedState}
              selectedLanguage={language}
              analysisMode={analysisMode}
              onFileSelect={handleFileSelect}
              onRemoveFile={handleRemoveFile}
              onEOBSelect={handleEOBSelect}
              onRemoveEOB={handleRemoveEOB}
              onStateChange={setSelectedState}
              onLanguageChange={setLanguage}
              onModeChange={handleModeChange}
              onAnalyze={handleAnalyze}
            />
          ) : analysisMode === 'medical_document' ? (
            <MedicalDocAnalysisPage
              file={uploadedFile!}
              analysis={medicalDocResult}
              isAnalyzing={isAnalyzing}
              onBack={handleBack}
            />
          ) : (
            <AnalysisPage
              file={uploadedFile!}
              analysis={analysisResult}
              isAnalyzing={isAnalyzing}
              onBack={handleBack}
              hasEOB={!!eobFile}
            />
          )}
        </main>

        <Footer />
      </div>
    </ZoomProvider>
  );
}
