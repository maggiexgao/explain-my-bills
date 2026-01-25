import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingDown, TrendingUp, Minus, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MedicareSummary } from '@/lib/medicareBenchmark';

interface MedicarePricingSummaryProps {
  summary: MedicareSummary;
}

const statusConfig = {
  fair: {
    icon: <CheckCircle className="h-5 w-5" />,
    label: 'Fair Pricing',
    color: 'text-success',
    bg: 'bg-success/15',
    border: 'border-success/40',
    badgeBg: 'bg-success/10',
    description: 'Your charges are within typical commercial insurance range'
  },
  high: {
    icon: <TrendingUp className="h-5 w-5" />,
    label: 'Higher Than Typical',
    color: 'text-warning',
    bg: 'bg-warning/15',
    border: 'border-warning/40',
    badgeBg: 'bg-warning/10',
    description: 'Some charges exceed typical rates — negotiation may help'
  },
  very_high: {
    icon: <AlertCircle className="h-5 w-5" />,
    label: 'Significantly Overpriced',
    color: 'text-destructive',
    bg: 'bg-destructive/15',
    border: 'border-destructive/40',
    badgeBg: 'bg-destructive/10',
    description: 'Several charges significantly exceed standard rates'
  },
  mixed: {
    icon: <Minus className="h-5 w-5" />,
    label: 'Mixed Results',
    color: 'text-warning',
    bg: 'bg-warning/15',
    border: 'border-warning/40',
    badgeBg: 'bg-warning/10',
    description: 'Some charges are fair, others may need review'
  },
  unknown: {
    icon: <HelpCircle className="h-5 w-5" />,
    label: 'Limited Data',
    color: 'text-muted-foreground',
    bg: 'bg-muted/15',
    border: 'border-border/40',
    badgeBg: 'bg-muted/10',
    description: 'Not enough Medicare data available for comparison'
  }
};

export function MedicarePricingSummary({ summary }: MedicarePricingSummaryProps) {
  const config = statusConfig[summary.overallStatus];
  const progressValue = summary.percentOfMedicare 
    ? Math.min(100, (summary.percentOfMedicare / 400) * 100)
    : 0;

  return (
    <div className={cn(
      'p-5 rounded-2xl border-2 transition-all',
      config.bg,
      config.border
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-xl p-2', config.bg, config.color)}>
            {config.icon}
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-lg">Benchmark Price Analysis</h3>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
        <Badge className={cn('shrink-0 text-sm px-3 py-1', config.badgeBg, config.color)}>
          {config.label}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 rounded-xl bg-background/50">
          <p className="text-xs text-muted-foreground mb-1">Total Charged</p>
          <p className="text-xl font-bold text-foreground">
            ${summary.totalCharged.toLocaleString()}
          </p>
        </div>
        <div className="text-center p-3 rounded-xl bg-background/50">
          <p className="text-xs text-muted-foreground mb-1">Benchmark Reference</p>
          <p className="text-xl font-bold text-foreground">
            {summary.totalMedicare 
              ? `$${summary.totalMedicare.toLocaleString()}`
              : 'N/A'
            }
          </p>
        </div>
        <div className="text-center p-3 rounded-xl bg-background/50">
          <p className="text-xs text-muted-foreground mb-1">× Benchmark</p>
          <p className={cn('text-xl font-bold', config.color)}>
            {summary.percentOfMedicare 
              ? `${summary.percentOfMedicare}%`
              : 'N/A'
            }
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      {summary.percentOfMedicare && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>100% (Benchmark)</span>
            <span>200% (Fair)</span>
            <span>300%+ (High)</span>
          </div>
          <div className="relative">
            <Progress value={progressValue} className="h-2" />
            {/* Fair range indicator */}
            <div 
              className="absolute top-0 h-2 border-l-2 border-success opacity-50"
              style={{ left: '25%' }}
            />
            <div 
              className="absolute top-0 h-2 border-l-2 border-warning opacity-50"
              style={{ left: '50%' }}
            />
            <div 
              className="absolute top-0 h-2 border-l-2 border-destructive opacity-50"
              style={{ left: '75%' }}
            />
          </div>
        </div>
      )}

      {/* Potential Savings & Flagged Items */}
      <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/30">
        {summary.potentialSavings !== null && summary.potentialSavings > 0 ? (
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-success" />
            <span className="text-sm">
              <span className="font-semibold text-success">
                Potential Savings: ${summary.potentialSavings.toLocaleString()}
              </span>
              <span className="text-muted-foreground ml-1">
                if negotiated to 150% of benchmark
              </span>
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            No significant overcharges detected
          </span>
        )}
        
        {summary.itemsFlagged > 0 && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            {summary.itemsFlagged} item{summary.itemsFlagged > 1 ? 's' : ''} flagged
          </Badge>
        )}
      </div>

      {/* CMS Trust Indicator */}
      <div className="mt-4 pt-3 border-t border-border/30">
        <p className="text-xs text-muted-foreground text-center">
          📊 Based on CMS 2026 Fee Schedules • Fair pricing is typically 150-250% of benchmark
        </p>
      </div>
    </div>
  );
}
