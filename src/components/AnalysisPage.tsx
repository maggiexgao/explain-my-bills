import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentViewer } from '@/components/DocumentViewer';
import { ExplanationPanel } from '@/components/ExplanationPanel';
import { UploadedFile, AnalysisResult } from '@/types';
import { useTranslation } from '@/i18n/LanguageContext';

interface AnalysisPageProps {
  file: UploadedFile;
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  onBack: () => void;
  hasEOB?: boolean;
}

export function AnalysisPage({ file, analysis, isAnalyzing, onBack, hasEOB = false }: AnalysisPageProps) {
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const { t } = useTranslation();

  if (isAnalyzing) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl glass-card-strong mx-auto">
              <div className="liquid-loader rounded-xl p-4">
                <Loader2 className="h-8 w-8 text-primary-foreground animate-spin" />
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">
              {t('analysis.loading')}
            </h2>
            <p className="text-muted-foreground">
              {t('analysis.loadingDesc')}
            </p>
          </div>
          <div className="w-64 h-2 rounded-full bg-muted/50 mx-auto overflow-hidden">
            <div className="h-full liquid-loader rounded-full animate-pulse-soft" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center space-y-4 glass-card-strong p-8 rounded-2xl">
          <p className="text-muted-foreground">{t('analysis.errorDesc')}</p>
          <Button 
            onClick={onBack}
            className="accent-gradient text-primary-foreground shadow-glow hover:shadow-glow-active"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('analysis.back')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="sticky top-16 z-40 glass-card border-t-0 border-x-0">
        <div className="container flex items-center h-12 px-4 md:px-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack} 
            className="gap-2 text-foreground/80 hover:text-foreground hover:bg-background/50"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('analysis.newDocument')}
          </Button>
        </div>
      </div>

      <div className="container px-4 py-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-12rem)]">
          <div className="h-full min-h-[400px] animate-fade-in">
            <div className="h-full glass-card-strong rounded-2xl overflow-hidden">
              <DocumentViewer file={file} activeHighlight={activeHighlight} />
            </div>
          </div>
          <div className="h-full min-h-[400px] glass-card-strong rounded-2xl overflow-hidden animate-slide-up">
            <ExplanationPanel 
              analysis={analysis} 
              onHoverCharge={setActiveHighlight}
              hasEOB={hasEOB}
            />
          </div>
        </div>
      </div>
    </div>
  );
}