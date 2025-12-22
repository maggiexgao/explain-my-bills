import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, CheckBox } from 'docx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { AnalysisResult, DisputePackageEligibility, Language } from '@/types';

interface DocumentContent {
  title: string;
  sections: {
    heading?: string;
    paragraphs?: string[];
    bullets?: string[];
    checkboxes?: string[];
    numbered?: string[];
  }[];
}

// Global disclaimer that appears in every document
const DISCLAIMER = {
  en: `DISCLAIMER: This packet is for education and self-advocacy only. It is not legal, financial, or medical advice, and does not create an attorney-client or advisor relationship. Laws and policies change; you are responsible for checking that the information is current for your situation and state.`,
  es: `AVISO: Este paquete es solo para educación y autodefensa. No es asesoramiento legal, financiero ni médico, y no crea una relación abogado-cliente ni de asesor. Las leyes y políticas cambian; usted es responsable de verificar que la información esté actualizada para su situación y estado.\n\n[English version below]\n${`DISCLAIMER: This packet is for education and self-advocacy only. It is not legal, financial, or medical advice, and does not create an attorney-client or advisor relationship. Laws and policies change; you are responsible for checking that the information is current for your situation and state.`}`,
  'zh-Hans': `免责声明：本资料包仅供教育和自我倡导使用。它不构成法律、财务或医疗建议，也不创建律师-客户或顾问关系。法律和政策会发生变化；您有责任检查信息是否适用于您的情况和所在州。\n\n[English version below]\n${`DISCLAIMER: This packet is for education and self-advocacy only. It is not legal, financial, or medical advice, and does not create an attorney-client or advisor relationship. Laws and policies change; you are responsible for checking that the information is current for your situation and state.`}`,
  'zh-Hant': `免責聲明：本資料包僅供教育和自我倡導使用。它不構成法律、財務或醫療建議，也不創建律師-客戶或顧問關係。法律和政策會發生變化；您有責任檢查信息是否適用於您的情況和所在州。\n\n[English version below]\n${`DISCLAIMER: This packet is for education and self-advocacy only. It is not legal, financial, or medical advice, and does not create an attorney-client or advisor relationship. Laws and policies change; you are responsible for checking that the information is current for your situation and state.`}`,
  ar: `إخلاء المسؤولية: هذه الحزمة مخصصة للتعليم والدفاع عن النفس فقط. وهي ليست نصيحة قانونية أو مالية أو طبية، ولا تنشئ علاقة محامي-موكل أو علاقة استشارية. تتغير القوانين والسياسات؛ أنت مسؤول عن التحقق من أن المعلومات محدثة لوضعك وولايتك.\n\n[English version below]\n${`DISCLAIMER: This packet is for education and self-advocacy only. It is not legal, financial, or medical advice, and does not create an attorney-client or advisor relationship. Laws and policies change; you are responsible for checking that the information is current for your situation and state.`}`,
};

