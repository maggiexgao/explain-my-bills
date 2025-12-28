import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

interface TotalsLineUpCardProps {
  billTotal: number;
  eobPatientResponsibility: number;
  hasWarnings: boolean;
}

export function TotalsLineUpCard({ billTotal, eobPatientResponsibility, hasWarnings }: TotalsLineUpCardProps) {
  const { t } = useTranslation();
  
  return (
    <div className="p-5 rounded-2xl bg-info/8 border border-info/30 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info/15">
          <CheckCircle2 className="h-5 w-5 text-info" />
        </div>
        <div className="flex-1 space-y-3">
          <h3 className="text-base font-semibold text-foreground">
            {t('analysis.totalsMatchButWarningsTitle')}
          </h3>
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>{t('analysis.totalsMatchButWarningsBody')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
