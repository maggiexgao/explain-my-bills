import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';
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

// Bilingual disclaimers
const DISCLAIMER = {
  en: `DISCLAIMER: This packet is for education and self-advocacy only. It is not legal, financial, or medical advice, and does not create an attorney-client or advisor relationship. Laws and policies change; you are responsible for checking that the information is current for your situation and state.`,
  es: `AVISO: Este paquete es solo para educación y autodefensa. No es asesoramiento legal, financiero ni médico, y no crea una relación abogado-cliente ni de asesor. Las leyes y políticas cambian; usted es responsable de verificar que la información esté actualizada para su situación y estado.\n\n[English version below]\nDISCLAIMER: This packet is for education and self-advocacy only. It is not legal, financial, or medical advice, and does not create an attorney-client or advisor relationship. Laws and policies change; you are responsible for checking that the information is current for your situation and state.`,
  'zh-Hans': `免责声明：本资料包仅供教育和自我倡导使用。它不构成法律、财务或医疗建议，也不创建律师-客户或顾问关系。法律和政策会发生变化；您有责任检查信息是否适用于您的情况和所在州。\n\n[English version below]\nDISCLAIMER: This packet is for education and self-advocacy only. It is not legal, financial, or medical advice, and does not create an attorney-client or advisor relationship. Laws and policies change; you are responsible for checking that the information is current for your situation and state.`,
  'zh-Hant': `免責聲明：本資料包僅供教育和自我倡導使用。它不構成法律、財務或醫療建議，也不創建律師-客戶或顧問關係。法律和政策會發生變化；您有責任檢查信息是否適用於您的情況和所在州。\n\n[English version below]\nDISCLAIMER: This packet is for education and self-advocacy only. It is not legal, financial, or medical advice, and does not create an attorney-client or advisor relationship. Laws and policies change; you are responsible for checking that the information is current for your situation and state.`,
  ar: `إخلاء المسؤولية: هذه الحزمة مخصصة للتعليم والدفاع عن النفس فقط. وهي ليست نصيحة قانونية أو مالية أو طبية، ولا تنشئ علاقة محامي-موكل أو علاقة استشارية. تتغير القوانين والسياسات؛ أنت مسؤول عن التحقق من أن المعلومات محدثة لوضعك وولايتك.\n\n[English version below]\nDISCLAIMER: This packet is for education and self-advocacy only. It is not legal, financial, or medical advice, and does not create an attorney-client or advisor relationship. Laws and policies change; you are responsible for checking that the information is current for your situation and state.`,
};

const DISCLAIMER_EN = `DISCLAIMER: This packet is for education and self-advocacy only. It is not legal, financial, or medical advice, and does not create an attorney-client or advisor relationship. Laws and policies change; you are responsible for checking that the information is current for your situation and state.`;

