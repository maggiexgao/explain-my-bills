import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentViewer } from '@/components/DocumentViewer';
import { ExplanationPanel } from '@/components/ExplanationPanel';
import { UploadedFile, AnalysisResult } from '@/types';

interface AnalysisPageProps {
  file: UploadedFile;
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  onBack: () => void;
}

export function AnalysisPage({ file, analysis, isAnalyzing, onBack }: AnalysisPageProps) {
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

  if (isAnalyzing) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center calm-gradient">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
          <div>
            <h2 className="text-xl font-display font-semibold text-foreground mb-2">
              Analyzing Your Document
            </h2>
            <p className="text-muted-foreground">
              This usually takes 10-30 seconds...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center calm-gradient">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Something went wrong. Please try again.</p>
          <Button variant="calm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {/* Top Bar */}
      <div className="sticky top-16 z-40 border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex items-center h-12 px-4 md:px-6">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Upload New Document
          </Button>
        </div>
      </div>

      {/* Split View */}
      <div className="container px-4 py-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-12rem)]">
          {/* Left Panel - Document Viewer */}
          <div className="h-full min-h-[400px] animate-fade-in">
            <DocumentViewer file={file} activeHighlight={activeHighlight} />
          </div>

          {/* Right Panel - Explanation */}
          <div className="h-full min-h-[400px] bg-card rounded-xl border border-border/50 shadow-soft overflow-hidden animate-slide-up">
            <ExplanationPanel 
              analysis={analysis} 
              onHoverCharge={setActiveHighlight}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