function getDisclaimer(language: Language): string {
  return DISCLAIMER[language] || DISCLAIMER.en;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatPatientName(name?: string): string {
  return name || '[YOUR NAME]';
}

// ============================================================================
// DOCUMENT 1: Summary & Potential Issues
// ============================================================================
function generateSummaryDocument(
  analysis: AnalysisResult,
  eligibility: DisputePackageEligibility,
  language: Language,
  patientName?: string
): DocumentContent {
  const provider = analysis.providerContactInfo?.providerName || '[PROVIDER NAME]';
  const dateOfService = analysis.dateOfService || '[DATE OF SERVICE]';
  const documentType = analysis.documentType === 'bill' ? 'Medical Bill' : 
                       analysis.documentType === 'eob' ? 'Explanation of Benefits' : 
                       'Medical Document';

  const issues = [...(analysis.potentialErrors || []), ...(analysis.needsAttention || [])];

  return {
    title: 'Summary & Potential Issues',
    sections: [
      {
        heading: 'What This Bill Is About',
        paragraphs: [
          `Provider/Facility: ${provider}`,
          `Date of Service: ${dateOfService}`,
          `Document Type: ${documentType}`,
          analysis.eobData ? `Total Billed: $${analysis.eobData.billedAmount.toLocaleString()}` : '',
          analysis.eobData ? `Your Responsibility (per EOB): $${analysis.eobData.patientResponsibility.toLocaleString()}` : '',
        ].filter(Boolean) as string[],
      },
      {
        heading: 'Potential Issues We Found',
        paragraphs: issues.length === 0 
          ? ['No major issues were identified. However, we recommend reviewing the details below.']
          : [],
        bullets: issues.map(issue => {
          const severity = issue.severity === 'error' ? '⚠️ LIKELY ERROR' : 
                          issue.severity === 'warning' ? '⚡ NEEDS ATTENTION' : 'ℹ️ FYI';
          const whoToAsk = issue.type === 'eob_discrepancy' || issue.type === 'mismatch' 
            ? 'Ask your insurance first'
            : 'Ask the provider billing office first';
          return `${severity}: ${issue.title}\n   - ${issue.description}\n   - ${whoToAsk}`;
        }),
      },
      {
        heading: 'Quick Read Summary',
        paragraphs: [
          eligibility.hasErrors 
            ? 'We found potential billing errors that you should dispute. See the detailed issues above.'
            : 'No obvious errors found, but you may want to clarify some items.',
          eligibility.hasDenials
            ? 'There appears to be a denial or reduction. You may be able to appeal this.'
            : '',
          eligibility.hasNoSurprisesActScenario
            ? 'This may involve a surprise billing situation. Federal protections may apply to your case.'
            : '',
        ].filter(Boolean) as string[],
      },
    ],
  };
}

// ============================================================================
// DOCUMENT 2: Checklist & Timeline Guide
// ============================================================================
function generateChecklistDocument(
  analysis: AnalysisResult,
  language: Language
): DocumentContent {
  return {
    title: 'Checklist & Timeline Guide',
    sections: [
      {
        heading: 'How to Use This Packet',
        numbered: [
          'Read the Summary & Potential Issues document first (Document 01)',
          'Gather your documents using the checklist below',
          'Use the Copy & Paste Templates (Document 03) to ask for more information',
          'If needed, send the escalation letters (Document 04)',
          'Use the Additional Resources document (Document 05) if you need more help',
        ],
      },
      {
        heading: 'Document Checklist',
        checkboxes: [
          'I have a copy of my itemized bill (showing each charge with codes)',
          'I have my Explanation of Benefits (EOB) from my insurance',
          'I have my insurance card (front and back)',
          'I have noted my account number / patient ID',
          'I have noted the claim number (from EOB)',
          'I have gathered any prior authorization letters',
          'I have gathered any referral documentation',
          'I have gathered proof of income (if applying for financial assistance)',
        ],
      },
      {
        heading: 'Action Checklist',
        checkboxes: [
          'I confirmed my insurance was billed correctly',
          'I requested an itemized bill with CPT codes',
          'I compared the bill to my EOB amounts',
          'I asked about financial assistance programs',
          'I submitted my dispute/clarification request',
          'I filed an appeal with my insurance (if applicable)',
          'I followed up on my request (after 30 days)',
          'I requested "do not send to collections" status while disputing',
        ],
      },
      {
        heading: 'Timeline for Action',
        paragraphs: [
          'WITHIN 7 DAYS: Send your initial request for information or clarification using the templates in Document 03.',
          '',
          'WITHIN 30 DAYS: If disputing, send formal dispute letters from Document 04. Keep copies of everything.',
          '',
          'AFTER 30 DAYS WITH NO RESPONSE: Send follow-up letter. Consider filing a complaint with your state insurance commissioner.',
          '',
          'APPEAL DEADLINES: Most insurance plans allow 180 days from the date on your EOB to file an appeal. Check your specific plan documents for exact deadlines.',
          '',
          'IMPORTANT: Do not pay disputed amounts while actively disputing. Request that the provider not send the bill to collections during this time.',
        ],
      },
    ],
  };
}

// ============================================================================
// DOCUMENT 3: Copy & Paste Templates (Clarification)
// ============================================================================
function generateTemplatesDocument(
  analysis: AnalysisResult,
  language: Language,
  patientName?: string
): DocumentContent {
  const provider = analysis.providerContactInfo?.providerName || '[PROVIDER NAME]';
  const dateOfService = analysis.dateOfService || '[DATE OF SERVICE]';
  const claimNumber = analysis.eobData?.claimNumber || '[CLAIM NUMBER]';
  
  const codes = analysis.cptCodes?.map(c => c.code).join(', ') || '[CPT CODES]';

  return {
    title: 'Copy & Paste Templates for Getting Information',
    sections: [
      {
        heading: 'Section A: Templates for Your Insurance Company',
        paragraphs: [
          'Use these short scripts in emails, patient portals, or phone calls.\n',
        ],
      },
      {
        heading: 'Request Claim Explanation',
        paragraphs: [
          `"Hello, I am calling/writing about claim #${claimNumber} for date of service ${dateOfService}. Can you please explain why this claim was processed the way it was, and clarify my patient responsibility amount?"`,
          '',
          `[English] "Hello, I am calling/writing about claim #${claimNumber} for date of service ${dateOfService}. Can you please explain why this claim was processed the way it was, and clarify my patient responsibility amount?"`,
        ],
      },
      {
        heading: 'Request Appeal Instructions',
        paragraphs: [
          `"I would like to understand my appeal rights for claim #${claimNumber}. Can you please send me your detailed appeal instructions, including deadlines and where to submit?"`,
          '',
          `[English] "I would like to understand my appeal rights for claim #${claimNumber}. Can you please send me your detailed appeal instructions, including deadlines and where to submit?"`,
        ],
      },
      {
        heading: 'Confirm Network Status',
        paragraphs: [
          `"Can you confirm whether the services on claim #${claimNumber} from ${provider} were considered in-network or out-of-network? I want to understand how this affects my costs."`,
          '',
          `[English] "Can you confirm whether the services on claim #${claimNumber} from ${provider} were considered in-network or out-of-network? I want to understand how this affects my costs."`,
        ],
      },
      {
        heading: 'Section B: Templates for Provider/Hospital Billing Office',
        paragraphs: [
          'Use these when contacting the hospital or doctor\'s billing department.\n',
        ],
      },
      {
        heading: 'Request Itemized Bill',
        paragraphs: [
          `"Hello, I am a patient who received services on ${dateOfService}. Please send me a fully itemized bill that shows each individual charge, the CPT code, and a description of each service."`,
          '',
          `[English] "Hello, I am a patient who received services on ${dateOfService}. Please send me a fully itemized bill that shows each individual charge, the CPT code, and a description of each service."`,
        ],
      },
      {
        heading: 'Question Specific Charges',
        paragraphs: [
          `"I have questions about my bill from ${dateOfService}. Specifically, I would like to understand what the following codes represent and why they were billed: ${codes}. Can you please explain these charges?"`,
          '',
          `[English] "I have questions about my bill from ${dateOfService}. Specifically, I would like to understand what the following codes represent and why they were billed: ${codes}. Can you please explain these charges?"`,
        ],
      },
      {
        heading: 'Ask About Financial Assistance',
        paragraphs: [
          `"I am having difficulty paying my bill. Do you offer financial assistance, charity care, or payment plans? How do I apply, and what documentation do you need?"`,
          '',
          `[English] "I am having difficulty paying my bill. Do you offer financial assistance, charity care, or payment plans? How do I apply, and what documentation do you need?"`,
        ],
      },
      {
        heading: 'Request Collections Hold',
        paragraphs: [
          `"I am actively disputing/reviewing this bill. Please place a hold on my account so it is not sent to collections while I am working to resolve this. Please confirm this hold in writing."`,
          '',
          `[English] "I am actively disputing/reviewing this bill. Please place a hold on my account so it is not sent to collections while I am working to resolve this. Please confirm this hold in writing."`,
        ],
      },
    ],
  };
}

// ============================================================================
// DOCUMENT 4: Escalation Letters
// ============================================================================
function generateEscalationDocument(
  analysis: AnalysisResult,
  eligibility: DisputePackageEligibility,
  language: Language,
  patientName?: string
): DocumentContent {
  const provider = analysis.providerContactInfo?.providerName || '[PROVIDER NAME]';
  const dateOfService = analysis.dateOfService || '[DATE OF SERVICE]';
  const claimNumber = analysis.eobData?.claimNumber || '[CLAIM NUMBER]';
  const billingAddress = analysis.providerContactInfo?.mailingAddress || '[BILLING ADDRESS]';
  const insurerName = analysis.providerContactInfo?.insurerName || '[INSURANCE COMPANY]';
  const today = formatDate(new Date());
  const codes = analysis.cptCodes?.map(c => c.code).join(', ') || '[CPT CODES]';
  const billedAmount = analysis.eobData?.billedAmount?.toLocaleString() || '[BILLED AMOUNT]';
  const patientResp = analysis.eobData?.patientResponsibility?.toLocaleString() || '[PATIENT RESPONSIBILITY]';

  const issues = [...(analysis.potentialErrors || []), ...(analysis.needsAttention || [])];
  const issuesList = issues.map((issue, i) => `${i + 1}. ${issue.title}: ${issue.description}`).join('\n');

  const sections: DocumentContent['sections'] = [
    {
      heading: 'Letter 1: Formal Dispute to Provider Billing Department',
      paragraphs: [
        `${provider}`,
        `Billing Department`,
        `${billingAddress}`,
        '',
        `Date: ${today}`,
        '',
        `RE: Formal Dispute of Charges`,
        `Date of Service: ${dateOfService}`,
        `Account Number: [YOUR ACCOUNT NUMBER]`,
        '',
        `Dear Billing Department,`,
        '',
        `I am writing to formally dispute charges on my account for services on ${dateOfService}. After reviewing my billing statement and Explanation of Benefits, I have identified the following concerns:`,
        '',
        issuesList || '[DESCRIBE YOUR SPECIFIC CONCERNS]',
        '',
        `I request that you:`,
        `1. Provide a detailed itemized bill with all CPT codes`,
        `2. Review the charges above for accuracy`,
        `3. Correct any errors and issue an adjusted statement`,
        `4. Confirm in writing that this account will not be sent to collections while under dispute`,
        '',
        `Please respond to this dispute within 30 days.`,
        '',
        `Sincerely,`,
        `${formatPatientName(patientName)}`,
        `[YOUR ADDRESS]`,
        `[YOUR PHONE]`,
        `[YOUR EMAIL]`,
        '',
        `Please confirm in writing that you have received this letter and when I can expect a response.`,
      ],
    },
    {
      heading: 'Letter 2: Formal Appeal to Insurance Company',
      paragraphs: [
        `${insurerName}`,
        `Appeals Department`,
        `[INSURANCE ADDRESS - see back of your card or EOB]`,
        '',
        `Date: ${today}`,
        '',
        `RE: Formal Appeal - Claim #${claimNumber}`,
        `Date of Service: ${dateOfService}`,
        `Member ID: [YOUR MEMBER ID]`,
        '',
        `Dear Appeals Department,`,
        '',
        `I am writing to formally appeal the processing of claim #${claimNumber} for services received on ${dateOfService} from ${provider}.`,
        '',
        `The total billed amount was $${billedAmount}, and my EOB shows a patient responsibility of $${patientResp}. I am disputing this amount for the following reasons:`,
        '',
        issuesList || '[DESCRIBE YOUR SPECIFIC CONCERNS]',
        '',
        `Under my plan and applicable federal regulations, I request that you:`,
        `1. Re-review this claim for proper coding and coverage`,
        `2. Verify all applicable benefits were applied correctly`,
        `3. Provide a detailed written explanation of any denials`,
        `4. Process this appeal within the timeframes required by law`,
        '',
        `Sincerely,`,
        `${formatPatientName(patientName)}`,
        `Member ID: [YOUR MEMBER ID]`,
        `[YOUR ADDRESS]`,
        `[YOUR PHONE]`,
        '',
        `Please confirm in writing that you have received this letter and when I can expect a response.`,
      ],
    },
  ];

  // Add No Surprises Act letter if applicable
  if (eligibility.hasNoSurprisesActScenario) {
    sections.push({
      heading: 'Letter 3: No Surprises Act / Balance Billing Dispute',
      paragraphs: [
        `${provider}`,
        `Billing Department`,
        `${billingAddress}`,
        '',
        `Date: ${today}`,
        '',
        `RE: Dispute Under the No Surprises Act`,
        `Date of Service: ${dateOfService}`,
        '',
        `Dear Billing Department,`,
        '',
        `I am writing regarding a bill I received for services on ${dateOfService}. I believe this bill may violate the federal No Surprises Act (NSA), which protects patients from surprise medical bills in certain situations.`,
        '',
        `Specifically:`,
        `- The services were provided at an in-network facility by an out-of-network provider, OR`,
        `- I received emergency services without the ability to choose an in-network provider, OR`,
        `- I did not receive proper notice and consent before receiving out-of-network care`,
        '',
        `Under the No Surprises Act:`,
        `- I should only be responsible for in-network cost-sharing amounts`,
        `- You are prohibited from billing me for amounts beyond my in-network cost-sharing`,
        `- The dispute must be resolved between you and my insurance company`,
        '',
        `I request that you:`,
        `1. Review this bill for compliance with the No Surprises Act`,
        `2. Adjust my balance to reflect only in-network cost-sharing`,
        `3. Pursue any additional amounts through the federal independent dispute resolution process with my insurer`,
        '',
        `For reference, the No Surprises Act took effect January 1, 2022, and is enforced by CMS and state regulators.`,
        '',
        `Sincerely,`,
        `${formatPatientName(patientName)}`,
        `[YOUR ADDRESS]`,
        `[YOUR PHONE]`,
        '',
        `Please confirm in writing that you have received this letter and when I can expect a response.`,
      ],
    });
  }

  // Add escalation letter
  sections.push({
    heading: 'Letter 4: Final Escalation (Use If No Response After 30 Days)',
    paragraphs: [
      `${provider}`,
      `Patient Relations / Billing Supervisor`,
      `${billingAddress}`,
      '',
      `Date: ${today}`,
      '',
      `RE: Final Notice Before Regulatory Complaint`,
      `Date of Service: ${dateOfService}`,
      `Original Dispute Submitted: [DATE OF FIRST LETTER]`,
      '',
      `Dear Patient Relations,`,
      '',
      `I am writing as a follow-up to my dispute submitted on [DATE OF FIRST LETTER], to which I have not received a satisfactory response.`,
      '',
      `This is my final attempt to resolve this matter directly before escalating to regulatory agencies.`,
      '',
      `If I do not receive a written response within 14 days addressing my concerns, I intend to:`,
      `1. File a complaint with the ${analysis.stateHelp?.state || '[STATE]'} Department of Insurance`,
      `2. File a complaint with the ${analysis.stateHelp?.state || '[STATE]'} Attorney General's Consumer Protection Division`,
      `3. Report this to the Consumer Financial Protection Bureau (if applicable)`,
      `4. Report potential No Surprises Act violations to CMS (if applicable)`,
      '',
      `I am prepared to provide regulators with copies of all correspondence, bills, and EOBs.`,
      '',
      `Sincerely,`,
      `${formatPatientName(patientName)}`,
      `[YOUR ADDRESS]`,
      `[YOUR PHONE]`,
    ],
  });

  return {
    title: 'Escalation Letters and Templates',
    sections,
  };
}

// ============================================================================
// DOCUMENT 5: Additional Resources & Laws
// ============================================================================
function generateResourcesDocument(
  analysis: AnalysisResult,
  language: Language
): DocumentContent {
  const state = analysis.stateHelp?.state || 'your state';
  const debtProtections = analysis.stateHelp?.debtProtections || [];
  const reliefPrograms = analysis.stateHelp?.reliefPrograms || [];

  return {
    title: 'Additional Resources, Laws & Contacts',
    sections: [
      {
        heading: 'Federal Protections',
        paragraphs: [
          'NO SURPRISES ACT (Effective January 1, 2022)',
          '• Protects you from surprise bills when you receive emergency care',
          '• Protects you when you receive care at an in-network facility from an out-of-network provider',
          '• Requires providers to give you a Good Faith Estimate for scheduled services',
          '• Learn more: cms.gov/nosurprises',
          '',
          'INSURANCE APPEAL RIGHTS',
          '• You have the right to an internal appeal with your insurance company',
          '• If internal appeal is denied, you have the right to an external review by an independent party',
          '• Most plans allow 180 days from denial to file an appeal',
          '• Learn more: healthcare.gov/appeal-insurance-company-decision',
          '',
          'FAIR DEBT COLLECTION PRACTICES ACT',
          '• Debt collectors must verify the debt if you dispute it within 30 days',
          '• They cannot use abusive or harassing tactics',
          '• They must stop collection efforts while verifying disputed debt',
        ],
      },
      {
        heading: `State Protections (${state})`,
        paragraphs: debtProtections.length > 0 
          ? debtProtections.map(p => `• ${p}`)
          : ['• Check your state insurance department website for specific protections'],
      },
      {
        heading: 'State Relief Programs',
        bullets: reliefPrograms.length > 0
          ? reliefPrograms.map(p => `${p.name}: ${p.description}${p.link ? ` (${p.link})` : ''}`)
          : ['Check with your state for available medical debt relief programs'],
      },
      {
        heading: 'Key Contacts',
        paragraphs: [
          'STATE INSURANCE DEPARTMENT',
          `• Search: "[${state}] department of insurance consumer complaint"`,
          '• They handle complaints about insurance claim processing and denials',
          '',
          'STATE ATTORNEY GENERAL',
          `• Search: "[${state}] attorney general consumer protection"`,
          '• They handle complaints about unfair billing practices',
          '',
          'CMS (Centers for Medicare & Medicaid Services)',
          '• For No Surprises Act violations: 1-800-985-3059',
          '• Online: cms.gov/nosurprises',
          '',
          'PATIENT ADVOCATE FOUNDATION',
          '• Free case management: 1-800-532-5274',
          '• Website: patientadvocate.org',
          '',
          'HEALTHCARE BILLING ADVOCACY',
          '• National Patient Advocate Foundation: npaf.org',
          '• Consumer Financial Protection Bureau: consumerfinance.gov',
        ],
      },
      {
        heading: 'When to Use These Resources',
        bullets: [
          'Your internal appeal with insurance has been denied and you want external review',
          'The provider refuses to correct billing errors or provide itemized bills',
          'You are being sent to collections on a disputed bill',
          'You believe your rights under the No Surprises Act are being violated',
          'You need free help navigating a complex medical billing situation',
        ],
      },
    ],
  };
}

// ============================================================================
// DOCX GENERATION
// ============================================================================
function createDocxDocument(content: DocumentContent, disclaimer: string): Document {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: content.title, bold: true, size: 32 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 400 },
    })
  );

  // Disclaimer at top
  children.push(
    new Paragraph({
      children: [new TextRun({ text: disclaimer, italics: true, size: 18, color: '666666' })],
      spacing: { after: 400 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
    })
  );

  // Sections
  for (const section of content.sections) {
    if (section.heading) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: section.heading, bold: true, size: 24 })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );
    }

    if (section.paragraphs) {
      for (const para of section.paragraphs) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: para, size: 22 })],
            spacing: { after: 120 },
          })
        );
      }
    }

    if (section.bullets) {
      for (const bullet of section.bullets) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: bullet, size: 22 })],
            bullet: { level: 0 },
            spacing: { after: 80 },
          })
        );
      }
    }

    if (section.numbered) {
      for (let i = 0; i < section.numbered.length; i++) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `${i + 1}. ${section.numbered[i]}`, size: 22 })],
            spacing: { after: 80 },
          })
        );
      }
    }

    if (section.checkboxes) {
      for (const checkbox of section.checkboxes) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `☐ ${checkbox}`, size: 22 })],
            spacing: { after: 80 },
          })
        );
      }
    }
  }

  // Disclaimer at bottom
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '\n\n' + disclaimer, italics: true, size: 18, color: '666666' })],
      spacing: { before: 400 },
    })
  );

  return new Document({
    sections: [{ children }],
  });
}

