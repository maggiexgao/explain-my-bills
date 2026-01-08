import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, HelpCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReviewItem } from '@/types';

interface ThingsWorthReviewingSectionProps {
  items: ReviewItem[];
  reviewSectionNote?: string;
}

const issueTypeConfig = {
  error: {
    icon: <AlertCircle className="h-4 w-4" />,
    bg: 'bg-destructive/5',
    border: 'border-destructive/30',
    iconColor: 'text-destructive',
    badge: 'bg-destructive/10 text-destructive',
    label: 'Possible Error',
  },
  negotiable: {
    icon: <AlertTriangle className="h-4 w-4" />,
    bg: 'bg-warning/5',
    border: 'border-warning/30',
    iconColor: 'text-warning',
    badge: 'bg-warning/10 text-warning-foreground',
    label: 'Negotiable',
  },
  missing_info: {
    icon: <HelpCircle className="h-4 w-4" />,
    bg: 'bg-info/5',
    border: 'border-info/30',
    iconColor: 'text-info',
    badge: 'bg-info/10 text-info',
    label: 'Missing Info',
  },
  confirmation: {
    icon: <CheckCircle className="h-4 w-4" />,
    bg: 'bg-muted/30',
    border: 'border-border/30',
    iconColor: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground',
    label: 'Worth Confirming',
  },
};

function ReviewItemCard({ item }: { item: ReviewItem }) {
  const config = issueTypeConfig[item.issueType] || issueTypeConfig.confirmation;

  return (
    <div className={cn('p-4 rounded-xl border', config.bg, config.border)}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 shrink-0', config.iconColor)}>
          {config.icon}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium text-foreground">{item.whatToReview}</h4>
            <Badge className={cn('shrink-0 text-xs', config.badge)}>
              {config.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {item.whyItMatters}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ThingsWorthReviewingSection({ items, reviewSectionNote }: ThingsWorthReviewingSectionProps) {
  if (items.length === 0 && !reviewSectionNote) {
    return (
      <div className="p-5 rounded-xl bg-success/10 border border-success/30">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Nothing stands out</p>
            <p className="text-sm text-muted-foreground">
              Based on what we can see, this bill appears straightforward. You can still request an itemized bill or your EOB to confirm accuracy.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <ReviewItemCard key={idx} item={item} />
      ))}
      
      {reviewSectionNote && (
        <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
          <p className="text-sm text-muted-foreground">{reviewSectionNote}</p>
        </div>
      )}
    </div>
  );
}
