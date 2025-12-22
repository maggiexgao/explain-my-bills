import { useState } from 'react';
import { FileText, Download, Check, ArrowRight, Shield, Clock, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DisputePackageEligibility, AnalysisResult } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageContext';

interface DisputePackageUpsellProps {
  eligibility: DisputePackageEligibility;
  analysis: AnalysisResult;
  onPurchase?: () => void;
}

const PACKAGE_PRICE = 19.99;

export function DisputePackageUpsell({ eligibility, analysis, onPurchase }: DisputePackageUpsellProps) {
  const { t } = useTranslation();
  const [isPurchased, setIsPurchased] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!eligibility.eligible) return null;

  const handlePurchase = async () => {
    // For now, simulate purchase flow - in production this would integrate with Stripe
    toast.info('Payment integration coming soon. For now, generating your free preview...');
    setIsGenerating(true);
    
    // Simulate generation delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsPurchased(true);
    setIsGenerating(false);
    toast.success('Your Dispute Package is ready!');
    onPurchase?.();
  };

  const handleDownload = () => {
    // Generate and download the dispute package
    toast.info('Generating your dispute package...');
    
    // Create a summary document with all the details
    const packageContent = generatePackageContent(analysis, eligibility);
    
    // Create a blob and trigger download
    const blob = new Blob([packageContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispute-package-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Dispute package downloaded!');
  };

  if (isPurchased) {
    return (
      <div className="p-5 rounded-2xl border-2 border-mint/50 bg-gradient-to-br from-mint/10 to-mint/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint/20">
            <Check className="h-5 w-5 text-mint" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Your Dispute Package is Ready</h3>
            <p className="text-sm text-muted-foreground">Download your personalized dispute documents</p>
          </div>
        </div>
        
        <Button onClick={handleDownload} className="w-full bg-mint hover:bg-mint/90 text-mint-foreground">
          <Download className="h-4 w-4 mr-2" />
          Download Dispute Package
        </Button>
        
        <p className="text-xs text-muted-foreground text-center mt-3">
          A copy has also been sent to your email
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/20 to-transparent rounded-bl-full pointer-events-none" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl accent-gradient shadow-glow">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">Guided Dispute Package</h3>
              <Badge variant="secondary" className="text-xs">Recommended</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Ready-to-send letters and step-by-step dispute checklist for this bill
            </p>
          </div>
        </div>

        {/* Why we recommend this */}
        {eligibility.reasons.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-background/50 border border-border/30">
            <p className="text-xs font-medium text-foreground mb-2">Why we recommend this:</p>
            <ul className="space-y-1.5">
              {eligibility.reasons.slice(0, 3).map((reason, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <ArrowRight className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* What's included */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/30">
            <FileCheck className="h-4 w-4 text-primary" />
            <span className="text-xs text-foreground">Formal Letters</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/30">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xs text-foreground">Legal References</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/30">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-xs text-foreground">Action Timeline</span>
          </div>
        </div>

        {/* Price and CTA */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-bold text-foreground">${PACKAGE_PRICE}</p>
            <p className="text-xs text-muted-foreground">One-time fee</p>
          </div>
          <Button 
            onClick={handlePurchase} 
            disabled={isGenerating}
            className="flex-1 sm:flex-initial accent-gradient hover:opacity-90 text-white"
          >
            {isGenerating ? (
              <>Generating...</>
            ) : (
              <>
                Get Your Package
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-3">
          This package provides templates and guidance. It is not legal advice. Consult an attorney for legal matters.
        </p>
      </div>
    </div>
  );
}

function generatePackageContent(analysis: AnalysisResult, eligibility: DisputePackageEligibility): string {
  const date = new Date().toLocaleDateString();
  const provider = analysis.providerContactInfo?.providerName || 'Healthcare Provider';
  const dateOfService = analysis.dateOfService || '[DATE OF SERVICE]';
  
  let content = `
================================================================================
                         GUIDED DISPUTE PACKAGE
                         Generated: ${date}
================================================================================

DOCUMENT SUMMARY
----------------
Provider: ${provider}
Date of Service: ${dateOfService}
Document Type: ${analysis.documentType}

ISSUES IDENTIFIED
-----------------
${eligibility.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

================================================================================
                    LETTER 1: TO BILLING DEPARTMENT
================================================================================

${analysis.providerContactInfo?.providerName || '[PROVIDER NAME]'}
Billing Department
${analysis.providerContactInfo?.mailingAddress || '[ADDRESS]'}

Date: ${date}

RE: Dispute of Charges - Date of Service: ${dateOfService}

Dear Billing Department,

I am writing to formally dispute charges on my account for services rendered on ${dateOfService}.

After careful review of my billing statement, I have identified the following concerns:

${analysis.potentialErrors?.map((e, i) => `${i + 1}. ${e.title}: ${e.description}`).join('\n\n') || 'See attached documentation for specific concerns.'}

I respectfully request that you:
1. Provide a detailed, itemized bill with all CPT codes and charges
2. Review the charges listed above for accuracy
3. Provide documentation supporting the appropriateness of these charges
4. Apply any applicable adjustments to my account

${analysis.eobData ? `My Explanation of Benefits shows a patient responsibility of $${analysis.eobData.patientResponsibility}, which may differ from your statement.` : ''}

Please respond to this dispute within 30 days as required by the Fair Debt Collection Practices Act.

Thank you for your prompt attention to this matter.

Sincerely,
[YOUR NAME]
[YOUR ADDRESS]
[YOUR PHONE NUMBER]
[ACCOUNT NUMBER]

================================================================================
                    LETTER 2: TO INSURANCE COMPANY
================================================================================

${analysis.providerContactInfo?.insurerName || '[INSURANCE COMPANY]'}
Member Services
${analysis.providerContactInfo?.memberServicesPhone ? `Phone: ${analysis.providerContactInfo.memberServicesPhone}` : ''}

Date: ${date}

RE: Request for Claim Review - Date of Service: ${dateOfService}

Dear Member Services,

I am writing to request a review of the claim processing for services received on ${dateOfService} from ${provider}.

After reviewing my Explanation of Benefits and the provider's bill, I have concerns about:

${analysis.needsAttention?.map((e, i) => `${i + 1}. ${e.title}: ${e.description}`).join('\n\n') || 'The processing of this claim and patient responsibility calculation.'}

I request that you:
1. Re-review this claim for proper coding and coverage determination
2. Verify that all applicable benefits were applied
3. Confirm the allowed amount and patient responsibility calculation
4. Provide a detailed explanation of any denials or adjustments

Please respond within 30 days with your findings.

Sincerely,
[YOUR NAME]
Member ID: [YOUR MEMBER ID]
[YOUR ADDRESS]
[YOUR PHONE NUMBER]

================================================================================
                    ATTACHMENTS CHECKLIST
================================================================================

□ Copy of original billing statement
□ Copy of Explanation of Benefits (EOB)
□ Copy of this dispute letter
□ Photo ID (if required)
□ Proof of income (if applying for financial assistance)
□ Any prior authorization documentation
□ Medical records (if disputing medical necessity)

================================================================================
                    ACTION TIMELINE
================================================================================

WEEK 1:
- Send dispute letter to billing department via certified mail
- Keep tracking number for your records
- Make copies of all documents before sending

WEEK 2-3:
- If no response, follow up with phone call
- Reference your certified mail tracking number
- Document the date, time, and name of person you spoke with

WEEK 4:
- If still unresolved, send follow-up letter
- Consider filing complaint with state insurance commissioner
- Contact hospital patient advocate if applicable

ONGOING:
- Do not pay disputed amount until resolved
- Request "do not refer to collections" status while dispute is pending
- Keep all correspondence organized

================================================================================
                    SENDING INSTRUCTIONS
================================================================================

CERTIFIED MAIL (RECOMMENDED):
1. Print and sign your letter
2. Make copies of everything
3. Send via USPS Certified Mail with Return Receipt
4. Keep tracking number and receipt

FAX:
Provider Billing: ${analysis.providerContactInfo?.billingPhone || '[BILLING FAX]'}
- Include cover sheet with your contact info
- Keep confirmation page

PATIENT PORTAL:
1. Log into provider's patient portal
2. Navigate to billing/messages section
3. Copy and paste letter content
4. Attach supporting documents
5. Screenshot confirmation for your records

================================================================================
                    IMPORTANT DISCLAIMERS
================================================================================

This document provides templates and general guidance for disputing medical bills.
It is NOT legal advice. For legal matters, consult a licensed attorney.

Your rights may vary by state. Check your state's medical billing protections.

================================================================================
`;

  return content;
}
