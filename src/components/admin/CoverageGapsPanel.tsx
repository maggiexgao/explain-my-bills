/**
 * Coverage & Gaps Panel
 * 
 * Admin diagnostic panel showing:
 * - What data is ingested
 * - What the app can price right now
 * - Known unavoidable gaps
 * - Live gap detection recommendations
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Database, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileSpreadsheet,
  Stethoscope,
  Building2,
  Package,
  Apple,
  MapPin,
  ArrowRight,
  RefreshCw,
  Loader2,
  Download,
  HelpCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface DatasetInfo {
  name: string;
  description: string;
  coverage: string;
  yearVersion: string;
  rowCount: number;
  uniqueCodes: number;
  lastUpdated: string | null;
  status: 'loaded' | 'partial' | 'missing';
  icon: React.ElementType;
}

interface CapabilityItem {
  name: string;
  description: string;
  dataset: string;
  canPrice: boolean;
  notes?: string;
}

interface GapType {
  type: string;
  description: string;
  userMessage: string;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
}

export function CoverageGapsPanel() {
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>([]);
  const [gaps, setGaps] = useState<GapType[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    try {
      // Parallel queries for all datasets
      const [
        mpfsResult,
        gpciResult,
        zipResult,
        oppsResult,
        dmeposResult,
        dmepenResult
      ] = await Promise.all([
        supabase.from('mpfs_benchmarks').select('hcpcs, created_at', { count: 'exact' }).limit(1),
        supabase.from('gpci_localities').select('locality_num, created_at', { count: 'exact' }).limit(1),
        supabase.from('zip_to_locality').select('zip5, updated_at', { count: 'exact' }).limit(1),
        supabase.from('opps_addendum_b').select('hcpcs, created_at', { count: 'exact' }).limit(1),
        supabase.from('dmepos_fee_schedule').select('hcpcs, created_at', { count: 'exact' }).limit(1),
        supabase.from('dmepen_fee_schedule').select('hcpcs, created_at', { count: 'exact' }).limit(1),
      ]);

      // Get unique code counts
      const [mpfsUnique, oppsUnique, dmeposUnique, dmepenUnique] = await Promise.all([
        supabase.from('mpfs_benchmarks').select('hcpcs').limit(20000),
        supabase.from('opps_addendum_b').select('hcpcs').limit(20000),
        supabase.from('dmepos_fee_schedule').select('hcpcs').limit(20000),
        supabase.from('dmepen_fee_schedule').select('hcpcs').limit(20000),
      ]);

      const getStatus = (count: number | null): 'loaded' | 'partial' | 'missing' => {
        if (!count || count === 0) return 'missing';
        return 'loaded';
      };

      const formatDate = (dateStr?: string) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString();
      };

      const datasetList: DatasetInfo[] = [
        {
          name: 'MPFS',
          description: 'Medicare Physician Fee Schedule — professional services pricing',
          coverage: 'CPT 00000-99999, HCPCS professional',
          yearVersion: '2026',
          rowCount: mpfsResult.count || 0,
          uniqueCodes: new Set(mpfsUnique.data?.map(r => r.hcpcs) || []).size,
          lastUpdated: formatDate(mpfsResult.data?.[0]?.created_at),
          status: getStatus(mpfsResult.count),
          icon: Stethoscope
        },
        {
          name: 'GPCI',
          description: 'Geographic Practice Cost Indices — locality adjustments',
          coverage: 'All Medicare localities',
          yearVersion: '2026',
          rowCount: gpciResult.count || 0,
          uniqueCodes: 0,
          lastUpdated: formatDate(gpciResult.data?.[0]?.created_at),
          status: getStatus(gpciResult.count),
          icon: MapPin
        },
        {
          name: 'ZIP Crosswalk',
          description: 'ZIP to Medicare Locality mapping',
          coverage: 'All US ZIP codes',
          yearVersion: '2026',
          rowCount: zipResult.count || 0,
          uniqueCodes: 0,
          lastUpdated: formatDate(zipResult.data?.[0]?.updated_at),
          status: getStatus(zipResult.count),
          icon: MapPin
        },
        {
          name: 'OPPS Addendum B',
          description: 'Hospital Outpatient PPS — facility payment rates',
          coverage: 'Hospital outpatient HCPCS/APC',
          yearVersion: '2025',
          rowCount: oppsResult.count || 0,
          uniqueCodes: new Set(oppsUnique.data?.map(r => r.hcpcs) || []).size,
          lastUpdated: formatDate(oppsResult.data?.[0]?.created_at),
          status: getStatus(oppsResult.count),
          icon: Building2
        },
        {
          name: 'DMEPOS',
          description: 'Durable Medical Equipment fee schedule',
          coverage: 'A/E/K/L codes',
          yearVersion: '2026',
          rowCount: dmeposResult.count || 0,
          uniqueCodes: new Set(dmeposUnique.data?.map(r => r.hcpcs) || []).size,
          lastUpdated: formatDate(dmeposResult.data?.[0]?.created_at),
          status: getStatus(dmeposResult.count),
          icon: Package
        },
        {
          name: 'DMEPEN',
          description: 'Enteral/Parenteral Nutrition supplies',
          coverage: 'B codes',
          yearVersion: '2026',
          rowCount: dmepenResult.count || 0,
          uniqueCodes: new Set(dmepenUnique.data?.map(r => r.hcpcs) || []).size,
          lastUpdated: formatDate(dmepenResult.data?.[0]?.created_at),
          status: getStatus(dmepenResult.count),
          icon: Apple
        },
      ];

      setDatasets(datasetList);

      // Build capabilities matrix
      const caps: CapabilityItem[] = [
        {
          name: 'Professional physician services',
          description: 'Office visits, consultations, procedures',
          dataset: 'MPFS',
          canPrice: mpfsResult.count ? mpfsResult.count > 0 : false,
        },
        {
          name: 'Hospital outpatient facility fees',
          description: 'Facility charges for outpatient services',
          dataset: 'OPPS',
          canPrice: oppsResult.count ? oppsResult.count > 0 : false,
          notes: '2025 data; hospital-specific adjustments not included'
        },
        {
          name: 'Durable medical equipment',
          description: 'Wheelchairs, CPAP, orthotics, prosthetics',
          dataset: 'DMEPOS',
          canPrice: dmeposResult.count ? dmeposResult.count > 0 : false,
        },
        {
          name: 'Enteral/parenteral nutrition',
          description: 'Tube feeding, IV nutrition supplies',
          dataset: 'DMEPEN',
          canPrice: dmepenResult.count ? dmepenResult.count > 0 : false,
        },
        {
          name: 'Location-based pricing',
          description: 'GPCI-adjusted fees by locality',
          dataset: 'GPCI + ZIP',
          canPrice: (gpciResult.count && gpciResult.count > 0) && (zipResult.count && zipResult.count > 0),
        },
        {
          name: 'Code inference from descriptions',
          description: 'Reverse search when CPT not visible',
          dataset: 'MPFS + OPPS + DMEPOS',
          canPrice: true,
          notes: 'Lower confidence than direct code matching'
        },
      ];

      setCapabilities(caps);

      // Known gaps
      const gapList: GapType[] = [
        {
          type: 'Bundled/packaged services',
          description: 'Services with no separate Medicare payment (packaged under OPPS, bundled globally)',
          userMessage: 'This service is bundled with another service and doesn\'t have a separate reference price.',
        },
        {
          type: 'Inpatient DRG pricing',
          description: 'Hospital inpatient stays are paid by DRG, not per-service',
          userMessage: 'Inpatient hospital stays use a different payment system (DRG) that we don\'t currently cover.',
        },
        {
          type: 'Clinical lab (CLFS)',
          description: 'Clinical Laboratory Fee Schedule codes (80000-89999)',
          userMessage: 'Lab test pricing uses a separate fee schedule we\'re adding soon.',
        },
        {
          type: 'Drug pricing (ASP/NDC)',
          description: 'Injectable drugs, infusion drugs priced by ASP or NDC',
          userMessage: 'Drug pricing varies by acquisition cost and isn\'t in our current dataset.',
        },
        {
          type: 'ASC facility fees',
          description: 'Ambulatory Surgery Center fee schedule',
          userMessage: 'Surgery center facility fees use a different schedule than hospital outpatient.',
        },
        {
          type: 'Modifiers affecting payment',
          description: 'Some modifiers reduce or increase payment (e.g., -50 bilateral)',
          userMessage: 'Modifier-specific adjustments may not be fully reflected.',
        },
      ];

      setGaps(gapList);

      // Recommendations based on data state
      const recs: Recommendation[] = [];
      
      if (!oppsResult.count || oppsResult.count === 0) {
        recs.push({
          priority: 'high',
          title: 'Add OPPS Addendum B',
          description: 'Hospital outpatient services are common and need facility fee references',
          impact: 'Enable hospital outpatient pricing for ~10,000 codes'
        });
      }
      
      if (mpfsResult.count && mpfsResult.count > 0) {
        recs.push({
          priority: 'medium',
          title: 'Add Clinical Lab Fee Schedule (CLFS)',
          description: 'Lab codes (80000-89999) are frequently billed but not in MPFS',
          impact: 'Cover ~1,000 additional lab test codes'
        });
      }
      
      recs.push({
        priority: 'medium',
        title: 'Add Average Sales Price (ASP) for drugs',
        description: 'Injectable drugs (J-codes) often have high markups worth comparing',
        impact: 'Enable drug pricing comparison for infusion and injection services'
      });
      
      recs.push({
        priority: 'low',
        title: 'Add ASC Fee Schedule',
        description: 'Ambulatory Surgery Centers have different rates than hospital outpatient',
        impact: 'More accurate comparisons for surgery center bills'
      });

      setRecommendations(recs);

    } catch (error) {
      console.error('Error loading coverage data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const exportAsJson = () => {
    const exportData = {
      generatedAt: new Date().toISOString(),
      datasets,
      capabilities,
      knownGaps: gaps,
      recommendations
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coverage-gaps-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Coverage & Gaps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const loadedCount = datasets.filter(d => d.status === 'loaded').length;
  const canPriceCount = capabilities.filter(c => c.canPrice).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Coverage & Gaps
            </CardTitle>
            <CardDescription>
              Data coverage analysis and gap recommendations
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportAsJson}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Section A: What Data Is Ingested */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            A) What Data Is Ingested
            <Badge variant="outline" className="ml-2">{loadedCount}/{datasets.length} loaded</Badge>
          </h3>
          <div className="grid gap-2">
            {datasets.map(ds => (
              <div 
                key={ds.name}
                className={cn(
                  'p-3 rounded-lg border flex items-center gap-3',
                  ds.status === 'loaded' ? 'bg-success/5 border-success/30' : 'bg-destructive/5 border-destructive/30'
                )}
              >
                <ds.icon className={cn('h-5 w-5', ds.status === 'loaded' ? 'text-success' : 'text-destructive')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ds.name}</span>
                    <Badge variant="outline" className="text-[10px]">{ds.yearVersion}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{ds.description}</p>
                </div>
                <div className="text-right text-xs shrink-0">
                  {ds.status === 'loaded' ? (
                    <>
                      <div className="text-success flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {ds.rowCount.toLocaleString()} rows
                      </div>
                      {ds.uniqueCodes > 0 && (
                        <div className="text-muted-foreground">{ds.uniqueCodes.toLocaleString()} codes</div>
                      )}
                    </>
                  ) : (
                    <div className="text-destructive flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Not loaded
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section B: What We Can Price */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            B) What The App Can Price
            <Badge variant="outline" className="ml-2">{canPriceCount}/{capabilities.length} enabled</Badge>
          </h3>
          <div className="grid gap-2">
            {capabilities.map(cap => (
              <div 
                key={cap.name}
                className={cn(
                  'p-3 rounded-lg border flex items-center gap-3',
                  cap.canPrice ? 'bg-success/5 border-success/30' : 'bg-muted/30 border-border/30'
                )}
              >
                {cap.canPrice ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-sm">{cap.name}</div>
                  <p className="text-xs text-muted-foreground">{cap.description}</p>
                  {cap.notes && (
                    <p className="text-xs text-warning mt-1">⚠ {cap.notes}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{cap.dataset}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Section C: Known Unavoidable Gaps */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            C) Known Gaps (How We Message Them)
          </h3>
          <div className="grid gap-2">
            {gaps.map(gap => (
              <div key={gap.type} className="p-3 rounded-lg border border-warning/30 bg-warning/5">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">{gap.type}</div>
                    <p className="text-xs text-muted-foreground mb-1">{gap.description}</p>
                    <div className="text-xs bg-background/50 p-2 rounded border border-border/30 italic">
                      User sees: "{gap.userMessage}"
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section D: Live Gap Detection (placeholder for future) */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Database className="h-4 w-4" />
            D) Live Gap Detection
            <Badge variant="outline" className="text-xs bg-muted/30">Coming Soon</Badge>
          </h3>
          <div className="p-4 rounded-lg bg-muted/20 border border-border/30 text-center text-sm text-muted-foreground">
            <p>Live usage-based gap detection requires storing analysis logs.</p>
            <p className="text-xs mt-1">This will show: top missing codes, unmatched descriptions, and extraction success rates.</p>
          </div>
        </div>

        {/* Section E: Recommendations */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            E) Recommended Next Data Sources
          </h3>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div 
                key={i}
                className={cn(
                  'p-3 rounded-lg border flex items-start gap-3',
                  rec.priority === 'high' ? 'border-destructive/30 bg-destructive/5' :
                  rec.priority === 'medium' ? 'border-warning/30 bg-warning/5' :
                  'border-border/30 bg-muted/5'
                )}
              >
                <Badge 
                  variant="outline" 
                  className={cn(
                    'text-[10px] shrink-0 mt-0.5',
                    rec.priority === 'high' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                    rec.priority === 'medium' ? 'bg-warning/10 text-warning border-warning/30' :
                    'bg-muted'
                  )}
                >
                  {rec.priority}
                </Badge>
                <div>
                  <div className="font-medium text-sm">{rec.title}</div>
                  <p className="text-xs text-muted-foreground">{rec.description}</p>
                  <p className="text-xs text-primary mt-1">Impact: {rec.impact}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
      </CardContent>
    </Card>
  );
}
