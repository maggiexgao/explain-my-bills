import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NegotiabilityItem, NegotiabilityLevel } from '@/types';

interface NegotiabilitySectionProps {
  items: NegotiabilityItem[];
}

const levelConfig: Record<NegotiabilityLevel, { icon: React.ReactNode; bg: string; badge: string; label: string }> = {
  highly_negotiable: {
    icon: <TrendingDown className="h-4 w-4 text-success" />,
    bg: 'bg-success/5 border-success/20',
    badge: 'bg-success/10 text-success',
    label: 'Highly Negotiable',
  },
  sometimes_negotiable: {
    icon: <TrendingDown className="h-4 w-4 text-warning" />,
    bg: 'bg-warning/5 border-warning/20',
    badge: 'bg-warning/10 text-warning-foreground',
    label: 'Sometimes Negotiable',
  },
  rarely_negotiable: {
    icon: <Minus className="h-4 w-4 text-muted-foreground" />,
    bg: 'bg-muted/20 border-border/30',
    badge: 'bg-muted text-muted-foreground',
    label: 'Rarely Negotiable',
  },
  generally_fixed: {
    icon: <TrendingUp className="h-4 w-4 text-destructive" />,
    bg: 'bg-destructive/5 border-destructive/20',
    badge: 'bg-destructive/10 text-destructive',
    label: 'Generally Fixed',
  },
};

function NegotiabilityCard({ item }: { item: NegotiabilityItem }) {
  const config = levelConfig[item.level] || levelConfig.sometimes_negotiable;

  return (
    <div className={cn('p-4 rounded-xl border', config.bg)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {config.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-medium text-foreground">{item.chargeOrCategory}</h4>
            <Badge className={cn('shrink-0 text-xs', config.badge)}>
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{item.reason}</p>
        </div>
      </div>
    </div>
  );
}

export function NegotiabilitySection({ items }: NegotiabilitySectionProps) {
  if (items.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
        <p className="text-sm text-muted-foreground">
          Negotiability information not available for this bill. Generally, hospital charges are more negotiable than physician fees.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <NegotiabilityCard key={idx} item={item} />
      ))}
    </div>
  );
}
