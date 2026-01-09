import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, AlertCircle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MedicareComparison } from '@/lib/medicareBenchmark';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface MedicareLineItemTableProps {
  comparisons: MedicareComparison[];
}

const statusConfig = {
  fair: {
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'Fair',
    color: 'text-success',
    bg: 'bg-success/10',
    emoji: '🟢'
  },
  high: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'High',
    color: 'text-warning',
    bg: 'bg-warning/10',
    emoji: '🟡'
  },
  very_high: {
    icon: <AlertCircle className="h-4 w-4" />,
    label: 'Very High',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    emoji: '🔴'
  },
  unknown: {
    icon: <HelpCircle className="h-4 w-4" />,
    label: 'N/A',
    color: 'text-muted-foreground',
    bg: 'bg-muted/10',
    emoji: '⚪'
  }
};

function LineItemRow({ comparison, index }: { comparison: MedicareComparison; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[comparison.status];
  const isFlagged = comparison.status === 'high' || comparison.status === 'very_high';

  return (
    <div className={cn(
      'border-b border-border/20 last:border-0 transition-colors',
      isFlagged && 'bg-destructive/5'
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/10 transition-colors"
      >
        {/* CPT Code */}
        <div className="w-20 shrink-0">
          <code className="text-xs font-mono bg-muted/30 px-1.5 py-0.5 rounded">
            {comparison.cptCode}
          </code>
        </div>

        {/* Description */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate">
            {comparison.description || 'Unknown procedure'}
          </p>
        </div>

        {/* Charged Amount */}
        <div className="w-24 text-right shrink-0">
          <span className="text-sm font-semibold text-foreground">
            ${comparison.chargedAmount.toLocaleString()}
          </span>
        </div>

        {/* Medicare Fee */}
        <div className="w-24 text-right shrink-0">
          <span className="text-sm text-muted-foreground">
            {comparison.medicareFee 
              ? `$${comparison.medicareFee.toLocaleString()}`
              : '—'
            }
          </span>
        </div>

        {/* Percentage */}
        <div className="w-16 text-right shrink-0">
          <span className={cn('text-sm font-medium', config.color)}>
            {comparison.percentOfMedicare 
              ? `${comparison.percentOfMedicare}%`
              : '—'
            }
          </span>
        </div>

        {/* Status Badge */}
        <div className="w-24 shrink-0">
          <Badge className={cn('text-xs', config.bg, config.color)}>
            {config.emoji} {config.label}
          </Badge>
        </div>

        {/* Expand Icon */}
        <div className="w-6 shrink-0">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-3 pb-3 animate-fade-in">
          <div className={cn(
            'p-3 rounded-lg text-sm',
            config.bg
          )}>
            <p className={cn('font-medium mb-1', config.color)}>
              {comparison.message}
            </p>
            {comparison.localityName && (
              <p className="text-xs text-muted-foreground">
                Medicare rate based on: {comparison.localityName}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function MedicareLineItemTable({ comparisons }: MedicareLineItemTableProps) {
  const [showAll, setShowAll] = useState(false);
  const flaggedItems = comparisons.filter(c => c.status === 'high' || c.status === 'very_high');
  const displayItems = showAll ? comparisons : comparisons.slice(0, 5);

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-background/50">
      {/* Header */}
      <div className="bg-muted/20 px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span className="w-20">CPT Code</span>
          <span className="flex-1">Description</span>
          <span className="w-24 text-right">Charged</span>
          <span className="w-24 text-right">Medicare</span>
          <span className="w-16 text-right">%</span>
          <span className="w-24">Status</span>
          <span className="w-6" />
        </div>
      </div>

      {/* Rows */}
      <div>
        {displayItems.map((comparison, idx) => (
          <LineItemRow key={`${comparison.cptCode}-${idx}`} comparison={comparison} index={idx} />
        ))}
      </div>

      {/* Show More Button */}
      {comparisons.length > 5 && (
        <div className="p-2 border-t border-border/30 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-xs"
          >
            {showAll ? 'Show Less' : `Show ${comparisons.length - 5} More Items`}
          </Button>
        </div>
      )}
    </div>
  );
}
