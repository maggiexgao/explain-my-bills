/**
 * NegotiabilityCategorySection - Groups services by category and shows negotiability ratings
 * Categories: ER Visit, Laboratory, IV Therapy, Medications, Supplies, etc.
 * Each category shows: total billed, Medicare reference, negotiability rating with tip
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BenchmarkLineResult } from '@/lib/medicareBenchmarkService';
import { CollapsibleGroup } from './CollapsibleGroup';

interface NegotiabilityCategorySectionProps {
  lineItems: BenchmarkLineResult[];
}

type NegotiabilityRating = 'highly' | 'often' | 'sometimes' | 'rarely';

interface CategoryData {
  name: string;
  items: BenchmarkLineResult[];
  totalBilled: number;
  medicareRef: number | null;
  rating: NegotiabilityRating;
  tip: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Rating configuration
const ratingConfig: Record<NegotiabilityRating, { 
  label: string;
  color: string;
  bg: string;
  barColor: string;
}> = {
  highly: { 
    label: 'Highly Negotiable', 
    color: 'text-success', 
    bg: 'bg-success/10',
    barColor: 'bg-success'
  },
  often: { 
    label: 'Often Negotiable', 
    color: 'text-teal-600', 
    bg: 'bg-teal-500/10',
    barColor: 'bg-teal-500'
  },
  sometimes: { 
    label: 'Sometimes Negotiable', 
    color: 'text-warning', 
    bg: 'bg-warning/10',
    barColor: 'bg-warning'
  },
  rarely: { 
    label: 'Rarely Negotiable', 
    color: 'text-muted-foreground', 
    bg: 'bg-muted/30',
    barColor: 'bg-muted-foreground'
  },
};

// Category patterns and their negotiability
const categoryPatterns: Array<{
  pattern: RegExp;
  name: string;
  rating: NegotiabilityRating;
  tip: string;
}> = [
  {
    pattern: /emerg|er visit|ed visit|emergency room|emergency dept/i,
    name: 'ER Visit',
    rating: 'sometimes',
    tip: 'ER facility fees have high markup but are often negotiable, especially at non-profit hospitals. Ask about charity care programs.',
  },
  {
    pattern: /lab|blood|culture|panel|urinalysis|cbc|cmp|lipid|hba1c|glucose|specimen/i,
    name: 'Laboratory',
    rating: 'highly',
    tip: 'Labs have very high markup (often 10-20x). Ask for cash pricing or use Quest/LabCorp directly for future tests.',
  },
  {
    pattern: /iv\s|iv infusion|infusion|saline|lactated|fluids|hydration/i,
    name: 'IV Therapy',
    rating: 'often',
    tip: 'IV fluid charges are frequently marked up significantly. Ask if a "hydration" charge was necessary for your condition.',
  },
  {
    pattern: /inject|drug|medication|pharm|rx|j\d{4}|hcpcs j/i,
    name: 'Medications',
    rating: 'sometimes',
    tip: 'Hospital drug prices are often 5-10x retail. Ask for a generic equivalent or if you could have gotten a prescription instead.',
  },
  {
    pattern: /supply|supplies|dressing|bandage|gauze|kit|tray|suture/i,
    name: 'Supplies',
    rating: 'highly',
    tip: 'Supply charges are heavily marked up. Question charges for items like "mucous recovery systems" (tissues) or basic bandages.',
  },
  {
    pattern: /x-?ray|imaging|ct|mri|radiol|ultrasound|scan/i,
    name: 'Imaging',
    rating: 'sometimes',
    tip: 'Imaging charges vary widely. Get quotes from outpatient imaging centers for future scans - often 50-80% cheaper.',
  },
  {
    pattern: /ekg|ecg|electrocard|cardiac|heart monitor/i,
    name: 'Cardiac Tests',
    rating: 'sometimes',
    tip: 'EKG interpretation fees are sometimes billed separately from the technical component. Ask if both were necessary.',
  },
  {
    pattern: /eval|exam|visit|consult|99\d{3}|physician|doctor|provider/i,
    name: 'Physician Services',
    rating: 'rarely',
    tip: 'Physician fees are set by individual doctors and harder to negotiate. Focus negotiation efforts on facility fees instead.',
  },
  {
    pattern: /therapy|pt|ot|physical|occupational|rehab/i,
    name: 'Therapy Services',
    rating: 'sometimes',
    tip: 'Therapy charges are often per unit (15 min). Verify the number of units matches your treatment time.',
  },
];

function categorizeItems(items: BenchmarkLineResult[]): CategoryData[] {
  const categoryMap = new Map<string, {
    name: string;
    items: BenchmarkLineResult[];
    rating: NegotiabilityRating;
    tip: string;
  }>();
  
  const otherItems: BenchmarkLineResult[] = [];
  
  for (const item of items) {
    const desc = item.description?.toLowerCase() || '';
    const code = item.hcpcs?.toUpperCase() || '';
    const combined = `${desc} ${code}`;
    
    let matched = false;
    for (const cat of categoryPatterns) {
      if (cat.pattern.test(combined)) {
        const existing = categoryMap.get(cat.name);
        if (existing) {
          existing.items.push(item);
        } else {
          categoryMap.set(cat.name, {
            name: cat.name,
            items: [item],
            rating: cat.rating,
            tip: cat.tip,
          });
        }
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      otherItems.push(item);
    }
  }
  
  // Add "Other" category if there are unmatched items
  if (otherItems.length > 0) {
    categoryMap.set('Other Services', {
      name: 'Other Services',
      items: otherItems,
      rating: 'sometimes',
      tip: 'Ask for an itemized bill with full descriptions to better understand these charges.',
    });
  }
  
  // Convert to array and calculate totals
  const categories: CategoryData[] = [];
  for (const [_, cat] of categoryMap) {
    const totalBilled = cat.items.reduce((sum, i) => sum + (i.billedAmount || 0), 0);
    const matchedItems = cat.items.filter(i => i.medicareReferenceTotal && i.medicareReferenceTotal > 0);
    const medicareRef = matchedItems.length > 0
      ? matchedItems.reduce((sum, i) => sum + (i.medicareReferenceTotal || 0), 0)
      : null;
    
    categories.push({
      name: cat.name,
      items: cat.items,
      totalBilled,
      medicareRef,
      rating: cat.rating,
      tip: cat.tip,
    });
  }
  
  // Sort by total billed descending
  categories.sort((a, b) => b.totalBilled - a.totalBilled);
  
  return categories;
}

function CategoryCard({ category }: { category: CategoryData }) {
  const [expanded, setExpanded] = useState(false);
  const config = ratingConfig[category.rating];
  const multiple = category.medicareRef && category.medicareRef > 0
    ? (category.totalBilled / category.medicareRef).toFixed(1)
    : null;
  
  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      config.bg,
      "border-border/30"
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-4 text-left hover:bg-muted/10 transition-colors"
      >
        {/* Rating Bar */}
        <div className={cn("w-1.5 h-10 rounded-full", config.barColor)} />
        
        {/* Category Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{category.name}</p>
          <p className="text-xs text-muted-foreground">
            {category.items.length} item{category.items.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Amounts */}
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-foreground">
            {formatCurrency(category.totalBilled)}
          </p>
          {category.medicareRef && (
            <p className="text-xs text-muted-foreground">
              vs {formatCurrency(category.medicareRef)} Medicare
              {multiple && <span className="ml-1">({multiple}×)</span>}
            </p>
          )}
        </div>
        
        {/* Rating Badge */}
        <Badge 
          variant="outline" 
          className={cn("text-xs shrink-0", config.bg, config.color)}
        >
          {config.label}
        </Badge>
        
        {/* Expand Icon */}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      
      {expanded && (
        <div className="px-4 pb-3 pt-0">
          {/* Tip */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-background/60 border border-border/30">
            <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              {category.tip}
            </p>
          </div>
          
          {/* Item List */}
          <div className="mt-3 space-y-1">
            {category.items.map((item, idx) => (
              <div 
                key={`${item.hcpcs}-${idx}`}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/10 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <code className="font-mono text-muted-foreground">{item.hcpcs}</code>
                  <span className="text-foreground truncate">{item.description}</span>
                </div>
                <span className="font-medium shrink-0 ml-2">
                  {item.billedAmount ? formatCurrency(item.billedAmount) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function NegotiabilityCategorySection({ lineItems }: NegotiabilityCategorySectionProps) {
  const categories = categorizeItems(lineItems);
  
  if (categories.length === 0) {
    return null;
  }
  
  // Count highly/often negotiable categories
  const highlyNegotiableCount = categories.filter(c => 
    c.rating === 'highly' || c.rating === 'often'
  ).length;
  
  return (
    <CollapsibleGroup
      title="Negotiability by Category"
      subtitle={highlyNegotiableCount > 0 
        ? `${highlyNegotiableCount} categor${highlyNegotiableCount === 1 ? 'y' : 'ies'} with good negotiation potential`
        : 'See what may be negotiable'
      }
      icon={<Lightbulb className="h-4 w-4" />}
      iconClassName="bg-success/20 text-success"
      badge={
        highlyNegotiableCount > 0 && (
          <Badge className="bg-success/10 text-success text-[10px] px-1.5 py-0">
            {highlyNegotiableCount} opportunities
          </Badge>
        )
      }
      defaultOpen={false}
      infoTooltip="Services grouped by type with tips on which categories are typically most negotiable"
    >
      <div className="space-y-2">
        {categories.map((category, idx) => (
          <CategoryCard key={category.name} category={category} />
        ))}
      </div>
    </CollapsibleGroup>
  );
}