// ============================================================================
// TEXT/PDF GENERATION (Plain text that can be printed as PDF)
// ============================================================================
function createPlainText(content: DocumentContent, disclaimer: string): string {
  let text = '';
  
  text += '═'.repeat(80) + '\n';
  text += content.title.toUpperCase() + '\n';
  text += '═'.repeat(80) + '\n\n';

  text += '─'.repeat(80) + '\n';
  text += disclaimer + '\n';
  text += '─'.repeat(80) + '\n\n';

  for (const section of content.sections) {
    if (section.heading) {
      text += '\n' + section.heading.toUpperCase() + '\n';
      text += '─'.repeat(section.heading.length) + '\n\n';
    }

    if (section.paragraphs) {
      for (const para of section.paragraphs) {
        text += para + '\n';
      }
      text += '\n';
    }

    if (section.bullets) {
      for (const bullet of section.bullets) {
        text += '  • ' + bullet + '\n';
      }
      text += '\n';
    }

    if (section.numbered) {
      for (let i = 0; i < section.numbered.length; i++) {
        text += `  ${i + 1}. ${section.numbered[i]}\n`;
      }
      text += '\n';
    }

    if (section.checkboxes) {
      for (const checkbox of section.checkboxes) {
        text += `  ☐ ${checkbox}\n`;
      }
      text += '\n';
    }
  }

  text += '\n' + '─'.repeat(80) + '\n';
  text += disclaimer + '\n';
  text += '─'.repeat(80) + '\n';

  return text;
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================
export async function generateDisputePackage(
  analysis: AnalysisResult,
  eligibility: DisputePackageEligibility,
  language: Language,
  patientName?: string
): Promise<void> {
  const disclaimer = getDisclaimer(language);
  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = (patientName || 'Patient').replace(/[^a-zA-Z0-9]/g, '_');
  
  const zip = new JSZip();

  // Generate all 5 documents
  const documents = [
    {
      name: '01_Summary_and_Potential_Issues',
      content: generateSummaryDocument(analysis, eligibility, language, patientName),
    },
    {
      name: '02_Checklist_and_Timeline_Guide',
      content: generateChecklistDocument(analysis, language),
    },
    {
      name: '03_Copy_Paste_Templates',
      content: generateTemplatesDocument(analysis, language, patientName),
    },
    {
      name: '04_Escalation_Letters_and_Templates',
      content: generateEscalationDocument(analysis, eligibility, language, patientName),
    },
    {
      name: '05_Additional_Resources_and_Laws',
      content: generateResourcesDocument(analysis, language),
    },
  ];

  // Add each document as DOCX and TXT (simulated PDF)
  for (const doc of documents) {
    // Generate DOCX
    const docxDoc = createDocxDocument(doc.content, disclaimer);
    const docxBlob = await Packer.toBlob(docxDoc);
    zip.file(`${doc.name}_DOCX.docx`, docxBlob);

    // Generate plain text (for PDF printing)
    const plainText = createPlainText(doc.content, disclaimer);
    zip.file(`${doc.name}_PDF.txt`, plainText);
  }

  // Add a README
  const readme = `ROSETTA DISPUTE PACK
====================
Generated: ${dateStr}
Patient: ${safeName}

This package contains 5 documents to help you understand and dispute your medical bill.
Each document is provided in DOCX (Word) and TXT (printable) format.

FILES INCLUDED:
1. Summary & Potential Issues - Overview of your bill and issues we found
2. Checklist & Timeline Guide - Step-by-step instructions
3. Copy & Paste Templates - Scripts for calling/emailing to get information
4. Escalation Letters - Formal dispute letters (fill in and send)
5. Additional Resources & Laws - Legal protections and contacts

HOW TO USE:
1. Start by reading Document 01 (Summary)
2. Gather documents using the checklist in Document 02
3. Use the templates in Document 03 to ask questions
4. Send formal letters from Document 04 if needed
5. Refer to Document 05 for additional help

${disclaimer}
`;
  zip.file('README.txt', readme);

  // Generate and download the zip
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `Rosetta_Dispute_Pack_${safeName}_${dateStr}.zip`);
}
