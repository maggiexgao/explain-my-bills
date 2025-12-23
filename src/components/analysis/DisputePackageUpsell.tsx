import { useState, useEffect } from 'react';
import { FileText, Download, Check, ArrowRight, Shield, Clock, FileCheck, Package, AlertCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DisputePackageEligibility, AnalysisResult, Language } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageContext';
import { generateDisputePackage } from '@/lib/disputePackageGenerator';
import { supabase } from '@/integrations/supabase/client';

interface DisputePackageUpsellProps {
  eligibility: DisputePackageEligibility;
  analysis: AnalysisResult;
  language: Language;
  onPurchase?: () => void;
}

const PACKAGE_PRICE = 19.99;

export function DisputePackageUpsell({ eligibility, analysis, language, onPurchase }: DisputePackageUpsellProps) {
  const { t } = useTranslation();
  const [isPurchased, setIsPurchased] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [email, setEmail] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Check for successful payment return
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');

    if (paymentStatus === 'success' && sessionId) {
      verifyPaymentAndDownload(sessionId);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const verifyPaymentAndDownload = async (sessionId: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { sessionId },
      });

      if (error) throw error;

      if (data.verified) {
        setPatientName(data.patientName || 'Patient');
        await generateDisputePackage(analysis, eligibility, language, data.patientName || 'Patient');
        setIsPurchased(true);
        toast.success('Payment verified! Your Dispute Package has been downloaded.');
        onPurchase?.();
      } else {
        toast.error('Payment verification failed. Please contact support.');
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      toast.error('Failed to verify payment. Please try again or contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!eligibility.eligible) return null;

  const handlePurchase = async () => {
    if (!showForm) {
      setShowForm(true);
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!patientName.trim()) {
      toast.error('Please enter your name to continue');
      return;
    }

    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-dispute-payment', {
        body: { email: email.trim(), patientName: patientName.trim() },
      });

      if (error) throw error;

      if (data.url) {
        // Open Stripe Checkout in new tab
        window.open(data.url, '_blank');
        toast.info('Complete your payment in the new tab. Your download will begin automatically when you return.');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Failed to start payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRedownload = async () => {
    setIsProcessing(true);
    try {
      await generateDisputePackage(analysis, eligibility, language, patientName.trim() || 'Patient');
      toast.success('Package downloaded again!');
    } catch (error) {
      console.error('Error generating package:', error);
      toast.error('Failed to generate package. Please try again.');
    } finally {
      setIsProcessing(false);
    }
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
            <p className="text-sm text-muted-foreground">Check your downloads folder for the ZIP file</p>
          </div>
        </div>
        
        <div className="p-3 rounded-xl bg-background/50 border border-border/30 mb-4">
          <p className="text-xs font-medium text-foreground mb-2">Your package includes:</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <FileCheck className="h-3 w-3 text-mint" />
              01 - Summary & Potential Issues
            </li>
            <li className="flex items-center gap-2">
              <FileCheck className="h-3 w-3 text-mint" />
              02 - Checklist & Timeline Guide
            </li>
            <li className="flex items-center gap-2">
              <FileCheck className="h-3 w-3 text-mint" />
              03 - Copy & Paste Templates
            </li>
            <li className="flex items-center gap-2">
              <FileCheck className="h-3 w-3 text-mint" />
              04 - Escalation Letters
            </li>
            <li className="flex items-center gap-2">
              <FileCheck className="h-3 w-3 text-mint" />
              05 - Resources & Laws
            </li>
          </ul>
        </div>
        
        <Button 
          onClick={handleRedownload} 
          disabled={isProcessing}
          className="w-full bg-mint hover:bg-mint/90 text-mint-foreground"
        >
          <Download className="h-4 w-4 mr-2" />
          {isProcessing ? 'Generating...' : 'Download Again'}
        </Button>
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
            <Package className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">Guided Dispute Package</h3>
              <Badge variant="secondary" className="text-xs">Recommended</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Get a complete ZIP with letters, checklists, and templates—ready to send
            </p>
          </div>
        </div>

        {/* Why we recommend this */}
        {eligibility.reasons.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-background/50 border border-border/30">
            <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-primary" />
              Why we recommend this:
            </p>
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
        <div className="mb-4 p-3 rounded-xl bg-background/30 border border-border/20">
          <p className="text-xs font-medium text-foreground mb-2">Your package includes:</p>
          <div className="grid grid-cols-1 gap-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3 w-3 text-primary" />
              Summary of issues found on your bill
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileCheck className="h-3 w-3 text-primary" />
              Step-by-step checklist and timeline
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3 w-3 text-primary" />
              Copy-paste scripts for calls and emails
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3 text-primary" />
              Formal dispute letters (auto-filled)
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 text-primary" />
              Resource guide with legal protections
            </div>
          </div>
        </div>

        {/* Email and Name input (shown after first click) */}
        {showForm && (
          <div className="mb-4 space-y-3 p-3 rounded-xl bg-background border border-border">
            <div>
              <Label htmlFor="patientEmail" className="text-xs font-medium flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Your email (for payment receipt)
              </Label>
              <Input
                id="patientEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="patientName" className="text-xs font-medium">
                Your name (for the letters)
              </Label>
              <Input
                id="patientName"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter your full name"
                className="mt-1.5"
              />
            </div>
          </div>
        )}

        {/* Price and CTA */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-bold text-foreground">${PACKAGE_PRICE}</p>
            <p className="text-xs text-muted-foreground">One-time fee</p>
          </div>
          <Button 
            onClick={handlePurchase} 
            disabled={isProcessing}
            className="flex-1 sm:flex-initial accent-gradient hover:opacity-90 text-white"
          >
            {isProcessing ? (
              <>Processing...</>
            ) : showForm ? (
              <>
                <Download className="h-4 w-4 mr-2" />
                Pay & Download
              </>
            ) : (
              <>
                Get Your Package
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-3">
          This package provides templates and guidance for self-advocacy. It is not legal, financial, or medical advice.
        </p>
      </div>
    </div>
  );
}
