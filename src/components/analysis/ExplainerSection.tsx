import { Badge } from '@/components/ui/badge';
import { Code, Footprints, HelpCircle, Info, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalysisResult, CPTCode } from '@/types';
import { useState } from 'react';
import { SubcategoryCard } from './SubcategoryCard';
import { useTranslation } from '@/i18n/LanguageContext';

interface ExplainerSectionProps {
  analysis: AnalysisResult;
}

const categoryLabels: Record<string, string> = {
  evaluation: 'Office/Telehealth Visit',
  lab: 'Lab Test',
  radiology: 'Imaging',
  surgery: 'Procedure',
  medicine: 'Treatment',
  other: 'Other Service',
};

const categoryColors: Record<string, string> = {
  evaluation: 'bg-primary/10 text-primary',
  lab: 'bg-info/10 text-info',
  radiology: 'bg-warning/10 text-warning-foreground',
  surgery: 'bg-destructive/10 text-destructive',
  medicine: 'bg-success/10 text-success',
  other: 'bg-muted text-muted-foreground',
};

function CPTCodeCard({ code }: { code: CPTCode }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="p-4 rounded-lg border border-border/30 bg-muted/10 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm font-mono font-semibold text-primary">{code.code}</code>
            <span className="text-muted-foreground">–</span>
            <span className="text-sm font-medium text-foreground">{code.shortLabel}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{code.explanation}</p>
        </div>
        <Badge className={cn('shrink-0 text-xs', categoryColors[code.category] || categoryColors.other)}>
          {categoryLabels[code.category] || 'Other'}
        </Badge>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Info className="h-3 w-3" />
        {expanded ? t('common.collapse') : t('common.learnMore')}
        <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
      </button>

      {expanded && (
        <div className="pt-2 space-y-2 animate-fade-in">
          <div className="p-3 rounded-md bg-background border border-border/30">
            <p className="text-xs text-muted-foreground mb-1">Where commonly used:</p>
            <p className="text-sm text-foreground">{code.whereUsed}</p>
          </div>
          <div className="p-3 rounded-md bg-background border border-border/30">
            <p className="text-xs text-muted-foreground mb-1">Typical complexity:</p>
            <p className="text-sm text-foreground capitalize">{code.complexityLevel} service</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExplainerSection({ analysis }: ExplainerSectionProps) {
  const { t } = useTranslation();
  const groupedCodes = analysis.cptCodes.reduce((acc, code) => {
    const cat = code.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(code);
    return acc;
  }, {} as Record<string, CPTCode[]>);

  const categoryOrder = ['evaluation', 'lab', 'radiology', 'surgery', 'medicine', 'other'];
  
  const cptTeaser = analysis.cptCodes.length > 0 
    ? `${analysis.cptCodes[0].shortLabel}${analysis.cptCodes.length > 1 ? ` and ${analysis.cptCodes.length - 1} more` : ''}`
    : 'No codes found';
    
  const visitTeaser = analysis.visitWalkthrough.length > 0
    ? analysis.visitWalkthrough[0].description.slice(0, 60) + '...'
    : 'What happened during your visit';

  return (
    <div className="space-y-3">
      <SubcategoryCard
        icon={<Code className="h-5 w-5 text-primary" />}
        title={t('explainer.cptCodes')}
        teaser={cptTeaser}
        badge={`${analysis.cptCodes.length} codes`}
        defaultOpen={false}
      >
        <div className="space-y-4">
          {categoryOrder.map((category) => {
            const codes = groupedCodes[category];
            if (!codes || codes.length === 0) return null;
            return (
              <div key={category}>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {categoryLabels[category]}
                </h4>
                <div className="space-y-2">
                  {codes.map((code, idx) => (
                    <CPTCodeCard key={`${code.code}-${idx}`} code={code} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SubcategoryCard>

      <SubcategoryCard
        icon={<Footprints className="h-5 w-5 text-primary" />}
        title={t('explainer.visitWalkthrough')}
        teaser={visitTeaser}
        badge={`${analysis.visitWalkthrough.length} ${t('explainer.step').toLowerCase()}s`}
        defaultOpen={false}
      >
        <div className="space-y-3">
          <ol className="space-y-2">
            {analysis.visitWalkthrough.map((step) => (
              <li key={step.order} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {step.order}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{step.description}</p>
                  {step.relatedCodes && step.relatedCodes.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {step.relatedCodes.map((code) => (
                        <code key={code} className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {code}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </SubcategoryCard>

      <SubcategoryCard
        icon={<HelpCircle className="h-5 w-5 text-primary" />}
        title={t('explainer.commonQuestions')}
        teaser="People often ask about these things"
        badge={`${analysis.codeQuestions.length} Q&As`}
        badgeVariant="info"
        defaultOpen={false}
      >
        <div className="space-y-3">
          {analysis.codeQuestions.map((q, idx) => (
            <div key={idx} className="p-4 rounded-lg border border-border/30 bg-muted/10">
              <div className="flex items-start gap-2 mb-2">
                <code className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                  {q.cptCode}
                </code>
                <h4 className="text-sm font-medium text-foreground">{q.question}</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">{q.answer}</p>
              <p className="text-xs text-muted-foreground">
                {q.suggestCall === 'billing' && `→ ${t('explainer.callWho.billing')}`}
                {q.suggestCall === 'insurance' && `→ ${t('explainer.callWho.insurance')}`}
                {q.suggestCall === 'either' && `→ ${t('explainer.callWho.either')}`}
              </p>
            </div>
          ))}
        </div>
      </SubcategoryCard>
    </div>
  );
}
