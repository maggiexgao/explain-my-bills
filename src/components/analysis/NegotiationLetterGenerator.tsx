import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Copy, Download, Mail, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MedicareSummary } from '@/lib/medicareBenchmark';
import { cn } from '@/lib/utils';

interface NegotiationLetterGeneratorProps {
  summary: MedicareSummary;
  providerName?: string;
  dateOfService?: string;
  accountNumber?: string;
  localityName?: string;
  state?: string;
  zipCode?: string;
}

export function NegotiationLetterGenerator({
  summary,
  providerName = '[Provider Name]',
  dateOfService = '[Date of Service]',
  accountNumber = '[Account Number]',
  localityName = 'National Average',
  state,
  zipCode
}: NegotiationLetterGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [providerAddress, setProviderAddress] = useState('');

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Get flagged items
  const flaggedItems = summary.comparisons.filter(
    c => c.status === 'high' || c.status === 'very_high'
  );

  // Calculate fair benchmark (150% of Medicare)
  const fairBenchmark = summary.totalMedicare 
    ? Math.round(summary.totalMedicare * 1.5)
    : null;
  const requestedAdjustment = fairBenchmark 
    ? summary.totalCharged - fairBenchmark
    : null;

  const generateLetter = () => {
    const flaggedSection = flaggedItems.map(item => 
`-----------------------------------------
CPT Code: ${item.cptCode}
Description: ${item.description || 'Unknown procedure'}
Amount Billed: $${item.chargedAmount.toLocaleString()}
Benchmark Rate (${localityName}${state ? `, ${state}` : ''}): $${item.medicareFee?.toLocaleString() || 'N/A'}
Your Charge is: ${item.percentOfMedicare}% of benchmark (vs typical 150-250%)
-----------------------------------------`
    ).join('\n');

    return `${today}

${providerName}
${providerAddress || '[Provider Address]'}

Re: Request for Medical Bill Adjustment
Account Number: ${accountNumber}
Patient Name: ${patientName || '[Patient Name]'}
Date of Service: ${dateOfService}

Dear Billing Department,

I am writing to request an adjustment to charges on my recent medical bill. I have compared my charges to CMS benchmark rates for my geographic area and found significant discrepancies.

CHARGES REQUIRING REVIEW:

${flaggedSection}

SUMMARY:
Total Charges: $${summary.totalCharged.toLocaleString()}
Fair Benchmark (150% of CMS rate): ${fairBenchmark ? `$${fairBenchmark.toLocaleString()}` : 'N/A'}
Requested Adjustment: ${requestedAdjustment ? `$${requestedAdjustment.toLocaleString()}` : 'N/A'}

According to the Centers for Medicare & Medicaid Services (CMS) 2026 Fee Schedule, fair commercial reimbursement typically ranges from 150-250% of benchmark rates. Several charges on my bill significantly exceed this standard.

I respectfully request that you adjust my bill to reflect fair market pricing, specifically reducing the flagged charges to 150% of benchmark rates${fairBenchmark ? `, for a revised total of $${fairBenchmark.toLocaleString()}` : ''}.

I value the quality of care I received and want to resolve this matter in good faith. Please contact me at ${phone || '[Phone]'} or ${email || '[Email]'} to discuss this adjustment.

Thank you for your consideration.

Sincerely,

${patientName || '[Patient Name]'}

---
SUPPORTING DATA:
- Locality: ${localityName}${state ? `, ${state}` : ''}
${zipCode ? `- ZIP Code: ${zipCode}` : ''}
- Data Source: CMS Fee Schedule 2026
- Analysis Date: ${today}`;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generateLetter());
    setCopied(true);
    toast.success('Letter copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const letter = generateLetter();
    const blob = new Blob([letter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `negotiation-letter-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Letter downloaded');
  };

  const handleEmail = () => {
    const letter = generateLetter();
    const subject = encodeURIComponent(`Request for Medical Bill Adjustment - ${accountNumber}`);
    const body = encodeURIComponent(letter);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  // Don't show if no flagged items
  if (flaggedItems.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          size="lg"
        >
          <FileText className="h-4 w-4" />
          Generate Negotiation Letter
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Negotiation Letter Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patientName">Your Name</Label>
              <Input
                id="patientName"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="providerAddress">Provider Address</Label>
              <Input
                id="providerAddress"
                value={providerAddress}
                onChange={(e) => setProviderAddress(e.target.value)}
                placeholder="123 Hospital St, City, State ZIP"
              />
            </div>
          </div>

          {/* Letter Preview */}
          <div className="space-y-2">
            <Label>Letter Preview</Label>
            <Textarea
              value={generateLetter()}
              readOnly
              className="min-h-[300px] font-mono text-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCopy}
              className="flex-1 gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy to Clipboard
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              className="flex-1 gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button
              variant="outline"
              onClick={handleEmail}
              className="flex-1 gap-2"
            >
              <Mail className="h-4 w-4" />
              Email
            </Button>
          </div>

          {/* Tips */}
          <div className="p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
            <p className="font-medium mb-1">💡 Tips for best results:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Fill in all fields before sending</li>
              <li>Send via certified mail or email for documentation</li>
              <li>Keep a copy for your records</li>
              <li>Follow up in 10-14 days if no response</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
