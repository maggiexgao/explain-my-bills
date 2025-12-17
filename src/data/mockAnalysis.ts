import { AnalysisResult } from '@/types';

export const mockAnalysisResult: AnalysisResult = {
  documentType: 'bill',
  issuer: 'Memorial Regional Medical Center',
  dateOfService: 'October 15, 2024',
  documentPurpose: 'This is a hospital bill summarizing charges for medical services you received. It shows what was billed, what your insurance may have paid, and what you may owe.',
  
  charges: [
    {
      id: 'charge-1',
      description: 'Emergency Room Visit - Level 4',
      amount: 1850.00,
      explanation: 'This charge is for the emergency room visit itself. Level 4 indicates a moderately complex visit requiring significant evaluation and treatment.',
    },
    {
      id: 'charge-2',
      description: 'Laboratory Services - Complete Blood Count',
      amount: 125.00,
      explanation: 'This is a common blood test that measures different components of your blood, often used to check for infections or other conditions.',
    },
    {
      id: 'charge-3',
      description: 'X-Ray - Chest, 2 Views',
      amount: 450.00,
      explanation: 'This charge covers chest X-rays taken from two different angles, commonly used to examine the lungs and heart.',
    },
    {
      id: 'charge-4',
      description: 'IV Fluid Administration',
      amount: 285.00,
      explanation: 'This covers the administration of fluids through an IV line, including the supplies and nursing time involved.',
    },
    {
      id: 'charge-5',
      description: 'Physician Services - Emergency Medicine',
      amount: 575.00,
      explanation: 'This is the fee for the emergency room physician who evaluated and treated you. Note: This may be billed separately from the hospital.',
    },
  ],
  
  medicalCodes: [
    {
      code: '99284',
      type: 'CPT',
      description: 'Emergency department visit for moderately severe problem',
      typicalPurpose: 'This code is used when the emergency room visit requires a detailed history, detailed examination, and moderate complexity medical decision making.',
      commonQuestions: [
        'Why was my visit classified as this level?',
        'Can the level be changed after my visit?',
        'Does a higher level always mean higher charges?',
      ],
    },
    {
      code: '85025',
      type: 'CPT',
      description: 'Complete blood count with automated differential',
      typicalPurpose: 'A routine blood test that provides information about the cells in your blood, including red cells, white cells, and platelets.',
      commonQuestions: [
        'Why was this test ordered?',
        'Is this considered a routine test?',
      ],
    },
    {
      code: '71046',
      type: 'CPT',
      description: 'Chest X-ray, 2 views',
      typicalPurpose: 'Standard chest imaging from front and side views to examine the heart, lungs, and chest wall.',
      commonQuestions: [
        'Why were two views needed?',
        'Is there a separate charge for reading the X-ray?',
      ],
    },
  ],
  
  faqs: [
    {
      question: 'Why is the total different from what I expected to pay?',
      answer: 'The total shown is often the "billed amount" before insurance adjustments. Your actual responsibility depends on your insurance plan\'s negotiated rates, deductible status, and coverage terms.',
    },
    {
      question: 'Why did my insurance pay less than the billed amount?',
      answer: 'Insurance companies typically have negotiated rates with healthcare providers that are lower than billed charges. The difference is often written off and not your responsibility.',
    },
    {
      question: 'Why am I receiving multiple bills for one visit?',
      answer: 'It\'s common to receive separate bills from the hospital facility, the physician(s) who treated you, and any specialists or labs involved. Each may bill independently.',
    },
    {
      question: 'Can I be charged for services I don\'t remember receiving?',
      answer: 'All services should be documented in your medical records. You have the right to request an itemized bill and compare it to your records.',
    },
  ],
  
  possibleIssues: [
    {
      issue: 'Patients sometimes ask about duplicate charges',
      explanation: 'The IV administration charge appears similar to another line item. Patients often request itemized bills to verify each charge represents a distinct service.',
    },
    {
      issue: 'Separate physician billing',
      explanation: 'The physician services may result in a separate bill from the doctor\'s practice. Many patients find it helpful to track both facility and professional charges.',
    },
    {
      issue: 'Insurance adjustment timing',
      explanation: 'This bill may have been generated before all insurance payments were applied. Patients typically wait for the Explanation of Benefits (EOB) before paying.',
    },
  ],
  
  financialAssistance: [
    'Charity Care Programs: Many hospitals offer charity care for patients who meet income guidelines. This can reduce or eliminate your bill entirely.',
    'Sliding Scale Discounts: Some facilities offer reduced rates based on household income, even if you don\'t qualify for full charity care.',
    'Prompt Pay Discounts: Asking about discounts for paying in full may result in 10-30% reduction at some facilities.',
    'Payment Plans: Most hospitals offer interest-free payment plans that can spread costs over 12-24 months.',
    'Financial Counselors: Hospital financial counselors can review your situation and explain all available options.',
  ],
  
  patientRights: [
    'No Surprises Act: Federal law protects you from surprise bills for emergency services and certain out-of-network care at in-network facilities.',
    'Itemized Bill Request: You have the right to receive a detailed, itemized bill showing each charge.',
    'Good Faith Estimate: Uninsured patients are entitled to receive cost estimates before scheduled services.',
    'State Balance Billing Laws: Many states have additional protections limiting what providers can bill beyond insurance payments.',
    'Appeal Rights: If insurance denies coverage, you typically have the right to appeal the decision.',
  ],
  
  actionPlan: [
    {
      step: 1,
      action: 'Wait for your Explanation of Benefits (EOB)',
      description: 'Many patients wait to receive their EOB from insurance before paying, as it shows the final adjusted amounts and what you actually owe.',
    },
    {
      step: 2,
      action: 'Request an itemized bill',
      description: 'Patients commonly request a detailed breakdown of all charges. This can be done by calling the billing department number on your statement.',
    },
    {
      step: 3,
      action: 'Compare documents',
      description: 'Many patients compare their itemized bill, EOB, and medical records to ensure charges match services received.',
    },
    {
      step: 4,
      action: 'Ask about financial assistance',
      description: 'If the amount is difficult to pay, patients often contact the hospital\'s financial assistance office to learn about available programs.',
    },
    {
      step: 5,
      action: 'Consider a payment plan',
      description: 'If full payment isn\'t possible, most facilities offer payment arrangements. Patients often request interest-free options.',
    },
    {
      step: 6,
      action: 'Keep records',
      description: 'Many patients find it helpful to save copies of all bills, EOBs, and correspondence, along with notes from any phone calls.',
    },
  ],
};
