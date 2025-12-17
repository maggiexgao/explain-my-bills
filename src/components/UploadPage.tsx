import { FileUploader } from '@/components/FileUploader';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, MapPin, Lock, FileSearch, MessageSquare } from 'lucide-react';
import { UploadedFile, US_STATES } from '@/types';

interface UploadPageProps {
  uploadedFile: UploadedFile | null;
  selectedState: string;
  onFileSelect: (file: UploadedFile) => void;
  onRemoveFile: () => void;
  onStateChange: (state: string) => void;
  onAnalyze: () => void;
}

export function UploadPage({
  uploadedFile,
  selectedState,
  onFileSelect,
  onRemoveFile,
  onStateChange,
  onAnalyze,
}: UploadPageProps) {
  const canAnalyze = uploadedFile && selectedState;

  return (
    <div className="min-h-[calc(100vh-4rem)] calm-gradient">
      <div className="container px-4 py-12 md:py-20">
        <div className="max-w-2xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4 leading-tight">
              Understand Your Medical Bills
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Upload a medical bill, explanation of benefits, or medical document. 
              We'll explain it in plain language you can understand.
            </p>
          </div>

          {/* Upload Card */}
          <div className="bg-card rounded-2xl shadow-card border border-border/50 p-6 md:p-8 mb-8 animate-slide-up">
            <div className="space-y-6">
              <FileUploader
                uploadedFile={uploadedFile}
                onFileSelect={onFileSelect}
                onRemoveFile={onRemoveFile}
              />

              {/* State Selector */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Your State
                </label>
                <Select value={selectedState} onValueChange={onStateChange}>
                  <SelectTrigger className="w-full h-12">
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
                  Used to provide state-specific patient rights information
                </p>
              </div>

              {/* Analyze Button */}
              <Button
                size="xl"
                className="w-full"
                disabled={!canAnalyze}
                onClick={onAnalyze}
              >
                Analyze Document
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-card/50 border border-border/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileSearch className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Line-by-Line</h3>
                <p className="text-xs text-muted-foreground">Every charge explained simply</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-card/50 border border-border/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">5 Languages</h3>
                <p className="text-xs text-muted-foreground">Switch languages anytime</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-card/50 border border-border/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Private & Secure</h3>
                <p className="text-xs text-muted-foreground">Documents are not stored</p>
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border/30 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              <Lock className="h-3 w-3 inline-block mr-1 -mt-0.5" />
              Your privacy matters. Documents are processed securely and never stored or used for AI training. 
              This tool provides educational information only—not medical or legal advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
