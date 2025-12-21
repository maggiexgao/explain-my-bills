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
    <div className="h-[calc(100vh-4rem)] hero-gradient flex flex-col overflow-hidden">
      <div className="container px-4 py-6 flex-1 flex flex-col">
        {/* Header */}
        <div className="text-center mb-6 animate-fade-in">
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-2 leading-tight tracking-tight">
            Rosetta
          </h1>
          <p className="text-base text-muted-foreground">
            Medical bills, decoded in plain language.
          </p>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 animate-slide-up">
          {/* Left: Upload Section */}
          <div className="bg-card rounded-2xl shadow-elevated border border-border/40 p-6 flex flex-col">
            <div className="space-y-4 flex-1">
              {/* Primary: Medical Bill Upload */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileSearch className="h-4 w-4 text-primary" />
                  Upload Medical Bill
                </label>
                <FileUploader
                  uploadedFile={uploadedFile}
                  onFileSelect={onFileSelect}
                  onRemoveFile={onRemoveFile}
                />
              </div>

              {/* Secondary: Optional EOB Upload */}
              <EOBUploader
                uploadedFile={eobFile}
                onFileSelect={onEOBSelect}
                onRemoveFile={onRemoveEOB}
              />
            </div>
          </div>

          {/* Right: Settings Bubbles + Analyze */}
          <div className="flex flex-col gap-4">
            {/* State Selector Bubble */}
            <div className="bg-card rounded-2xl shadow-soft border border-border/40 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-light">
                  <MapPin className="h-5 w-5 text-purple" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground text-sm">Your State</h3>
                  <p className="text-xs text-muted-foreground">For state-specific protections</p>
                </div>
              </div>
              <Select value={selectedState} onValueChange={onStateChange}>
                <SelectTrigger className="w-full h-11 bg-background">
                  <SelectValue placeholder="Select your state" />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] bg-popover z-50">
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Language Selector Bubble */}
            <div className="bg-card rounded-2xl shadow-soft border border-border/40 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-coral-light">
                  <Globe className="h-5 w-5 text-coral" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground text-sm">Language</h3>
                  <p className="text-xs text-muted-foreground">For all explanations</p>
                </div>
              </div>
              <Select value={selectedLanguage} onValueChange={(v) => onLanguageChange(v as Language)}>
                <SelectTrigger className="w-full h-11 bg-background">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
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

            {/* Analyze Button */}
            <Button
              size="lg"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-card h-14 text-base"
              disabled={!canAnalyze}
              onClick={onAnalyze}
            >
              Analyze Document
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* How It Works - 3 steps */}
          <div className="flex items-center justify-center gap-8 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-coral-light border border-coral/20">
                <span className="text-coral font-semibold text-xs">1</span>
              </div>
              <p className="text-xs text-muted-foreground">Upload documents</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-light border border-purple/20">
                <span className="text-purple font-semibold text-xs">2</span>
              </div>
              <p className="text-xs text-muted-foreground">We decode your bill</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-light border border-mint/20">
                <span className="text-mint font-semibold text-xs">3</span>
              </div>
              <p className="text-xs text-muted-foreground">Get action steps</p>
            </div>
          </div>

          {/* Features Row */}
          <div className="flex items-center justify-center gap-6 mb-3">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-coral" />
              <span className="text-xs text-muted-foreground">Line-by-line breakdown</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple" />
              <span className="text-xs text-muted-foreground">State protections</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-mint" />
              <span className="text-xs text-muted-foreground">Private & secure</span>
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
