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
import { ArrowRight, MapPin, Lock, FileSearch, Shield, Sparkles, Upload, FileText } from 'lucide-react';
import { UploadedFile, US_STATES } from '@/types';

interface UploadPageProps {
  uploadedFile: UploadedFile | null;
  eobFile: UploadedFile | null;
  selectedState: string;
  onFileSelect: (file: UploadedFile) => void;
  onRemoveFile: () => void;
  onEOBSelect: (file: UploadedFile) => void;
  onRemoveEOB: () => void;
  onStateChange: (state: string) => void;
  onAnalyze: () => void;
}

export function UploadPage({
  uploadedFile,
  eobFile,
  selectedState,
  onFileSelect,
  onRemoveFile,
  onEOBSelect,
  onRemoveEOB,
  onStateChange,
  onAnalyze,
}: UploadPageProps) {
  const canAnalyze = uploadedFile && selectedState;

  return (
    <div className="min-h-[calc(100vh-4rem)] hero-gradient">
      <div className="container px-4 py-16 md:py-24">
        <div className="max-w-xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground mb-5 leading-tight tracking-tight">
              Rosetta
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-md mx-auto leading-relaxed">
              Medical bills, decoded in plain language.
            </p>
          </div>

          {/* Main Upload Card */}
          <div className="bg-card rounded-3xl shadow-elevated border border-border/40 p-8 md:p-10 mb-8 animate-slide-up">
            <div className="space-y-6">
              {/* Primary: Medical Bill Upload */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Upload className="h-4 w-4 text-primary" />
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

              {/* State Selector */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <MapPin className="h-4 w-4 text-purple" />
                  Your State
                </label>
                <Select value={selectedState} onValueChange={onStateChange}>
                  <SelectTrigger className="w-full h-12 bg-background">
                    <SelectValue placeholder="Select your state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {US_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  We'll include state-specific protections and assistance programs
                </p>
              </div>

              {/* Analyze Button */}
              <Button
                size="xl"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-card"
                disabled={!canAnalyze}
                onClick={onAnalyze}
              >
                Analyze Document
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* How It Works - 3 steps */}
          <div className="grid grid-cols-3 gap-3 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="text-center p-4">
              <div className="flex h-10 w-10 mx-auto mb-3 items-center justify-center rounded-full bg-coral-light border border-coral/20">
                <span className="text-coral font-semibold text-sm">1</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Upload your documents</p>
            </div>
            <div className="text-center p-4">
              <div className="flex h-10 w-10 mx-auto mb-3 items-center justify-center rounded-full bg-purple-light border border-purple/20">
                <span className="text-purple font-semibold text-sm">2</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">We decode your bill</p>
            </div>
            <div className="text-center p-4">
              <div className="flex h-10 w-10 mx-auto mb-3 items-center justify-center rounded-full bg-mint-light border border-mint/20">
                <span className="text-mint font-semibold text-sm">3</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Get clear action steps</p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-card/60 border border-border/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coral-light">
                <FileSearch className="h-4 w-4 text-coral" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Line-by-Line</h3>
                <p className="text-xs text-muted-foreground">Every charge explained</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-card/60 border border-border/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-light">
                <Shield className="h-4 w-4 text-purple" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">State Protections</h3>
                <p className="text-xs text-muted-foreground">Your rights & programs</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-card/60 border border-border/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint-light">
                <Lock className="h-4 w-4 text-mint" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Private & Secure</h3>
                <p className="text-xs text-muted-foreground">Documents not stored</p>
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="mt-8 p-4 rounded-2xl bg-card/40 border border-border/30 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              <Lock className="h-3 w-3 inline-block mr-1 -mt-0.5" />
              Your privacy matters. Documents are processed securely and never stored. 
              This tool provides educational information only—not medical or legal advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
