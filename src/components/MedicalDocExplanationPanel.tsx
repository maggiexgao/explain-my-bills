import { useState } from 'react';
import { 
  FileText, 
  BookOpen, 
  HelpCircle, 
  MessageSquare, 
  ExternalLink, 
  ClipboardList,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MedicalDocumentResult } from '@/types';
import { cn } from '@/lib/utils';

interface MedicalDocExplanationPanelProps {
  analysis: MedicalDocumentResult;
}

interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function AccordionSection({ 
  title, 
  subtitle, 
  icon, 
  defaultOpen = false, 
  children,
  badge,
  badgeVariant = 'secondary'
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border-b border-border/30 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-background/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mint/20 text-mint">
            {icon}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{title}</h3>
              {badge && (
                <Badge variant={badgeVariant} className="text-xs">
                  {badge}
                </Badge>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

export function MedicalDocExplanationPanel({ analysis }: MedicalDocExplanationPanelProps) {
  const getDocTypeColor = (type: string) => {
    switch (type) {
      case 'test_results': return 'bg-purple/20 text-purple border-purple/30';
      case 'after_visit_summary': return 'bg-mint/20 text-mint border-mint/30';
      case 'clinical_note': return 'bg-coral/20 text-coral border-coral/30';
      case 'prescription': return 'bg-blush/20 text-blush border-blush/30';
      case 'imaging_report': return 'bg-secondary/20 text-secondary border-secondary/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Disclaimer Banner */}
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/80">
            This explanation is for education only. It does not diagnose, treat, or replace medical advice. 
            Only your clinician can interpret your results in the context of your full history and exam.
          </p>
        </div>

        {/* Document Header - Pond's Analysis */}
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-start justify-between mb-3">
            <Badge className={cn('text-xs', getDocTypeColor(analysis.documentType))}>
              {analysis.documentTypeLabel}
            </Badge>
          </div>
          <h2 className="text-lg font-display font-bold text-foreground mb-3">
            pond's analysis
          </h2>
          
          {/* Key Takeaways - with bold/italic rendering */}
          {analysis.pondsAnalysis?.keyTakeaways && analysis.pondsAnalysis.keyTakeaways.length > 0 ? (
            <ul className="text-sm text-muted-foreground space-y-2 mb-4">
              {analysis.pondsAnalysis.keyTakeaways.map((point, idx) => (
                <li 
                  key={idx} 
                  className="flex items-start gap-2"
                  dangerouslySetInnerHTML={{
                    __html: `<span class="text-mint font-bold">•</span> ${
                      point
                        .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
                        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                    }`
                  }}
                />
              ))}
            </ul>
          ) : (
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside mb-4">
              {analysis.overview.summary.split('. ').filter(s => s.trim()).slice(0, 4).map((point, idx) => (
                <li key={idx}>{point.trim().replace(/\.$/, '')}.</li>
              ))}
            </ul>
          )}
          
          {/* Context Paragraph */}
          {analysis.pondsAnalysis?.contextParagraph && (
            <p className="text-sm text-muted-foreground/90 border-t border-border/30 pt-3 italic">
              {analysis.pondsAnalysis.contextParagraph}
            </p>
          )}
        </div>

        {/* Sections */}
        <div className="glass-card rounded-xl overflow-hidden">
          {/* Document Overview */}
          <AccordionSection
            title="Document Overview"
            subtitle="The big picture of your document"
            icon={<FileText className="h-5 w-5" />}
            defaultOpen={true}
          >
            <div className="space-y-4">
              <div className="p-3 bg-background/40 rounded-lg">
                <h4 className="text-sm font-medium text-foreground mb-1">Main Purpose</h4>
                <p className="text-sm text-muted-foreground">{analysis.overview.mainPurpose}</p>
              </div>
              <div className="p-3 bg-mint/10 border border-mint/20 rounded-lg">
                <h4 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                  <Info className="h-4 w-4 text-mint" />
                  Overall Assessment
                </h4>
                <p className="text-sm text-muted-foreground">{analysis.overview.overallAssessment}</p>
              </div>
            </div>
          </AccordionSection>

          {/* Line-by-Line Plain Language */}
          <AccordionSection
            title="Line-by-Line Explanation"
            subtitle="Key findings explained simply"
            icon={<BookOpen className="h-5 w-5" />}
            badge={`${analysis.lineByLine.length} items`}
          >
            <div className="space-y-3">
              {analysis.lineByLine.map((item, idx) => (
                <div key={idx} className="p-3 bg-background/40 rounded-lg border-l-2 border-mint">
                  <p className="text-xs text-muted-foreground font-mono mb-1">
                    "{item.originalText}"
                  </p>
                  <p className="text-sm text-foreground">
                    → {item.plainLanguage}
                  </p>
                </div>
              ))}
            </div>
          </AccordionSection>

          {/* Definitions to Know */}
          <AccordionSection
            title="Definitions to Know"
            subtitle="Medical terms explained"
            icon={<BookOpen className="h-5 w-5" />}
            badge={`${analysis.definitions.length} terms`}
          >
            <div className="grid gap-2">
              {analysis.definitions.map((def, idx) => (
                <div key={idx} className="p-3 bg-background/40 rounded-lg">
                  <span className="font-semibold text-foreground">{def.term}</span>
                  <span className="text-muted-foreground"> — {def.definition}</span>
                </div>
              ))}
            </div>
          </AccordionSection>

          {/* Commonly Asked Questions */}
          <AccordionSection
            title="Commonly Asked Questions"
            subtitle="What other patients ask about these findings"
            icon={<HelpCircle className="h-5 w-5" />}
            badge={`${analysis.commonlyAskedQuestions.length} Q&As`}
          >
            <div className="space-y-4">
              {analysis.commonlyAskedQuestions.map((qa, idx) => (
                <div key={idx} className="p-3 bg-background/40 rounded-lg">
                  <p className="font-medium text-foreground mb-2">Q: {qa.question}</p>
                  <p className="text-sm text-muted-foreground">A: {qa.answer}</p>
                </div>
              ))}
            </div>
          </AccordionSection>

          {/* Questions to Ask Your Provider */}
          <AccordionSection
            title="Questions to Ask Your Provider"
            subtitle="Take these to your next appointment"
            icon={<MessageSquare className="h-5 w-5" />}
            badge={`${analysis.providerQuestions.length} questions`}
          >
            <div className="space-y-2">
              {analysis.providerQuestions.map((q, idx) => (
                <div key={idx} className="p-3 bg-purple/10 border border-purple/20 rounded-lg">
                  <p className="text-sm text-foreground">{idx + 1}. {q.question}</p>
                  {q.questionEnglish && q.questionEnglish !== q.question && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      English: {q.questionEnglish}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </AccordionSection>

          {/* Resources */}
          <AccordionSection
            title="Helpful Resources"
            subtitle="Trusted links for more information"
            icon={<ExternalLink className="h-5 w-5" />}
            badge={`${analysis.resources.length} links`}
          >
            <div className="space-y-3">
              {analysis.resources.map((resource, idx) => (
                <a
                  key={idx}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-background/40 rounded-lg hover:bg-background/60 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {resource.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{resource.description}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Source: {resource.source}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                  </div>
                </a>
              ))}
            </div>
          </AccordionSection>

          {/* Next Steps */}
          <AccordionSection
            title="Next Steps"
            subtitle="Your action checklist"
            icon={<ClipboardList className="h-5 w-5" />}
            badge={`${analysis.nextSteps.length} steps`}
          >
            <div className="space-y-2">
              {analysis.nextSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-background/40 rounded-lg">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-mint/20 text-mint text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{step.step}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{step.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </AccordionSection>
        </div>
      </div>
    </ScrollArea>
  );
}
