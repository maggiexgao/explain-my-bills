/**
 * BillOverviewSection - Shows a quick summary at the top of the analysis
 * Displays: what type of visit, provider name, date, and total billed
 */

import { AnalysisResult } from '@/types';
import { Info } from 'lucide-react';

interface BillOverviewProps {
  analysis: AnalysisResult;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function detectVisitType(analysis: AnalysisResult): string {
  const codes: string[] = [];
  
  // Collect all codes from charges
  if (analysis.charges) {
    for (const c of analysis.charges) {
      const code = c.code || '';
      if (code) codes.push(code);
    }
  }
  
  // Also check chargeMeanings for CPT codes
  if (analysis.chargeMeanings) {
    for (const cm of analysis.chargeMeanings) {
      if (cm.cptCode) codes.push(cm.cptCode);
    }
  }
  
  // Check for ER codes
  const erCodes = ['99281', '99282', '99283', '99284', '99285'];
  if (codes.some(c => erCodes.includes(c))) {
    return 'an emergency room visit';
  }
  
  // Check for inpatient
  if (codes.some(c => c.startsWith('99221') || c.startsWith('99222') || c.startsWith('99223'))) {
    return 'an inpatient hospital stay';
  }
  
  // Check for imaging
  if (codes.some(c => c.startsWith('7') && c.length === 5)) {
    return 'imaging services';
  }
  
  // Check for surgery (codes 10000-69999)
  if (codes.some(c => /^[1-6]\d{4}$/.test(c))) {
    return 'medical procedures';
  }
  
  // Check for office visits
  if (codes.some(c => c.startsWith('9921') || c.startsWith('9920'))) {
    return 'a doctor\'s office visit';
  }
  
  // Check for lab tests (80000-89999)
  if (codes.some(c => c.startsWith('8'))) {
    return 'laboratory services';
  }
  
  return 'medical services';
}

function formatDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  
  // Try to parse common date formats
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }
  
  return dateStr;
}

export function BillOverviewSection({ analysis }: BillOverviewProps) {
  // Try multiple sources for issuer/provider name
  const issuer = analysis.issuer && analysis.issuer !== 'Unknown Provider' 
    ? analysis.issuer 
    : (analysis as any).providerName 
    || (analysis as any).facilityName 
    || (analysis as any).providerContactInfo?.providerName
    || (analysis as any).providerAssistance?.providerName
    || 'a healthcare provider';
  
  const dateOfService = analysis.dateOfService;
  const formattedDate = formatDate(dateOfService);
  
  // Get total - try multiple sources
  const total = analysis.atAGlance?.totalBilled || 
                analysis.billTotal ||
                (analysis.charges?.reduce((sum, c) => sum + (c.amount || c.billed || 0), 0)) ||
                0;
  
  const visitType = detectVisitType(analysis);
  
  return (
    <div className="bg-card rounded-xl p-4 shadow-sm border border-border/40 mb-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Info className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-foreground leading-relaxed">
            This is a bill for <span className="font-semibold">{visitType}</span>{' '}
            at <span className="font-semibold">{issuer}</span>
            {formattedDate && (
              <> on <span className="font-medium">{formattedDate}</span></>
            )}.
            {total > 0 && (
              <> Total billed: <span className="font-bold text-primary">{formatCurrency(total)}</span>.</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
