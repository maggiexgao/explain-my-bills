import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentViewer } from '@/components/DocumentViewer';
import { ExplanationPanel } from '@/components/ExplanationPanel';
import { ZoomControl } from '@/components/ZoomControl';
import { useZoom } from '@/contexts/ZoomContext';
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
  const { zoomClass } = useZoom();

  if (isAnalyzing) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl glass-card-strong mx-auto">
              <div className="liquid-loader rounded-xl p-3">
                <Loader2 className="h-6 w-6 text-primary-foreground animate-spin" />
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground mb-1">
              Analyzing
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('analysis.loadingDesc')}
            </p>
          </div>
          <div className="w-48 h-1.5 rounded-full bg-muted/50 mx-auto overflow-hidden">
            <div 
              className="h-full liquid-loader rounded-full" 
              style={{ animation: 'loading-progress 30s ease-out forwards' }} 
            />
          </div>
          <style>{`
            @keyframes loading-progress {
              0% { width: 0%; }
              90% { width: 90%; }
              100% { width: 100%; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3 glass-card-strong p-6 rounded-2xl">
          <p className="text-muted-foreground text-sm">{t('analysis.errorDesc')}</p>
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
    <div className="h-full flex flex-col">
      {/* Compact sticky bar */}
      <div className="shrink-0 z-40 glass-card border-t-0 border-x-0 border-b border-border/30">
        <div className="container flex items-center justify-between h-8 px-4 md:px-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack} 
            className="gap-1 text-foreground/80 hover:text-foreground hover:bg-background/50 text-xs h-6 px-2"
          >
            <ArrowLeft className="h-3 w-3" />
            {t('analysis.newDocument')}
          </Button>
          <ZoomControl />
        </div>
      </div>

      {/* Two-column layout that fits in viewport */}
      <div className="flex-1 min-h-0 container px-3 py-2 md:px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 h-full">
          <div className="h-full min-h-0 animate-fade-in">
            <div className="h-full glass-card-strong rounded-xl overflow-hidden">
              <DocumentViewer file={file} activeHighlight={activeHighlight} />
            </div>
          </div>
          <div className={`h-full min-h-0 glass-card-strong rounded-xl overflow-hidden animate-slide-up ${zoomClass}`}>
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

