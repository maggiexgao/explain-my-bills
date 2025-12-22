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
      subtitle: 'Understand your medical bills and what you may owe.',
      step1: 'upload',
      step2: 'pond decodes',
      step3: 'you take the next step',
      features: [
        { icon: FileSearch, label: 'Line-by-line', color: 'text-coral' },
        { icon: Shield, label: 'State protections', color: 'text-purple' },
        { icon: Lock, label: 'Private', color: 'text-mint' },
      ],
      buttonText: t('upload.analyze'),
    },
    medical_document: {
      subtitle: 'Understand your visit notes, test results, and paperwork.',
      step1: 'upload',
      step2: 'pond decodes',
      step3: 'you take the next step',
      features: [
        { icon: BookOpen, label: 'Plain language', color: 'text-coral' },
        { icon: HelpCircle, label: 'Terms defined', color: 'text-purple' },
        { icon: MessageSquare, label: 'Provider questions', color: 'text-mint' },
      ],
      buttonText: 'Analyze Document',
    },
  };

  const currentContent = content[analysisMode];

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col items-center justify-center px-4 py-2">
      <div className="w-full max-w-md animate-fade-in">
        {/* Compact header */}
        <div className="text-center mb-4">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground/95 mb-1 tracking-tight">
            {t('app.title')}
          </h1>
          <p className="text-sm text-muted-foreground font-light">
            be your own best advocate.
          </p>
        </div>

        <div className="glass-card-strong p-4 md:p-5 space-y-3 animate-slide-up">
          {/* Mode Toggle with inline subtitle */}
          <div className="space-y-1.5">
            <ModeToggle mode={analysisMode} onModeChange={onModeChange} />
            <p className="text-xs text-center text-muted-foreground/80">
              {currentContent.subtitle}
            </p>
          </div>

          {/* File uploaders */}
          <div className="space-y-2">
            <FileUploader
              uploadedFile={uploadedFile}
              onFileSelect={onFileSelect}
              onRemoveFile={onRemoveFile}
              mode={analysisMode}
            />
            
            {/* Compact supported docs for Medical Document mode */}
            {isMedicalDoc && !uploadedFile && (
              <p className="text-[10px] text-muted-foreground/70 text-center">
                Visit summaries, lab results, imaging reports, prescriptions, clinic notes
              </p>
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

          {/* State and Language selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                <MapPin className="h-3 w-3 text-purple" />
                {t('upload.state.label')}
              </label>
              <Select value={selectedState} onValueChange={onStateChange}>
                <SelectTrigger className="w-full h-10 text-sm bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder={t('upload.state.placeholder')} />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] bg-popover/95 backdrop-blur-md z-50">
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value} className="text-sm">
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                <Globe className="h-3 w-3 text-coral" />
                {t('upload.language.label')}
              </label>
              <Select value={selectedLanguage} onValueChange={(v) => onLanguageChange(v as Language)}>
                <SelectTrigger className="w-full h-10 text-sm bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder={t('upload.language.label')} />
                </SelectTrigger>
                <SelectContent className="bg-popover/95 backdrop-blur-md z-50">
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value} className="text-sm">
                      <span className="flex items-center gap-1.5">
                        <span>{lang.nativeLabel}</span>
                        {lang.value !== 'en' && (
                          <span className="text-muted-foreground text-[10px]">({lang.label})</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Analyze button with ripple on hover */}
          <Button
            size="lg"
            className={`w-full h-12 text-sm font-semibold rounded-xl transition-all duration-300 relative overflow-hidden group ${
              canAnalyze 
                ? 'accent-gradient text-primary-foreground shadow-glow hover:shadow-glow-active' 
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
            disabled={!canAnalyze}
            onClick={onAnalyze}
          >
            {/* Ripple effect on hover */}
            {canAnalyze && (
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 rounded-full bg-white/20 group-hover:w-full group-hover:h-full group-hover:scale-150 transition-all duration-500" />
              </span>
            )}
            <span className="relative z-10 flex items-center gap-2">
              {currentContent.buttonText}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Button>

          {/* Medical Document disclaimer - compact */}
          {isMedicalDoc && (
            <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground/80 bg-background/20 rounded-lg px-2 py-1.5">
              <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5 text-warning" />
              <p>pond explains documents in everyday language—it won't diagnose or treat.</p>
            </div>
          )}
        </div>

        {/* Condensed steps row */}
        <div className="mt-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-center gap-2 text-xs text-foreground/60">
            <span className="flex items-center gap-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coral/20 text-coral font-bold text-[10px]">1</span>
              {currentContent.step1}
            </span>
            <span className="text-muted-foreground/50">→</span>
            <span className="flex items-center gap-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple/20 text-purple font-bold text-[10px]">2</span>
              {currentContent.step2}
            </span>
            <span className="text-muted-foreground/50">→</span>
            <span className="flex items-center gap-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint/20 text-mint font-bold text-[10px]">3</span>
              {currentContent.step3}
            </span>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2 text-[10px]">
            {currentContent.features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/30 backdrop-blur-sm">
                  <Icon className={`h-3 w-3 ${feature.color}`} />
                  <span className="text-foreground/60">{feature.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
