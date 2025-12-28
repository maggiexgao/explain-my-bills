/**
 * Medicare Comparison Section
 * Displays CPT costs compared to Medicare Physician Fee Schedule benchmarks
 */

import { Badge } from '@/components/ui/badge';
import { Info, TrendingUp, TrendingDown, Minus, DollarSign, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CptMedicareEvaluation, CptLineEvaluation, ServiceTypeSummary } from '@/types';
import { SubcategoryCard } from './SubcategoryCard';
import { useTranslation } from '@/i18n/LanguageContext';

interface MedicareComparisonSectionProps {
  evaluation: CptMedicareEvaluation;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return 'N/A';
  return `$${amount.toFixed(2)}`;
}

function formatRatio(ratio: number | null | undefined): string {
  if (ratio == null) return 'N/A';
  return `${ratio.toFixed(1)}×`;
}

function getRatioBadgeColor(badge: string | null | undefined): string {
  switch (badge) {
    case 'good': return 'bg-success/10 text-success border-success/20';
    case 'elevated': return 'bg-warning/10 text-warning-foreground border-warning/20';
    case 'high': return 'bg-coral/10 text-coral border-coral/20';
    case 'very-high': return 'bg-destructive/10 text-destructive border-destructive/20';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getRatioIcon(ratio: number | null | undefined) {
  if (ratio == null) return <Minus className="h-4 w-4" />;
  if (ratio <= 1.2) return <TrendingDown className="h-4 w-4 text-success" />;
  if (ratio <= 2) return <Minus className="h-4 w-4 text-warning-foreground" />;
  return <TrendingUp className="h-4 w-4 text-coral" />;
}

function getRatioLabel(ratio: number | null | undefined): string {
  if (ratio == null) return 'No data';
  if (ratio <= 1.2) return 'Close to Medicare';
  if (ratio <= 1.5) return 'Slightly above';
  if (ratio <= 2.5) return 'Moderately above';
  if (ratio <= 4) return 'Significantly above';
  return 'Very high';
}

function CptLineCard({ line }: { line: CptLineEvaluation }) {
  const { t } = useTranslation();
  
  return (
    <div className="p-4 rounded-lg border border-border/30 bg-muted/10 space-y-3">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm font-mono font-semibold text-primary">{line.cpt}</code>
            {line.modifier && (
              <code className="text-xs font-mono text-muted-foreground">-{line.modifier}</code>
            )}
          </div>
          <p className="text-sm text-foreground">{line.description}</p>
        </div>
        {line.ratioBadge && (
          <Badge className={cn('shrink-0 text-xs', getRatioBadgeColor(line.ratioBadge))}>
            {getRatioLabel(line.billedVsMedicareRatio)}
          </Badge>
        )}
      </div>

      {/* Price comparison grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {line.billedAmount != null && (
          <div className="p-2 rounded-md bg-background border border-border/30">
            <p className="text-xs text-muted-foreground mb-0.5">Billed</p>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(line.billedAmount)}</p>
          </div>
        )}
        {line.mpfsAllowed != null && (
          <div className="p-2 rounded-md bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-0.5">Medicare 2025</p>
            <p className="text-sm font-semibold text-primary">{formatCurrency(line.mpfsAllowed)}</p>
          </div>
        )}
        {line.billedVsMedicareRatio != null && (
          <div className="p-2 rounded-md bg-background border border-border/30">
            <p className="text-xs text-muted-foreground mb-0.5">vs Medicare</p>
            <div className="flex items-center gap-1">
              {getRatioIcon(line.billedVsMedicareRatio)}
              <p className="text-sm font-semibold">{formatRatio(line.billedVsMedicareRatio)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {line.notes.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <p>{line.notes.join(' ')}</p>
        </div>
      )}
    </div>
  );
}

function ServiceTypeSummaryCard({ summary }: { summary: ServiceTypeSummary }) {
  return (
    <div className="p-3 rounded-lg border border-border/30 bg-muted/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{summary.serviceTypeLabel}</span>
        </div>
        {summary.avgAllowedVsMedicareRatio && (
          <Badge variant="outline" className="text-xs">
            Avg: {formatRatio(summary.avgAllowedVsMedicareRatio)}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Billed</p>
          <p className="text-sm font-semibold">{formatCurrency(summary.totalBilled)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Medicare</p>
          <p className="text-sm font-semibold text-primary">{formatCurrency(summary.totalMedicareAllowed)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Allowed</p>
          <p className="text-sm font-semibold">{formatCurrency(summary.totalAllowed)}</p>
        </div>
      </div>
    </div>
  );
}

export function MedicareComparisonSection({ evaluation }: MedicareComparisonSectionProps) {
  const { t } = useTranslation();
  const hasLines = evaluation.lines.length > 0;
  const hasSummary = evaluation.byServiceType.length > 0;
  
  const overallRatio = evaluation.overallSummary.avgBilledVsMedicareRatio;
  const overallTeaser = overallRatio 
    ? `${t('medicare.overallBilled')} ${formatRatio(overallRatio)} ${t('medicare.vsMedicare')}`
    : t('medicare.compareWithMedicare');

  return (
    <div className="space-y-3">
      {/* Overall Summary Card */}
      {evaluation.overallSummary.totalMedicareAllowed > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">{t('medicare.overallComparison')}</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('medicare.totalBilled')}</p>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(evaluation.overallSummary.totalBilled)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('medicare.medicareRate')}</p>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(evaluation.overallSummary.totalMedicareAllowed)}
              </p>
            </div>
            {evaluation.overallSummary.totalAllowed && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{t('medicare.insurerAllowed')}</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(evaluation.overallSummary.totalAllowed)}
                </p>
              </div>
            )}
            {overallRatio && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{t('medicare.billedVsMedicare')}</p>
                <div className="flex items-center justify-center gap-1">
                  {getRatioIcon(overallRatio)}
                  <p className="text-lg font-bold">{formatRatio(overallRatio)}</p>
                </div>
              </div>
            )}
          </div>
          
          {/* State/Year context */}
          {(evaluation.state || evaluation.year) && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {t('medicare.basedOn')} {evaluation.year || 2025} Medicare Physician Fee Schedule
              {evaluation.state ? ` for ${evaluation.state}` : ''}
            </p>
          )}
        </div>
      )}

      {/* Service Type Summary */}
      {hasSummary && (
        <SubcategoryCard
          icon={<Building2 className="h-5 w-5 text-primary" />}
          title={t('medicare.byServiceType')}
          teaser={t('medicare.byServiceTypeDesc')}
          badge={`${evaluation.byServiceType.length} ${t('medicare.categories')}`}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {evaluation.byServiceType.map((summary, idx) => (
              <ServiceTypeSummaryCard key={`${summary.serviceType}-${idx}`} summary={summary} />
            ))}
          </div>
        </SubcategoryCard>
      )}

      {/* Individual Line Items */}
      {hasLines && (
        <SubcategoryCard
          icon={<DollarSign className="h-5 w-5 text-primary" />}
          title={t('medicare.lineByLine')}
          teaser={overallTeaser}
          badge={`${evaluation.lines.length} ${t('medicare.items')}`}
          defaultOpen={false}
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('medicare.lineByLineDesc')}
            </p>
            {evaluation.lines.map((line, idx) => (
              <CptLineCard key={`${line.cpt}-${idx}`} line={line} />
            ))}
          </div>
        </SubcategoryCard>
      )}

      {/* Educational note */}
      <div className="p-3 rounded-lg bg-info/5 border border-info/20">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            {t('medicare.educationalNote')}
          </p>
        </div>
      </div>
    </div>
  );
}
