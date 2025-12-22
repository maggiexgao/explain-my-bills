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
import { ArrowRight, MapPin, Lock, FileSearch, Shield, Globe, BookOpen, MessageSquare, HelpCircle } from 'lucide-react';
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
      features: [
        { icon: FileSearch, label: 'Line-by-line', color: 'text-coral' },
        { icon: Shield, label: 'State protections', color: 'text-purple' },
        { icon: Lock, label: 'Private', color: 'text-teal' },
      ],
      buttonText: t('upload.analyze'),
    },
    medical_document: {
      subtitle: 'Understand your visit notes, test results, and paperwork.',
      features: [
        { icon: BookOpen, label: 'Plain language', color: 'text-coral' },
        { icon: HelpCircle, label: 'Terms defined', color: 'text-purple' },
        { icon: MessageSquare, label: 'Provider questions', color: 'text-teal' },
      ],
      buttonText: 'Analyze Document',
    },
  };

  const currentContent = content[analysisMode];

  return (
    <div className="h-full flex flex-col items-center justify-center px-4 py-3">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Compact header */}
        <div className="text-center mb-3">
          <h1 className="font-display text-2xl font-bold text-foreground mb-0.5 tracking-tight">
            {t('app.title')}
          </h1>
          <p className="text-xs text-muted-foreground font-light">
            be your own best advocate.
          </p>
        </div>

        <div className="glass-card-strong p-4 space-y-3 animate-slide-up">
          {/* Mode Toggle with inline subtitle */}
          <div className="space-y-1">
            <ModeToggle mode={analysisMode} onModeChange={onModeChange} />
            <p className="text-[11px] text-center text-muted-foreground">
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
              <p className="text-[10px] text-muted-foreground/70 text-center leading-tight">
                Lab results, imaging reports, visit summaries, prescriptions
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
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="flex items-center gap-1 text-[10px] font-medium text-foreground/70">
                <MapPin className="h-2.5 w-2.5 text-purple" />
                {t('upload.state.label')}
              </label>
              <Select value={selectedState} onValueChange={onStateChange}>
                <SelectTrigger className="w-full h-9 text-xs bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder={t('upload.state.placeholder')} />
                </SelectTrigger>
                <SelectContent className="max-h-[180px] bg-popover/95 backdrop-blur-md z-50">
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value} className="text-xs">
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-0.5">
              <label className="flex items-center gap-1 text-[10px] font-medium text-foreground/70">
                <Globe className="h-2.5 w-2.5 text-coral" />
                {t('upload.language.label')}
              </label>
              <Select value={selectedLanguage} onValueChange={(v) => onLanguageChange(v as Language)}>
                <SelectTrigger className="w-full h-9 text-xs bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder={t('upload.language.label')} />
                </SelectTrigger>
                <SelectContent className="bg-popover/95 backdrop-blur-md z-50">
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value} className="text-xs">
                      <span className="flex items-center gap-1">
                        <span>{lang.nativeLabel}</span>
                        {lang.value !== 'en' && (
                          <span className="text-muted-foreground text-[9px]">({lang.label})</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Analyze button */}
          <Button
            size="lg"
            className={`w-full h-10 text-sm font-semibold rounded-xl transition-all duration-300 relative overflow-hidden group ${
              canAnalyze 
                ? 'accent-gradient text-primary-foreground shadow-glow hover:shadow-glow-active' 
                : 'bg-muted/60 text-muted-foreground cursor-not-allowed'
            }`}
            disabled={!canAnalyze}
            onClick={onAnalyze}
          >
            {canAnalyze && (
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 rounded-full bg-white/25 group-hover:w-full group-hover:h-full group-hover:scale-150 transition-all duration-500" />
              </span>
            )}
            <span className="relative z-10 flex items-center gap-2">
              {currentContent.buttonText}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Button>
        </div>

        {/* Condensed steps + features */}
        <div className="mt-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-foreground/60 mb-2">
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-coral/20 text-coral font-bold text-[9px]">1</span>
              upload
            </span>
            <span className="text-muted-foreground/40">→</span>
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-purple/20 text-purple font-bold text-[9px]">2</span>
              pond decodes
            </span>
            <span className="text-muted-foreground/40">→</span>
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal/20 text-teal font-bold text-[9px]">3</span>
              next step
            </span>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[9px]">
            {currentContent.features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/50 backdrop-blur-sm border border-white/60">
                  <Icon className={`h-2.5 w-2.5 ${feature.color}`} />
                  <span className="text-foreground/70">{feature.label}</span>
                </div>
              );
            })}
          </div>

          {/* Compact disclaimer */}
          <p className="text-[9px] text-center text-muted-foreground/60 mt-2 leading-tight">
            pond explains documents in everyday language—it won't diagnose or treat. <a href="#" className="underline hover:text-foreground/70">Learn more</a>
          </p>
        </div>
      </div>
    </div>
  );
}
