import { FileUploader } from '@/components/FileUploader';
import { EOBUploader } from '@/components/EOBUploader';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, MapPin, Lock, FileSearch, Shield, Globe } from 'lucide-react';
import { UploadedFile, US_STATES, Language, LANGUAGES } from '@/types';
import { useTranslation } from '@/i18n/LanguageContext';

interface UploadPageProps {
  uploadedFile: UploadedFile | null;
  eobFile: UploadedFile | null;
  selectedState: string;
  selectedLanguage: Language;
  onFileSelect: (file: UploadedFile) => void;
  onRemoveFile: () => void;
  onEOBSelect: (file: UploadedFile) => void;
  onRemoveEOB: () => void;
  onStateChange: (state: string) => void;
  onLanguageChange: (language: Language) => void;
  onAnalyze: () => void;
}

export function UploadPage({
  uploadedFile,
  eobFile,
  selectedState,
  selectedLanguage,
  onFileSelect,
  onRemoveFile,
  onEOBSelect,
  onRemoveEOB,
  onStateChange,
  onLanguageChange,
  onAnalyze,
}: UploadPageProps) {
  const { t } = useTranslation();
  const canAnalyze = uploadedFile && selectedState;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground/95 mb-3 tracking-tight">
            {t('app.title')}
          </h1>
          <p className="text-lg text-muted-foreground font-light">
            {t('app.subtitle')}
          </p>
        </div>

        <div className="glass-card-strong p-6 md:p-8 space-y-6 animate-slide-up">
          <div className="space-y-4">
            <FileUploader
              uploadedFile={uploadedFile}
              onFileSelect={onFileSelect}
              onRemoveFile={onRemoveFile}
            />
            <EOBUploader
              uploadedFile={eobFile}
              onFileSelect={onEOBSelect}
              onRemoveFile={onRemoveEOB}
            />
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
            {t('upload.analyze')}
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>

        <div className="mt-8 space-y-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-coral/20 border border-coral/30">
                <span className="text-coral font-bold text-sm">1</span>
              </div>
              <p className="text-sm text-foreground/70">{t('upload.step1.desc')}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple/20 border border-purple/30">
                <span className="text-purple font-bold text-sm">2</span>
              </div>
              <p className="text-sm text-foreground/70">{t('upload.step2.desc')}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mint/20 border border-mint/30">
                <span className="text-mint font-bold text-sm">3</span>
              </div>
              <p className="text-sm text-foreground/70">{t('upload.step3.desc')}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-sm">
              <FileSearch className="h-4 w-4 text-coral" />
              <span className="text-foreground/70">{t('upload.feature.breakdown')}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-sm">
              <Shield className="h-4 w-4 text-purple" />
              <span className="text-foreground/70">{t('upload.feature.protections')}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-sm">
              <Lock className="h-4 w-4 text-mint" />
              <span className="text-foreground/70">{t('upload.feature.secure')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}