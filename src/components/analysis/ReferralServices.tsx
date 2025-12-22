import { ExternalLink, Heart, Scale, Phone, Pill, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReferralContext, ReferralService, ReferralServiceType } from '@/types';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';

interface ReferralServicesProps {
  context: ReferralContext;
}

// Default referral services - these would come from backend in production
const DEFAULT_REFERRALS: ReferralService[] = [
  {
    id: 'pan',
    type: 'nonprofit_advocate',
    name: 'Patient Advocate Foundation',
    description: 'Free case management services for patients with chronic, debilitating, or life-threatening conditions',
    url: 'https://www.patientadvocate.org/',
    isPaid: false,
    isAffiliate: false,
    disclaimer: 'We are not paid by this organization.',
    showWhen: { complexDispute: true, denialPresent: true },
  },
  {
    id: 'dollar-for',
    type: 'nonprofit_advocate',
    name: 'Dollar For',
    description: 'Helps patients apply for hospital financial assistance and get medical bills reduced or eliminated',
    url: 'https://dollarfor.org/',
    isPaid: false,
    isAffiliate: false,
    disclaimer: 'We are not paid by this organization.',
    showWhen: { highBalance: true },
  },
  {
    id: 'nsa-help',
    type: 'legal_aid',
    name: 'No Surprises Help Desk',
    description: 'CMS resource for patients dealing with surprise medical bills and the No Surprises Act',
    url: 'https://www.cms.gov/nosurprises',
    isPaid: false,
    isAffiliate: false,
    disclaimer: 'Official government resource.',
    showWhen: { noSurprisesAct: true },
  },
  {
    id: 'resolve',
    type: 'negotiation_firm',
    name: 'Resolve Medical Bills',
    description: 'Professional medical bill negotiators who work on contingency - you only pay if they save you money',
    url: 'https://www.resolvemedicalbills.com/',
    isPaid: true,
    isAffiliate: true,
    disclaimer: 'Rosetta may receive a referral fee if you use this service.',
    showWhen: { highBalance: true },
  },
  {
    id: 'goodrx',
    type: 'rx_savings',
    name: 'GoodRx',
    description: 'Compare prescription prices and get coupons for up to 80% off at pharmacies near you',
    url: 'https://www.goodrx.com/',
    isPaid: false,
    isAffiliate: true,
    disclaimer: 'Rosetta may receive a referral fee if you use this service.',
    showWhen: {},
  },
];

const typeIcons: Record<ReferralServiceType, React.ReactNode> = {
  nonprofit_advocate: <Heart className="h-4 w-4" />,
  legal_aid: <Scale className="h-4 w-4" />,
  negotiation_firm: <Phone className="h-4 w-4" />,
  telehealth: <Stethoscope className="h-4 w-4" />,
  rx_savings: <Pill className="h-4 w-4" />,
};

const typeLabels: Record<ReferralServiceType, string> = {
  nonprofit_advocate: 'Nonprofit',
  legal_aid: 'Legal Aid',
  negotiation_firm: 'Paid Service',
  telehealth: 'Telehealth',
  rx_savings: 'Rx Savings',
};

function ReferralCard({ service }: { service: ReferralService }) {
  const handleClick = () => {
    window.open(service.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={cn(
      "p-4 rounded-xl border transition-all hover:border-primary/30",
      service.isPaid 
        ? "border-border/30 bg-muted/10" 
        : "border-mint/30 bg-gradient-to-br from-mint/5 to-transparent"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          service.isPaid ? "bg-muted/30 text-muted-foreground" : "bg-mint/20 text-mint"
        )}>
          {typeIcons[service.type]}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-medium text-sm text-foreground truncate">{service.name}</h4>
            <Badge 
              variant={service.isPaid ? "outline" : "secondary"} 
              className={cn(
                "text-[10px] shrink-0",
                !service.isPaid && "bg-mint/20 text-mint border-mint/30"
              )}
            >
              {typeLabels[service.type]}
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {service.description}
          </p>
          
          <div className="flex items-center justify-between gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClick}
              className="text-xs h-7"
            >
              Visit {service.name.split(' ')[0]}
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
          
          <p className="text-[10px] text-muted-foreground mt-2 italic">
            {service.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ReferralServices({ context }: ReferralServicesProps) {
  const { t } = useTranslation();

  if (!context.showReferrals) return null;

  // Filter services based on context
  const relevantServices = (context.recommendedServices.length > 0 
    ? context.recommendedServices 
    : DEFAULT_REFERRALS
  ).filter(service => {
    const conditions = service.showWhen;
    if (Object.keys(conditions).length === 0) return true;
    
    if (conditions.highBalance && context.isHighBalance) return true;
    if (conditions.complexDispute && context.hasComplexDispute) return true;
    if (conditions.denialPresent && context.hasDenial) return true;
    if (conditions.noSurprisesAct && context.hasNoSurprisesActScenario) return true;
    
    return false;
  });

  // Group by type
  const nonprofits = relevantServices.filter(s => s.type === 'nonprofit_advocate' || s.type === 'legal_aid');
  const paidServices = relevantServices.filter(s => s.type === 'negotiation_firm');
  const otherServices = relevantServices.filter(s => s.type === 'telehealth' || s.type === 'rx_savings');

  if (relevantServices.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-coral" />
        <h3 className="font-semibold text-foreground">Helpful Services You Can Consider</h3>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Based on your bill, these resources may be able to help. Links open in a new tab - we never share your data.
      </p>

      <div className="space-y-3">
        {/* Nonprofits first */}
        {nonprofits.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Free or Low-Cost Help
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {nonprofits.map(service => (
                <ReferralCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        )}

        {/* Paid services */}
        {paidServices.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Professional Services
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {paidServices.map(service => (
                <ReferralCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        )}

        {/* Other services */}
        {otherServices.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Additional Resources
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {otherServices.map(service => (
                <ReferralCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border/20">
        Rosetta does not guarantee outcomes from these services. Links are provided for informational purposes only.
      </p>
    </div>
  );
}
