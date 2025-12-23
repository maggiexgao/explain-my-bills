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
import { ArrowRight, MapPin, Lock, FileSearch, Shield, Globe, BookOpen, HelpCircle } from 'lucide-react';
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
        { icon: Lock, label: 'Secure', color: 'text-sky' },
      ],
      buttonText: 'Analyze Document',
    },
  };

  const currentContent = content[analysisMode];

  return (
    <div className="h-full flex flex-col items-center justify-start md:justify-center px-3 md:px-4 py-4 md:py-0 overflow-y-auto">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="glass-card-strong p-3 md:p-4 space-y-2.5 md:space-y-2.5 animate-slide-up">
          {/* Mode Toggle - Full width on mobile */}
          <ModeToggle mode={analysisMode} onModeChange={onModeChange} />

          {/* Mode subtitle - visible on mobile */}
          <p className="text-xs text-muted-foreground text-center md:hidden leading-tight">
            {currentContent.subtitle}
          </p>

          {/* File uploaders */}
          <div className="space-y-1.5">
            <FileUploader
              uploadedFile={uploadedFile}
              onFileSelect={onFileSelect}
              onRemoveFile={onRemoveFile}
              mode={analysisMode}
            />
            
            {/* Compact supported docs for Medical Document mode */}
            {isMedicalDoc && !uploadedFile && (
              <p className="text-[9px] md:text-[9px] text-muted-foreground/70 text-center leading-tight">
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

          {/* State and Language selectors - stack on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="flex items-center gap-1 text-xs font-medium text-gray-700">
                <MapPin className="h-2.5 w-2.5 text-purple" />
                {t('upload.state.label')}
              </label>
              <Select value={selectedState} onValueChange={onStateChange}>
                <SelectTrigger className="w-full h-10 md:h-8 text-sm md:text-xs bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder={t('upload.state.placeholder')} />
                </SelectTrigger>
                <SelectContent className="max-h-[180px] bg-popover/95 backdrop-blur-md z-50">
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value} className="text-sm md:text-xs">
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-0.5">
              <label className="flex items-center gap-1 text-xs font-medium text-gray-700">
                <Globe className="h-2.5 w-2.5 text-coral" />
                {t('upload.language.label')}
              </label>
              <Select value={selectedLanguage} onValueChange={(v) => onLanguageChange(v as Language)}>
                <SelectTrigger className="w-full h-10 md:h-8 text-sm md:text-xs bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder={t('upload.language.label')} />
                </SelectTrigger>
                <SelectContent className="bg-popover/95 backdrop-blur-md z-50">
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value} className="text-sm md:text-xs">
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

          {/* Analyze button - larger touch target on mobile */}
          <Button
            size="lg"
            className={`w-full h-11 md:h-9 text-base md:text-sm font-semibold rounded-xl transition-all duration-300 relative overflow-hidden group ${
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
        <div className="mt-2.5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* Step indicators - wrap on very small screens */}
          <div className="flex items-center justify-center gap-1 md:gap-1.5 text-[11px] md:text-xs text-gray-600 mb-1.5 flex-wrap">
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-coral/20 text-coral font-bold text-[9px]">1</span>
              upload
            </span>
            <span className="text-gray-400">→</span>
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-purple/20 text-purple font-bold text-[9px]">2</span>
              pond decodes
            </span>
            <span className="text-gray-400">→</span>
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky/20 text-sky font-bold text-[9px]">3</span>
              next step
            </span>
          </div>

          {/* Feature pills - wrap properly */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-1 text-[11px] md:text-[10px]">
            {currentContent.features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="flex items-center gap-0.5 px-2 md:px-1.5 py-1 md:py-0.5 rounded-full bg-white/50 backdrop-blur-sm border border-white/60">
                  <Icon className={`h-3 md:h-2.5 w-3 md:w-2.5 ${feature.color}`} />
                  <span className="text-gray-700">{feature.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
