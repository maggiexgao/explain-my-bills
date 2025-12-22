import { FileUploader } from '@/components/FileUploader';
import { EOBUploader } from '@/components/EOBUploader';
import { ModeToggle } from '@/components/ModeToggle';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, MapPin, Lock, FileSearch, Shield, Globe, BookOpen, MessageSquare, HelpCircle, AlertCircle } from 'lucide-react';
import { UploadedFile, US_STATES, Language, LANGUAGES, AnalysisMode } from '@/types';
import { useTranslation } from '@/i18n/LanguageContext';

interface UploadPageProps {
  uploadedFile: UploadedFile | null;
  eobFile: UploadedFile | null;
  selectedState: string;
  selectedLanguage: Language;
  analysisMode: AnalysisMode;
  onFileSelect: (file: UploadedFile) => void;
  onRemoveFile: () => void;
  onEOBSelect: (file: UploadedFile) => void;
  onRemoveEOB: () => void;
  onStateChange: (state: string) => void;
  onLanguageChange: (language: Language) => void;
  onModeChange: (mode: AnalysisMode) => void;
  onAnalyze: () => void;
}

export function UploadPage({
  uploadedFile,
  eobFile,
  selectedState,
  selectedLanguage,
  analysisMode,
  onFileSelect,
  onRemoveFile,
  onEOBSelect,
  onRemoveEOB,
  onStateChange,
  onLanguageChange,
  onModeChange,
  onAnalyze,
}: UploadPageProps) {
  const { t } = useTranslation();
  const canAnalyze = uploadedFile && selectedState;
  const isMedicalDoc = analysisMode === 'medical_document';

  // Mode-specific content
  const content = {
    bill: {
      subtitle: 'Medical bills, decoded.',
      step1: 'Share your medical bill or EOB',
      step2: 'AI decodes your document',
      step3: 'Get clear explanations and next steps',
      features: [
        { icon: FileSearch, label: 'Line-by-line breakdown', color: 'text-coral' },
        { icon: Shield, label: 'State protections', color: 'text-purple' },
        { icon: Lock, label: 'Private & secure', color: 'text-mint' },
      ],
      buttonText: t('upload.analyze'),
    },
    medical_document: {
      subtitle: 'Medical documents, explained.',
      step1: 'Upload your medical document',
      step2: 'AI decodes your medical information',
      step3: 'Get clear explanations for your health information',
      features: [
        { icon: BookOpen, label: 'Line-by-line explanation', color: 'text-coral' },
        { icon: HelpCircle, label: 'Key terms defined', color: 'text-purple' },
        { icon: MessageSquare, label: 'Questions for your provider', color: 'text-mint' },
        { icon: Lock, label: 'Private & secure', color: 'text-blush' },
      ],
      buttonText: 'Analyze Document',
    },
  };

  const currentContent = content[analysisMode];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground/95 mb-3 tracking-tight">
            {t('app.title')}
          </h1>
          <p className="text-lg text-muted-foreground font-light">
            {currentContent.subtitle}
          </p>
        </div>

        <div className="glass-card-strong p-6 md:p-8 space-y-6 animate-slide-up">
          {/* Mode Toggle */}
          <ModeToggle mode={analysisMode} onModeChange={onModeChange} />

          {/* Medical Document helper text */}
          {isMedicalDoc && (
            <div className="text-center text-sm text-muted-foreground px-2">
              <p>Upload visit summaries, test results, imaging reports, prescriptions, or other medical paperwork. Rosetta will explain them in plain language.</p>
            </div>
          )}

          <div className="space-y-4">
            <FileUploader
              uploadedFile={uploadedFile}
              onFileSelect={onFileSelect}
              onRemoveFile={onRemoveFile}
              mode={analysisMode}
            />
            
            {/* Supported documents list for Medical Document mode */}
            {isMedicalDoc && !uploadedFile && (
              <div className="text-xs text-muted-foreground bg-background/40 rounded-lg p-3 space-y-2">
                <p className="font-medium text-foreground/80">Supported documents include:</p>
                <ul className="space-y-1 ml-2">
                  <li>• After-visit summaries (e.g., MyChart)</li>
                  <li>• Lab and blood test results</li>
                  <li>• Imaging reports (X-ray, CT, MRI, ultrasound)</li>
                  <li>• Clinic or hospital visit notes</li>
                  <li>• Prescription or medication instructions</li>
                  <li>• Other documents with diagnoses, tests, or observations</li>
                </ul>
                <p className="text-muted-foreground/70 mt-2">Formats: PDF, JPG, JPEG, PNG, HEIC</p>
              </div>
            )}

            {/* EOB uploader only for bill mode */}
            {!isMedicalDoc && (
              <EOBUploader
                uploadedFile={eobFile}
                onFileSelect={onEOBSelect}
                onRemoveFile={onRemoveEOB}
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                <MapPin className="h-4 w-4 text-purple" />
                {t('upload.state.label')}
              </label>
              <Select value={selectedState} onValueChange={onStateChange}>
                <SelectTrigger className="w-full h-12 bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder={t('upload.state.placeholder')} />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] bg-popover/95 backdrop-blur-md z-50">
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                <Globe className="h-4 w-4 text-coral" />
                {t('upload.language.label')}
              </label>
              <Select value={selectedLanguage} onValueChange={(v) => onLanguageChange(v as Language)}>
                <SelectTrigger className="w-full h-12 bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder={t('upload.language.label')} />
                </SelectTrigger>
                <SelectContent className="bg-popover/95 backdrop-blur-md z-50">
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      <span className="flex items-center gap-2">
                        <span>{lang.nativeLabel}</span>
                        {lang.value !== 'en' && (
                          <span className="text-muted-foreground text-xs">({lang.label})</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            size="lg"
            className={`w-full h-14 text-base font-semibold rounded-xl transition-all duration-300 ${
              canAnalyze 
                ? 'accent-gradient text-primary-foreground shadow-glow hover:shadow-glow-active animate-glow-pulse' 
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
            disabled={!canAnalyze}
            onClick={onAnalyze}
          >
            {currentContent.buttonText}
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>

          {/* Medical Document disclaimer */}
          {isMedicalDoc && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-background/30 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-warning" />
              <p>Rosetta will not diagnose or treat conditions, but will explain what this document says in everyday language so you can have a better conversation with your clinician.</p>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-coral/20 border border-coral/30">
                <span className="text-coral font-bold text-sm">1</span>
              </div>
              <p className="text-sm text-foreground/70">{currentContent.step1}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple/20 border border-purple/30">
                <span className="text-purple font-bold text-sm">2</span>
              </div>
              <p className="text-sm text-foreground/70">{currentContent.step2}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mint/20 border border-mint/30">
                <span className="text-mint font-bold text-sm">3</span>
              </div>
              <p className="text-sm text-foreground/70">{currentContent.step3}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            {currentContent.features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-sm">
                  <Icon className={`h-4 w-4 ${feature.color}`} />
                  <span className="text-foreground/70">{feature.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