function getDisclaimer(language: Language): string {
  return DISCLAIMER[language] || DISCLAIMER.en;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Smart autofill helpers - gracefully handle missing data
function getServiceIdentifier(analysis: AnalysisResult): string {
  const parts: string[] = [];
  if (analysis.eobData?.claimNumber) {
    parts.push(`claim #${analysis.eobData.claimNumber}`);
  }
  if (analysis.dateOfService && analysis.dateOfService !== 'Not specified') {
    parts.push(`services on ${analysis.dateOfService}`);
  }
  if (analysis.issuer && analysis.issuer !== 'Unknown Provider') {
    parts.push(`with ${analysis.issuer}`);
  }
  if (parts.length === 0) {
    return 'my recent medical bill';
  }
  return parts.join(' for ');
}

function getClaimReference(analysis: AnalysisResult): string {
  if (analysis.eobData?.claimNumber) {
    return `claim #${analysis.eobData.claimNumber}`;
  }
  if (analysis.dateOfService && analysis.dateOfService !== 'Not specified') {
    return `my bill for services on ${analysis.dateOfService}`;
  }
  return 'my account';
}

function getProviderName(analysis: AnalysisResult): string {
  return analysis.providerContactInfo?.providerName || analysis.issuer || 'your billing department';
}

function getDateOfService(analysis: AnalysisResult): string {
  return analysis.dateOfService && analysis.dateOfService !== 'Not specified' 
    ? analysis.dateOfService 
    : '[date from my bill]';
}

function getCPTCodes(analysis: AnalysisResult): string {
  if (analysis.cptCodes && analysis.cptCodes.length > 0) {
    return analysis.cptCodes.map(c => c.code).join(', ');
  }
  return '[the CPT codes on my bill]';
}

function getBilledAmount(analysis: AnalysisResult): string {
  if (analysis.eobData?.billedAmount) {
    return `$${analysis.eobData.billedAmount.toLocaleString()}`;
  }
  const total = analysis.charges?.reduce((sum, c) => sum + (c.amount || 0), 0);
  if (total && total > 0) {
    return `$${total.toLocaleString()}`;
  }
  return '[the amount on my bill]';
}

function getPatientResponsibility(analysis: AnalysisResult): string {
  if (analysis.eobData?.patientResponsibility) {
    return `$${analysis.eobData.patientResponsibility.toLocaleString()}`;
  }
  return '[my patient responsibility amount]';
}

function getMailingAddress(analysis: AnalysisResult): string {
  return analysis.providerContactInfo?.mailingAddress || '[billing address from my bill]';
}

function getInsurerName(analysis: AnalysisResult): string {
  return analysis.providerContactInfo?.insurerName || 'my insurance company';
}

// ============================================================================
// DOCUMENT 1: Summary & Potential Issues (First-person, autofilled)
// ============================================================================
function generateSummaryDocument(
  analysis: AnalysisResult,
  eligibility: DisputePackageEligibility,
  language: Language,
  patientName?: string
): DocumentContent {
  const provider = getProviderName(analysis);
  const dateOfService = getDateOfService(analysis);
  const documentType = analysis.documentType === 'bill' ? 'Medical Bill' : 
                       analysis.documentType === 'eob' ? 'Explanation of Benefits' : 
                       'Medical Document';

  const issues = [...(analysis.potentialErrors || []), ...(analysis.needsAttention || [])];

  return {
    title: 'Summary & Potential Issues',
    sections: [
      {
        heading: 'About This Bill',
        paragraphs: [
          `Provider/Facility: ${provider}`,
          `Date of Service: ${dateOfService}`,
          `Document Type: ${documentType}`,
          analysis.eobData ? `Total Billed: $${analysis.eobData.billedAmount.toLocaleString()}` : '',
          analysis.eobData ? `My Responsibility (per EOB): $${analysis.eobData.patientResponsibility.toLocaleString()}` : '',
        ].filter(Boolean) as string[],
      },
      {
        heading: 'Issues I Should Review',
        paragraphs: issues.length === 0 
          ? ['No major issues were found. I should still review the details below to make sure everything is accurate.']
          : [],
        bullets: issues.map(issue => {
          const severity = issue.severity === 'error' ? '⚠️ LIKELY ERROR' : 
                          issue.severity === 'warning' ? '⚡ NEEDS ATTENTION' : 'ℹ️ FYI';
          const whoToAsk = issue.type === 'eob_discrepancy' || issue.type === 'mismatch' 
            ? 'I should ask my insurance first'
            : 'I should ask the billing office first';
          return `${severity}: ${issue.title}\n   - ${issue.description}\n   - ${whoToAsk}`;
        }),
      },
      {
        heading: 'Quick Summary',
        paragraphs: [
          eligibility.hasErrors 
            ? 'There appear to be potential billing errors that I should dispute using the templates in this packet.'
            : 'No obvious errors were found, but I may want to clarify some items.',
          eligibility.hasDenials
            ? 'There appears to be a denial or reduction. I may be able to appeal this decision.'
            : '',
          eligibility.hasNoSurprisesActScenario
            ? 'This may involve a surprise billing situation. Federal protections under the No Surprises Act may apply to my case.'
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
          'Start by reading the Summary & Potential Issues (Document 01) to understand my bill',
          'Gather my documents using the checklist below',
          'Use the Copy & Paste Templates (Document 03) to ask for more information',
          'If I need to escalate, send the formal letters in Document 04',
          'Refer to Additional Resources (Document 05) if I need more help',
        ],
      },
      {
        heading: 'Documents I Need to Gather',
        checkboxes: [
          'My itemized bill (showing each charge with CPT codes)',
          'My Explanation of Benefits (EOB) from my insurance',
          'My insurance card (front and back)',
          'My account number or patient ID',
          'The claim number (from my EOB)',
          'Any prior authorization letters I received',
          'Referral documentation if applicable',
          'Proof of income (if applying for financial assistance)',
        ],
      },
      {
        heading: 'My Action Checklist',
        checkboxes: [
          'I confirmed my insurance was billed correctly',
          'I requested an itemized bill with CPT codes',
          'I compared my bill to my EOB amounts',
          'I asked about financial assistance programs',
          'I submitted my dispute or clarification request',
          'I filed an appeal with my insurance (if applicable)',
          'I followed up on my request (after 30 days)',
          'I requested a "do not send to collections" hold while disputing',
        ],
      },
      {
        heading: 'Timeline for My Actions',
        paragraphs: [
          'WITHIN 7 DAYS: I should send my initial request for information or clarification using the templates in Document 03.',
          '',
          'WITHIN 30 DAYS: If I am disputing charges, I should send the formal dispute letters from Document 04. I need to keep copies of everything.',
          '',
          'AFTER 30 DAYS WITH NO RESPONSE: I should send a follow-up letter. I can consider filing a complaint with my state insurance commissioner.',
          '',
          'APPEAL DEADLINES: Most insurance plans allow 180 days from the date on my EOB to file an appeal. I need to check my specific plan documents for exact deadlines.',
          '',
          'IMPORTANT: I should not pay disputed amounts while actively disputing. I should request that the provider not send my bill to collections during this time.',
        ],
      },
    ],
  };
}

// ============================================================================
// DOCUMENT 3: Copy & Paste Templates (Patient-voice, autofilled, English templates)
// ============================================================================
function generateTemplatesDocument(
  analysis: AnalysisResult,
  language: Language,
  patientName?: string
): DocumentContent {
  const provider = getProviderName(analysis);
  const serviceRef = getServiceIdentifier(analysis);
  const claimRef = getClaimReference(analysis);
  const dateOfService = getDateOfService(analysis);
  const codes = getCPTCodes(analysis);
  const billedAmount = getBilledAmount(analysis);
  const patientResp = getPatientResponsibility(analysis);

  // All templates are in English (for sending) but explanatory text can be translated
  const templatesIntro = language !== 'en' 
    ? 'Below are ready-to-use English templates I can copy and paste into emails, patient portals, or use as phone scripts.\n\n(English templates below / Plantillas en inglés abajo / 以下是英文模板)'
    : 'Below are ready-to-use templates I can copy and paste into emails, patient portals, or use as phone scripts.';

  return {
    title: 'Copy & Paste Templates',
    sections: [
      {
        heading: 'How to Use These Templates',
        paragraphs: [templatesIntro],
      },
      {
        heading: 'SECTION A: Templates for My Insurance Company',
        paragraphs: [],
      },
      {
        heading: 'Request Claim Explanation',
        paragraphs: [
          `"Hi, I'm calling about ${claimRef} for ${dateOfService}. Can you please explain how this claim was processed and help me understand my patient responsibility amount? Thank you."`,
        ],
      },
      {
        heading: 'Request Appeal Instructions',
        paragraphs: [
          `"Hi, I'd like to understand my appeal rights for ${claimRef}. Can you please send me your detailed appeal instructions, including deadlines and where to submit my appeal? Thank you."`,
        ],
      },
      {
        heading: 'Confirm Network Status',
        paragraphs: [
          `"Hi, I'm calling about ${claimRef} from ${provider}. Can you confirm whether these services were considered in-network or out-of-network? I want to understand how this affects my costs. Thank you."`,
        ],
      },
      {
        heading: 'SECTION B: Templates for ${provider} Billing Office',
        paragraphs: [],
      },
      {
        heading: 'Request Itemized Bill',
        paragraphs: [
          `"Hi, my name is ${patientName || '[my name]'} and I received services on ${dateOfService}. Can you please send me a fully itemized bill that shows each individual charge, the CPT code, and a description of each service? Thank you."`,
        ],
      },
      {
        heading: 'Question Specific Charges',
        paragraphs: [
          `"Hi, I have questions about my bill from ${dateOfService}. Specifically, I'd like to understand what the following codes mean and why they were billed: ${codes}. Can you please explain these charges? Thank you."`,
        ],
      },
      {
        heading: 'Ask About Financial Assistance',
        paragraphs: [
          `"Hi, I'm having difficulty paying my bill. Do you offer financial assistance, charity care, or payment plans? How do I apply, and what documentation do you need? Thank you."`,
        ],
      },
      {
        heading: 'Request Collections Hold',
        paragraphs: [
          `"Hi, I'm actively reviewing and disputing this bill. Can you please place a hold on my account so it is not sent to collections while I work to resolve this? Please confirm this hold in writing. Thank you."`,
        ],
      },
      {
        heading: 'Dispute Bill Discrepancy (if EOB shows different amount)',
        paragraphs: analysis.eobData ? [
          `"Hi, I'm calling about my bill for ${dateOfService}. My bill shows ${billedAmount}, but my Explanation of Benefits says my patient responsibility is ${patientResp}. Can you help me understand this difference and correct my balance if needed? Thank you."`,
        ] : [
          `"Hi, I'm calling about my bill for ${dateOfService}. I'd like to compare my bill to what my insurance says I owe. Can you help me verify the amounts are correct? Thank you."`,
        ],
      },
    ],
  };
}

// ============================================================================
// DOCUMENT 4: Escalation Letters (Patient-voice, autofilled, English)
// ============================================================================
function generateEscalationDocument(
  analysis: AnalysisResult,
  eligibility: DisputePackageEligibility,
  language: Language,
  patientName?: string
): DocumentContent {
  const provider = getProviderName(analysis);
  const dateOfService = getDateOfService(analysis);
  const claimRef = getClaimReference(analysis);
  const billingAddress = getMailingAddress(analysis);
  const insurerName = getInsurerName(analysis);
  const today = formatDate(new Date());
  const codes = getCPTCodes(analysis);
  const billedAmount = getBilledAmount(analysis);
  const patientResp = getPatientResponsibility(analysis);
  const name = patientName || '[My Name]';

  const issues = [...(analysis.potentialErrors || []), ...(analysis.needsAttention || [])];
  const issuesList = issues.length > 0 
    ? issues.map((issue, i) => `${i + 1}. ${issue.title}: ${issue.description}`).join('\n')
    : '1. [I will describe my specific concerns here]';

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
        `Account: ${claimRef}`,
        '',
        `Dear Billing Department,`,
        '',
        `I am writing to formally dispute charges on my account for services on ${dateOfService}. After reviewing my billing statement and Explanation of Benefits, I have identified the following concerns:`,
        '',
        issuesList,
        '',
        `I am requesting that you:`,
        `1. Provide me with a detailed itemized bill showing all CPT codes`,
        `2. Review the charges listed above for accuracy`,
        `3. Correct any errors and send me an adjusted statement`,
        `4. Confirm in writing that my account will not be sent to collections while this dispute is being resolved`,
        '',
        `Please respond to my dispute within 30 days.`,
        '',
        `Sincerely,`,
        `${name}`,
        `[My Address]`,
        `[My Phone]`,
        `[My Email]`,
        '',
        `Please confirm in writing that you have received this letter and let me know when I can expect a response.`,
      ],
    },
    {
      heading: 'Letter 2: Formal Appeal to My Insurance Company',
      paragraphs: [
        `${insurerName}`,
        `Appeals Department`,
        `[Insurance Address - from the back of my card or my EOB]`,
        '',
        `Date: ${today}`,
        '',
        `RE: Formal Appeal - ${claimRef}`,
        `Date of Service: ${dateOfService}`,
        `Member ID: [My Member ID]`,
        '',
        `Dear Appeals Department,`,
        '',
        `I am writing to formally appeal the processing of ${claimRef} for services I received on ${dateOfService} from ${provider}.`,
        '',
        `The total billed amount was ${billedAmount}, and my EOB shows a patient responsibility of ${patientResp}. I am disputing this amount for the following reasons:`,
        '',
        issuesList,
        '',
        `Under my plan and applicable federal regulations, I am requesting that you:`,
        `1. Re-review this claim for proper coding and coverage`,
        `2. Verify that all applicable benefits were applied correctly`,
        `3. Provide me with a detailed written explanation of any denials`,
        `4. Process this appeal within the timeframes required by law`,
        '',
        `Sincerely,`,
        `${name}`,
        `Member ID: [My Member ID]`,
        `[My Address]`,
        `[My Phone]`,
        '',
        `Please confirm in writing that you have received this letter and let me know when I can expect a response.`,
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
        `I am writing regarding a bill I received for services on ${dateOfService}. I believe this bill may violate the federal No Surprises Act, which protects patients from surprise medical bills.`,
        '',
        `Specifically, one of the following situations applies to me:`,
        `- I received services at an in-network facility from an out-of-network provider`,
        `- I received emergency services without the ability to choose an in-network provider`,
        `- I did not receive proper notice and consent before receiving out-of-network care`,
        '',
        `Under the No Surprises Act:`,
        `- I should only be responsible for in-network cost-sharing amounts`,
        `- You are prohibited from billing me for amounts beyond my in-network cost-sharing`,
        `- Any dispute about payment must be resolved between you and my insurance company`,
        '',
        `I am requesting that you:`,
        `1. Review this bill for compliance with the No Surprises Act`,
        `2. Adjust my balance to reflect only in-network cost-sharing`,
        `3. Pursue any additional amounts through the federal independent dispute resolution process with my insurer`,
        '',
        `For reference, the No Surprises Act took effect January 1, 2022, and is enforced by CMS and state regulators.`,
        '',
        `Sincerely,`,
        `${name}`,
        `[My Address]`,
        `[My Phone]`,
        '',
        `Please confirm in writing that you have received this letter and let me know when I can expect a response.`,
      ],
    });
  }

  // Final escalation letter
  sections.push({
    heading: 'Letter 4: Final Escalation (If No Response After 30 Days)',
    paragraphs: [
      `${provider}`,
      `Patient Relations / Billing Supervisor`,
      `${billingAddress}`,
      '',
      `Date: ${today}`,
      '',
      `RE: Final Notice Before Regulatory Complaint`,
      `Date of Service: ${dateOfService}`,
      `Original Dispute Submitted: [Date of my first letter]`,
      '',
      `Dear Patient Relations,`,
      '',
      `I am writing as a follow-up to my dispute submitted on [date of my first letter], to which I have not received a satisfactory response.`,
      '',
      `This is my final attempt to resolve this matter directly before I escalate to regulatory agencies.`,
      '',
      `If I do not receive a written response within 14 days addressing my concerns, I intend to:`,
      `1. File a complaint with the ${analysis.stateHelp?.state || '[My State]'} Department of Insurance`,
      `2. File a complaint with the ${analysis.stateHelp?.state || '[My State]'} Attorney General's Consumer Protection Division`,
      `3. Report this to the Consumer Financial Protection Bureau (if applicable)`,
      `4. Report potential No Surprises Act violations to CMS (if applicable)`,
      '',
      `I am prepared to provide regulators with copies of all correspondence, bills, and EOBs.`,
      '',
      `Sincerely,`,
      `${name}`,
      `[My Address]`,
      `[My Phone]`,
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
  const state = analysis.stateHelp?.state || 'my state';
  const debtProtections = analysis.stateHelp?.debtProtections || [];
  const reliefPrograms = analysis.stateHelp?.reliefPrograms || [];

  return {
    title: 'Additional Resources, Laws & Contacts',
    sections: [
      {
        heading: 'Federal Protections That Apply to Me',
        paragraphs: [
          'NO SURPRISES ACT (Effective January 1, 2022)',
          '• Protects me from surprise bills when I receive emergency care',
          '• Protects me when I receive care at an in-network facility from an out-of-network provider',
          '• Requires providers to give me a Good Faith Estimate for scheduled services',
          '• Learn more: cms.gov/nosurprises',
          '',
          'MY INSURANCE APPEAL RIGHTS',
          '• I have the right to an internal appeal with my insurance company',
          '• If my internal appeal is denied, I have the right to an external review by an independent party',
          '• Most plans allow 180 days from denial to file an appeal',
          '• Learn more: healthcare.gov/appeal-insurance-company-decision',
          '',
          'FAIR DEBT COLLECTION PRACTICES ACT',
          '• Debt collectors must verify the debt if I dispute it within 30 days',
          '• They cannot use abusive or harassing tactics against me',
          '• They must stop collection efforts while verifying my disputed debt',
        ],
      },
      {
        heading: `State Protections (${state})`,
        paragraphs: debtProtections.length > 0 
          ? debtProtections.map(p => `• ${p}`)
          : ['• I should check my state insurance department website for specific protections'],
      },
      {
        heading: 'State Relief Programs',
        bullets: reliefPrograms.length > 0
          ? reliefPrograms.map(p => `${p.name}: ${p.description}${p.link ? ` (${p.link})` : ''}`)
          : ['I can check with my state for available medical debt relief programs'],
      },
      {
        heading: 'Key Contacts I May Need',
        paragraphs: [
          'STATE INSURANCE DEPARTMENT',
          `• I can search: "${state} department of insurance consumer complaint"`,
          '• They handle complaints about insurance claim processing and denials',
          '',
          'STATE ATTORNEY GENERAL',
          `• I can search: "${state} attorney general consumer protection"`,
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
        heading: 'When I Should Use These Resources',
        bullets: [
          'My internal appeal with insurance has been denied and I want external review',
          'The provider refuses to correct billing errors or provide an itemized bill',
          'I am being sent to collections on a bill I am actively disputing',
          'I believe my rights under the No Surprises Act are being violated',
          'I need free help navigating a complex medical billing situation',
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
// TEXT/PDF GENERATION
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
  const disclaimerEn = DISCLAIMER_EN;
  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = (patientName || 'Patient').replace(/[^a-zA-Z0-9]/g, '_');
  const isNonEnglish = language !== 'en';
  
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

  // Add each document as DOCX and TXT to main folder
  for (const doc of documents) {
    // Generate DOCX with translated disclaimer
    const docxDoc = createDocxDocument(doc.content, disclaimer);
    const docxBlob = await Packer.toBlob(docxDoc);
    zip.file(`${doc.name}_DOCX.docx`, docxBlob);

    // Generate plain text
    const plainText = createPlainText(doc.content, disclaimer);
    zip.file(`${doc.name}_PDF.txt`, plainText);
  }

  // If non-English, also create ENGLISH_VERSION folder with all-English docs
  if (isNonEnglish) {
    const englishFolder = zip.folder('ENGLISH_VERSION');
    
    // Generate English versions
    const englishDocs = [
      {
        name: '01_Summary_and_Potential_Issues_ENG',
        content: generateSummaryDocument(analysis, eligibility, 'en', patientName),
      },
      {
        name: '02_Checklist_and_Timeline_Guide_ENG',
        content: generateChecklistDocument(analysis, 'en'),
      },
      {
        name: '03_Copy_Paste_Templates_ENG',
        content: generateTemplatesDocument(analysis, 'en', patientName),
      },
      {
        name: '04_Escalation_Letters_and_Templates_ENG',
        content: generateEscalationDocument(analysis, eligibility, 'en', patientName),
      },
      {
        name: '05_Additional_Resources_and_Laws_ENG',
        content: generateResourcesDocument(analysis, 'en'),
      },
    ];

    for (const doc of englishDocs) {
      const docxDoc = createDocxDocument(doc.content, disclaimerEn);
      const docxBlob = await Packer.toBlob(docxDoc);
      englishFolder?.file(`${doc.name}_DOCX.docx`, docxBlob);

      const plainText = createPlainText(doc.content, disclaimerEn);
      englishFolder?.file(`${doc.name}_PDF.txt`, plainText);
    }
  }

  // Add README
  const readme = `ROSETTA DISPUTE PACK
====================
Generated: ${dateStr}
Patient: ${safeName}

This package contains 5 documents to help you understand and dispute your medical bill.
Each document is provided in DOCX (Word) and TXT (printable) format.

FILES INCLUDED:
1. Summary & Potential Issues - Overview of your bill and issues found
2. Checklist & Timeline Guide - Step-by-step instructions
3. Copy & Paste Templates - Scripts for calling/emailing (in English for sending)
4. Escalation Letters - Formal dispute letters (fill in and send)
5. Additional Resources & Laws - Legal protections and contacts
${isNonEnglish ? '\nENGLISH_VERSION/ - Complete set of documents in English for sharing with advocates or English-speaking professionals\n' : ''}
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
