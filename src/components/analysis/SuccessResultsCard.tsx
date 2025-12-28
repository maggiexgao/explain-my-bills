import { CheckCircle } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface SuccessResultsCardProps {
  billTotal: number;
  eobPatientResponsibility: number;
}

export function SuccessResultsCard({ billTotal, eobPatientResponsibility }: SuccessResultsCardProps) {
  const { t } = useTranslation();
  
  return (
    <div className="p-6 rounded-2xl bg-success/10 border border-success/40 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success/20">
          <CheckCircle className="h-6 w-6 text-success" />
        </div>
        <div className="flex-1 space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            {t('analysis.overallCleanTitle')}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('analysis.overallCleanBody')}
          </p>
        </div>
      </div>
    </div>
  );
}
