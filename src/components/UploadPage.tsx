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
  const canAnalyze = uploadedFile && selectedState;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-8">
      {/* Main Glass Card - Centered */}
      <div className="w-full max-w-xl animate-fade-in">
        {/* Hero Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground/95 mb-3 tracking-tight">
            Rosetta
          </h1>
          <p className="text-lg text-muted-foreground font-light">
            Medical bills, decoded.
          </p>
        </div>

        {/* Upload Card */}
        <div className="glass-card-strong p-6 md:p-8 space-y-6 animate-slide-up">
          {/* File Upload Zone */}
          <div className="space-y-4">
            <FileUploader
              uploadedFile={uploadedFile}
              onFileSelect={onFileSelect}
              onRemoveFile={onRemoveFile}
            />
            
            {/* Optional EOB Upload */}
            <EOBUploader
              uploadedFile={eobFile}
              onFileSelect={onEOBSelect}
              onRemoveFile={onRemoveEOB}
            />
          </div>

          {/* Dropdowns Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* State Selector */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                <MapPin className="h-4 w-4 text-purple" />
                Your State
              </label>
              <Select value={selectedState} onValueChange={onStateChange}>
                <SelectTrigger className="w-full h-12 bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder="Select your state" />
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

            {/* Language Selector */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                <Globe className="h-4 w-4 text-coral" />
                Language
              </label>
              <Select value={selectedLanguage} onValueChange={(v) => onLanguageChange(v as Language)}>
                <SelectTrigger className="w-full h-12 bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder="Select language" />
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

          {/* Analyze Button */}
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
            Analyze Document
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>

        {/* Bottom Info Section */}
        <div className="mt-8 space-y-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          {/* How It Works - 3 steps */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-coral/20 border border-coral/30">
                <span className="text-coral font-bold text-sm">1</span>
              </div>
              <p className="text-sm text-foreground/70">Upload documents</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple/20 border border-purple/30">
                <span className="text-purple font-bold text-sm">2</span>
              </div>
              <p className="text-sm text-foreground/70">We decode your bill</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mint/20 border border-mint/30">
                <span className="text-mint font-bold text-sm">3</span>
              </div>
              <p className="text-sm text-foreground/70">Get action steps</p>
            </div>
          </div>

          {/* Features Row */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-sm">
              <FileSearch className="h-4 w-4 text-coral" />
              <span className="text-foreground/70">Line-by-line breakdown</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-sm">
              <Shield className="h-4 w-4 text-purple" />
              <span className="text-foreground/70">State protections</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-sm">
              <Lock className="h-4 w-4 text-mint" />
              <span className="text-foreground/70">Private & secure</span>
            </div>
          </div>

          {/* Privacy Notice */}
          <p className="text-xs text-muted-foreground text-center">
            <Lock className="h-3 w-3 inline-block mr-1 -mt-0.5" />
            Documents processed securely and never stored. Educational information only.
          </p>
        </div>
      </div>
    </div>
  );
}