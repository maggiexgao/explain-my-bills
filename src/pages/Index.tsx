import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PondIntroScreen } from '@/components/PondIntroScreen';
import { UploadPage } from '@/components/UploadPage';
import { AnalysisPage } from '@/components/AnalysisPage';
import { MedicalDocAnalysisPage } from '@/components/MedicalDocAnalysisPage';
import { ZoomProvider } from '@/contexts/ZoomContext';
import { UploadedFile, AnalysisResult, MedicalDocumentResult, Language, AnalysisMode, CptMedicareEvaluation } from '@/types';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { evaluateCptLinesAgainstMedicare, CptLineInput } from '@/lib/cptEvaluationEngine';

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

      // Build document content with data URI prefix for the edge function
      const mimeType = uploadedFile.file.type || 'application/octet-stream';
      const documentContent = `data:${mimeType};base64,${base64Content}`;
      
      // Build EOB content if provided
      const eobContent = eobFile && eobBase64 
        ? `data:${eobFile.file.type || 'application/octet-stream'};base64,${eobBase64}`
        : undefined;

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('analyze-document', {
        body: {
          documentContent: documentContent,
          documentType: analysisMode === 'medical_document' ? 'medical_document' : 'bill',
          eobContent: eobContent,
          state: selectedState,
          language: language,
          analysisMode: analysisMode,
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
          cptMedicareEvaluation: undefined, // Will be enriched below
          suggestedCpts: data.suggestedCpts,
        };
        
        // Enrich with Medicare evaluation if we have CPT codes
        if (result.cptCodes && result.cptCodes.length > 0 && selectedState) {
          try {
            const lineInputs: CptLineInput[] = result.cptCodes.map(cpt => ({
              cpt: cpt.code,
              description: cpt.explanation || cpt.shortLabel,
              // Try to get amounts from charges if available
              billedAmount: result.charges.find(c => 
                c.description?.includes(cpt.code) || c.description?.includes(cpt.shortLabel)
              )?.amount,
            }));
            
            const medicareEval = await evaluateCptLinesAgainstMedicare(
              2025,
              selectedState,
              null,
              lineInputs
            );
            
            // Convert to the type expected by the UI
            result.cptMedicareEvaluation = {
              lines: medicareEval.lines,
              byServiceType: medicareEval.byServiceType,
              overallSummary: medicareEval.overallSummary,
              state: selectedState,
              year: 2025,
            };
            
            console.log('Medicare evaluation added:', result.cptMedicareEvaluation.lines.length, 'lines');
          } catch (evalError) {
            console.warn('Medicare evaluation failed:', evalError);
            // Continue without Medicare data - it's optional
          }
        }
        
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
