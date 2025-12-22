import { useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { UploadPage } from '@/components/UploadPage';
import { AnalysisPage } from '@/components/AnalysisPage';
import { MedicalDocAnalysisPage } from '@/components/MedicalDocAnalysisPage';
import { WaterRippleEffect } from '@/components/WaterRippleEffect';
import { PondIntroScreen } from '@/components/PondIntroScreen';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { AppState, UploadedFile, Language, AnalysisResult, AnalysisMode, MedicalDocumentResult } from '@/types';
import { toast } from 'sonner';

// Helper to ensure value is always an array
const ensureArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'object') return Object.values(value);
  return [value];
};

const INTRO_SHOWN_KEY = 'pond_intro_shown';

const Index = () => {
  const [showIntro, setShowIntro] = useState(() => {
    // Only show intro if not already shown in this session
    return !sessionStorage.getItem(INTRO_SHOWN_KEY);
  });
  const [state, setState] = useState<AppState>({
    currentStep: 'upload',
    analysisMode: 'bill',
    uploadedFile: null,
    eobFile: null,
    selectedState: '',
    selectedLanguage: 'en',
    analysisResult: null,
    medicalDocResult: null,
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

  const handleEOBSelect = useCallback((file: UploadedFile) => {
    setState((prev) => ({ ...prev, eobFile: file }));
  }, []);

  const handleRemoveEOB = useCallback(() => {
    if (state.eobFile?.preview) {
      URL.revokeObjectURL(state.eobFile.preview);
    }
    setState((prev) => ({ ...prev, eobFile: null }));
  }, [state.eobFile]);

  const handleStateChange = useCallback((selectedState: string) => {
    setState((prev) => ({ ...prev, selectedState }));
  }, []);

  const handleLanguageChange = useCallback((selectedLanguage: Language) => {
    setState((prev) => ({ ...prev, selectedLanguage }));
  }, []);

  const handleModeChange = useCallback((analysisMode: AnalysisMode) => {
    setState((prev) => ({ ...prev, analysisMode }));
  }, []);

  const fileToBase64 = async (file: File): Promise<string> => {
    const fileName = file.name.toLowerCase();
    const isImage = file.type.startsWith('image/') || 
                    fileName.endsWith('.heic') || 
                    fileName.endsWith('.heif');
    const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');

    if (isImage) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          let result = reader.result as string;
          if (result.startsWith('data:;base64,') || result.startsWith('data:application/octet-stream;base64,')) {
            let mimeType = 'image/jpeg';
            if (fileName.endsWith('.heic') || fileName.endsWith('.heif')) mimeType = 'image/heic';
            else if (fileName.endsWith('.webp')) mimeType = 'image/webp';
            else if (fileName.endsWith('.png')) mimeType = 'image/png';
            result = result.replace(/^data:[^;]*;/, `data:${mimeType};`);
          }
          resolve(result);
        };
        reader.readAsDataURL(file);
      });
    } else if (isPdf) {
      return new Promise((resolve) => {
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
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!state.uploadedFile) return;
    
    setState((prev) => ({ ...prev, currentStep: 'analysis', isAnalyzing: true }));
    
    try {
      const documentContent = await fileToBase64(state.uploadedFile.file);
      let eobContent: string | undefined;
      if (state.eobFile && state.analysisMode === 'bill') {
        eobContent = await fileToBase64(state.eobFile.file);
      }
      
      const { data, error } = await supabase.functions.invoke('analyze-document', {
        body: {
          documentContent,
          documentType: state.uploadedFile.file.type,
          eobContent,
          state: state.selectedState,
          language: state.selectedLanguage,
          analysisMode: state.analysisMode,
        },
      });
      
      if (error) throw new Error(error.message || 'Failed to analyze document');
      if (data?.error) throw new Error(data.error);
      
      // Handle medical document analysis
      if (state.analysisMode === 'medical_document') {
        const ai = data.analysis;
        const medicalDocResult: MedicalDocumentResult = {
          documentType: ai.documentType || 'mixed_other',
          documentTypeLabel: ai.documentTypeLabel || 'Medical Document',
          overview: {
            summary: ai.overview?.summary || 'This document contains medical information.',
            mainPurpose: ai.overview?.mainPurpose || 'Provides medical details about your care.',
            overallAssessment: ai.overview?.overallAssessment || 'Please discuss any concerns with your healthcare provider.',
          },
          lineByLine: ensureArray(ai.lineByLine).map((item: any) => ({
            originalText: item.originalText || '',
            plainLanguage: item.plainLanguage || '',
          })),
          definitions: ensureArray(ai.definitions).map((def: any) => ({
            term: def.term || '',
            definition: def.definition || '',
          })),
          commonlyAskedQuestions: ensureArray(ai.commonlyAskedQuestions).map((qa: any) => ({
            question: qa.question || '',
            answer: qa.answer || '',
          })),
          providerQuestions: ensureArray(ai.providerQuestions).map((q: any) => ({
            question: q.question || '',
            questionEnglish: q.questionEnglish,
          })),
          resources: ensureArray(ai.resources).map((r: any) => ({
            title: r.title || '',
            description: r.description || '',
            url: r.url || '#',
            source: r.source || 'Medical resource',
          })),
          nextSteps: ensureArray(ai.nextSteps).map((s: any) => ({
            step: s.step || '',
            details: s.details || '',
          })),
        };
        setState((prev) => ({ ...prev, isAnalyzing: false, medicalDocResult }));
        return;
      }
      
      // Handle bill analysis (existing logic)
      const ai = data.analysis;
      const analysisResult: AnalysisResult = {
        documentType: ai.documentType?.toLowerCase() as any || 'unknown',
        issuer: ai.issuer || 'Unknown Provider',
        dateOfService: ai.dateOfService || 'Not specified',
        documentPurpose: ai.documentPurpose || 'Medical billing document',
        charges: ensureArray(ai.lineItems || ai.charges).map((item: any, idx: number) => ({
          id: item.id || `item-${idx + 1}`,
          description: item.description || 'Item',
          amount: typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount).replace(/[^0-9.-]/g, '')) || 0,
          explanation: item.explanation || '',
        })),
        medicalCodes: ensureArray(ai.medicalCodes).map((code: any) => ({
          code: code.code || 'Unknown',
          type: (code.type?.toUpperCase() || 'CPT') as 'CPT' | 'ICD' | 'HCPCS',
          description: code.description || '',
          typicalPurpose: code.typicalPurpose || '',
          commonQuestions: ensureArray(code.commonQuestions),
        })),
        faqs: ensureArray(ai.faqs).map((faq: any) => ({ question: faq.question || '', answer: faq.answer || '' })),
        possibleIssues: ensureArray(ai.potentialIssues || ai.possibleIssues).map((i: any) => ({ issue: i.title || i.issue || '', explanation: i.description || i.explanation || '' })),
        financialAssistance: ensureArray(ai.financialAssistance),
        patientRights: ensureArray(ai.patientProtections || ai.patientRights),
        actionPlan: ensureArray(ai.actionPlan).map((s: any, idx: number) => ({ step: s.step || idx + 1, action: s.action || '', description: s.details || s.description || '' })),
        
        // New 4-section fields
        potentialErrors: ensureArray(ai.potentialErrors).map((i: any) => ({
          type: i.type || 'potential_error',
          title: i.title || '',
          description: i.description || '',
          suggestedQuestion: i.suggestedQuestion || '',
          severity: i.severity || 'error',
          relatedCodes: ensureArray(i.relatedCodes),
          relatedAmounts: i.relatedAmounts,
        })),
        needsAttention: ensureArray(ai.needsAttention).map((i: any) => ({
          type: i.type || 'needs_attention',
          title: i.title || '',
          description: i.description || '',
          suggestedQuestion: i.suggestedQuestion || '',
          severity: i.severity || 'warning',
          relatedCodes: ensureArray(i.relatedCodes),
          relatedAmounts: i.relatedAmounts,
        })),
        
        cptCodes: ensureArray(ai.cptCodes).map((c: any) => ({
          code: c.code || '',
          shortLabel: c.shortLabel || c.description || '',
          explanation: c.explanation || '',
          category: c.category || 'other',
          whereUsed: c.whereUsed || '',
          complexityLevel: c.complexityLevel || 'moderate',
          commonQuestions: ensureArray(c.commonQuestions).map((q: any) => ({ question: q.question || '', answer: q.answer || '', callWho: q.callWho || 'either' })),
        })),
        visitWalkthrough: ensureArray(ai.visitWalkthrough).map((s: any, idx: number) => ({
          order: s.order || idx + 1,
          description: s.description || '',
          relatedCodes: ensureArray(s.relatedCodes),
        })),
        codeQuestions: ensureArray(ai.codeQuestions).map((q: any) => ({
          cptCode: q.cptCode || '',
          question: q.question || '',
          answer: q.answer || '',
          suggestCall: q.suggestCall || 'either',
        })),
        billingEducation: ai.billingEducation || {
          billedVsAllowed: 'The "billed amount" is what the provider charges. The "allowed amount" is the maximum your insurance will pay.',
          deductibleExplanation: 'Your deductible is the amount you pay before insurance starts covering costs.',
          copayCoinsurance: 'A copay is a fixed amount you pay per visit. Coinsurance is a percentage of the allowed amount.',
          eobSummary: state.eobFile ? ai.billingEducation?.eobSummary : undefined,
        },
        stateHelp: ai.stateHelp || {
          state: state.selectedState,
          medicaidInfo: { description: 'Medicaid provides health coverage for eligible low-income individuals.', eligibilityLink: 'https://www.medicaid.gov/' },
          debtProtections: [],
          reliefPrograms: [],
        },
        providerAssistance: ai.providerAssistance || {
          providerName: ai.issuer || 'Provider',
          providerType: 'hospital',
          charityCareSummary: 'Many hospitals offer financial assistance programs for patients who cannot afford their bills.',
          eligibilityNotes: 'Eligibility typically depends on income and family size.',
        },
        debtAndCreditInfo: ensureArray(ai.debtAndCreditInfo),
        financialOpportunities: ensureArray(ai.financialOpportunities).map((o: any) => ({
          title: o.title || '',
          description: o.description || '',
          eligibilityHint: o.eligibilityHint || '',
          effortLevel: o.effortLevel || 'short_form',
          link: o.link,
        })),
        providerContactInfo: ai.providerContactInfo || {
          providerName: ai.issuer || 'Provider',
          billingPhone: ai.providerContactInfo?.billingPhone,
          billingEmail: ai.providerContactInfo?.billingEmail,
          mailingAddress: ai.providerContactInfo?.mailingAddress,
          insurerName: ai.providerContactInfo?.insurerName,
          memberServicesPhone: ai.providerContactInfo?.memberServicesPhone,
          memberServicesEmail: ai.providerContactInfo?.memberServicesEmail,
        },
        actionSteps: ensureArray(ai.actionSteps).map((s: any, idx: number) => ({
          order: s.order || idx + 1,
          action: s.action || '',
          details: s.details || '',
          relatedIssue: s.relatedIssue,
        })),
        billingTemplates: ensureArray(ai.billingTemplates).map((t: any) => ({
          target: 'billing',
          purpose: t.purpose || '',
          template: t.template || '',
          templateEnglish: t.templateEnglish,
          whenToUse: t.whenToUse || '',
          contactInfo: t.contactInfo,
          filledData: t.filledData,
        })),
        insuranceTemplates: ensureArray(ai.insuranceTemplates).map((t: any) => ({
          target: 'insurance',
          purpose: t.purpose || '',
          template: t.template || '',
          templateEnglish: t.templateEnglish,
          whenToUse: t.whenToUse || '',
          contactInfo: t.contactInfo,
          filledData: t.filledData,
        })),
        whenToSeekHelp: ensureArray(ai.whenToSeekHelp),
        billingIssues: ensureArray(ai.billingIssues).map((i: any) => ({
          type: i.type || 'mismatch',
          title: i.title || '',
          description: i.description || '',
          suggestedQuestion: i.suggestedQuestion || '',
          severity: i.severity || 'info',
          relatedCodes: ensureArray(i.relatedCodes),
        })),
        eobData: state.eobFile && ai.eobData ? {
          claimNumber: ai.eobData.claimNumber,
          processedDate: ai.eobData.processedDate,
          billedAmount: ai.eobData.billedAmount || 0,
          allowedAmount: ai.eobData.allowedAmount || 0,
          insurancePaid: ai.eobData.insurancePaid || 0,
          patientResponsibility: ai.eobData.patientResponsibility || 0,
          deductibleApplied: ai.eobData.deductibleApplied || 0,
          coinsurance: ai.eobData.coinsurance || 0,
          copay: ai.eobData.copay || 0,
          discrepancies: ensureArray(ai.eobData.discrepancies),
        } : undefined,
      };
      
      setState((prev) => ({ ...prev, isAnalyzing: false, analysisResult }));
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze document.');
      setState((prev) => ({ ...prev, isAnalyzing: false, currentStep: 'upload' }));
    }
  }, [state.uploadedFile, state.eobFile, state.selectedState, state.selectedLanguage, state.analysisMode]);

  const handleBack = useCallback(() => {
    setState((prev) => ({ ...prev, currentStep: 'upload', analysisResult: null, medicalDocResult: null, isAnalyzing: false }));
  }, []);

  const handleIntroComplete = useCallback(() => {
    sessionStorage.setItem(INTRO_SHOWN_KEY, 'true');
    setShowIntro(false);
  }, []);

  // Wrap everything in LanguageProvider to avoid context errors
  return (
    <LanguageProvider language={state.selectedLanguage} setLanguage={handleLanguageChange}>
      {showIntro ? (
        <PondIntroScreen onComplete={handleIntroComplete} />
      ) : (
        <div className="min-h-screen flex flex-col relative">
          {/* Pond Background */}
          <div className="pond-bg" />
          <WaterRippleEffect />
          
          <Header />
          <main className="flex-1 relative z-10">
            {state.currentStep === 'upload' ? (
              <UploadPage
                uploadedFile={state.uploadedFile}
                eobFile={state.eobFile}
                selectedState={state.selectedState}
                selectedLanguage={state.selectedLanguage}
                analysisMode={state.analysisMode}
                onFileSelect={handleFileSelect}
                onRemoveFile={handleRemoveFile}
                onEOBSelect={handleEOBSelect}
                onRemoveEOB={handleRemoveEOB}
                onStateChange={handleStateChange}
                onLanguageChange={handleLanguageChange}
                onModeChange={handleModeChange}
                onAnalyze={handleAnalyze}
              />
            ) : (
              state.uploadedFile && (
                state.analysisMode === 'medical_document' ? (
                  <MedicalDocAnalysisPage
                    file={state.uploadedFile}
                    analysis={state.medicalDocResult}
                    isAnalyzing={state.isAnalyzing}
                    onBack={handleBack}
                  />
                ) : (
                  <AnalysisPage
                    file={state.uploadedFile}
                    analysis={state.analysisResult}
                    isAnalyzing={state.isAnalyzing}
                    onBack={handleBack}
                    hasEOB={!!state.eobFile}
                  />
                )
              )
            )}
          </main>
          <Footer />
        </div>
      )}
    </LanguageProvider>
  );

};

export default Index;
