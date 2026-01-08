import { AnalysisResult } from '@/types';

export const mockAnalysisResult: AnalysisResult = {
  documentType: 'bill',
  issuer: 'Memorial Regional Medical Center',
  dateOfService: 'October 15, 2024',
  documentPurpose: 'This is a hospital bill summarizing charges for medical services you received. It shows what was billed, what your insurance may have paid, and what you may owe.',
  
  // === POND SECTIONS ===
  atAGlance: {
    visitSummary: 'Emergency room visit for evaluation and testing',
    totalBilled: 3285.00,
    amountYouMayOwe: 850.00,
    status: 'worth_reviewing',
    statusExplanation: 'Based on what\'s shown here, the ER visit coding and some charges are worth verifying before paying.',
  },
  
  thingsWorthReviewing: [
    {
      whatToReview: 'ER visit coded at Level 4',
      whyItMatters: 'Level 4 visits are for moderately complex cases. If your visit felt routine or quick, the coding may be higher than necessary.',
      issueType: 'negotiable',
    },
    {
      whatToReview: 'IV administration charge ($285)',
      whyItMatters: 'This charge sometimes overlaps with other nursing or supply charges. An itemized bill can confirm what this covers.',
      issueType: 'confirmation',
    },
  ],
  reviewSectionNote: undefined,
  
  savingsOpportunities: [
    {
      whatMightBeReduced: 'Hospital financial assistance',
      whyNegotiable: 'Nonprofit hospitals are required to offer charity care. Many patients qualify for 50-100% reduction based on income.',
      additionalInfoNeeded: 'Income documentation such as pay stubs or tax returns',
      savingsContext: 'Patients earning up to 400% of the federal poverty level often qualify',
    },
    {
      whatMightBeReduced: 'Prompt-pay discount',
      whyNegotiable: 'Many hospitals offer 10-30% off for paying the full balance immediately.',
      savingsContext: 'Just ask: "Do you offer a discount if I pay today?"',
    },
    {
      whatMightBeReduced: 'ER visit level review',
      whyNegotiable: 'ER coding levels are frequently challenged. If your visit was straightforward, a lower level may apply.',
      additionalInfoNeeded: 'Medical records documenting the complexity of your visit',
    },
  ],
  
  conversationScripts: {
    firstCallScript: 'Hi, I\'m calling about my bill from my October 15th ER visit. I\'d like to request an itemized bill showing all charges with CPT codes, and also ask about any financial assistance programs I might qualify for.',
    ifTheyPushBack: 'I understand. I\'d like to understand the charges before making payment. Can you transfer me to someone who can explain the itemization, or should I submit this request in writing?',
    whoToAskFor: 'Ask for the billing department first. If you need help with financial assistance, ask for the financial counselor or patient financial services.',
  },
  
  chargeMeanings: [
    {
      cptCode: '99284',
      procedureName: 'Emergency Room Visit - Level 4',
      explanation: 'A moderately complex ER visit where the doctor evaluated your condition in detail. The "level" reflects how much time and decision-making was involved.',
      commonBillingIssues: ['Upcoding to a higher level than documented', 'Separate physician bill may also arrive'],
      isGeneral: false,
    },
    {
      cptCode: '85025',
      procedureName: 'Complete Blood Count',
      explanation: 'A common blood test that checks your red cells, white cells, and platelets. Used to screen for infections and other conditions.',
      isGeneral: false,
    },
    {
      cptCode: '71046',
      procedureName: 'Chest X-ray (2 views)',
      explanation: 'X-ray images of your chest from front and side, used to examine lungs and heart.',
      commonBillingIssues: ['May have separate radiologist reading fee'],
      isGeneral: false,
    },
    {
      procedureName: 'IV Fluid Administration',
      explanation: 'The cost of fluids given through an IV line, including supplies and nursing time.',
      commonBillingIssues: ['Sometimes duplicated with other nursing charges'],
      isGeneral: true,
    },
  ],
  
  negotiability: [
    {
      chargeOrCategory: 'Emergency Room Visit',
      level: 'sometimes_negotiable',
      reason: 'ER coding levels can be reviewed if documentation doesn\'t support the complexity charged',
    },
    {
      chargeOrCategory: 'Lab Tests (CBC)',
      level: 'rarely_negotiable',
      reason: 'Lab charges are typically standardized, but financial assistance may apply',
    },
    {
      chargeOrCategory: 'Imaging (X-ray)',
      level: 'rarely_negotiable',
      reason: 'Imaging rates are usually fixed, but prompt-pay discounts may reduce the total',
    },
    {
      chargeOrCategory: 'Hospital Financial Assistance',
      level: 'highly_negotiable',
      reason: 'Nonprofit hospitals must offer charity care to qualifying patients',
    },
  ],
  
  priceContext: {
    hasBenchmarks: true,
    comparisons: [
      {
        service: 'ER Visit Level 4 (99284)',
        billedAmount: 1850,
        typicalRange: '$800 - $2,500',
        notes: 'Your charge is within the typical range for this area',
      },
      {
        service: 'Complete Blood Count',
        billedAmount: 125,
        typicalRange: '$30 - $200',
        notes: 'Hospital labs are typically higher than standalone labs',
      },
    ],
  },
  
  pondNextSteps: [
    { step: 'Wait for your Explanation of Benefits (EOB) before paying' },
    { step: 'Request an itemized bill with CPT codes' },
    { step: 'Call to ask about financial assistance programs' },
    { step: 'Compare the EOB to your bill when it arrives' },
  ],
  
  closingReassurance: 'Medical bills are often negotiable, and asking questions is normal. You\'re not being difficult — you\'re being careful.',
  
  // === LEGACY FIELDS ===
  
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

  // New structured fields for the two-accordion UX
  cptCodes: [
    {
      code: '99284',
      shortLabel: 'ER Visit Level 4',
      explanation: 'A moderately complex emergency room visit where the doctor spent significant time evaluating your condition and deciding on treatment.',
      category: 'evaluation',
      whereUsed: 'Emergency departments for visits requiring detailed evaluation',
      complexityLevel: 'moderate',
      commonQuestions: [
        {
          question: 'Why was my visit classified as Level 4?',
          answer: 'Level 4 visits involve detailed examination and moderate decision-making. The doctor had to consider multiple possible diagnoses or treatment options.',
          callWho: 'billing',
        },
        {
          question: 'Can the level be changed after my visit?',
          answer: 'In some cases, yes. If you believe the level is inaccurate, you can request a review from the billing department.',
          callWho: 'billing',
        },
      ],
    },
    {
      code: '85025',
      shortLabel: 'Complete Blood Count',
      explanation: 'A common blood test that checks your red blood cells, white blood cells, and platelets to look for infections or other conditions.',
      category: 'lab',
      whereUsed: 'Primary care, emergency rooms, hospitals - very common test',
      complexityLevel: 'simple',
      commonQuestions: [
        {
          question: 'Why was this test ordered?',
          answer: 'CBCs help doctors check for infections, anemia, and other conditions. It\'s one of the most common tests ordered in emergency settings.',
          callWho: 'billing',
        },
      ],
    },
    {
      code: '71046',
      shortLabel: 'Chest X-ray (2 views)',
      explanation: 'X-ray images of your chest from the front and side, used to look at your lungs, heart, and chest wall.',
      category: 'radiology',
      whereUsed: 'Emergency rooms, hospitals, urgent care for respiratory or chest concerns',
      complexityLevel: 'simple',
      commonQuestions: [
        {
          question: 'Why were two views needed?',
          answer: 'Two views provide a more complete picture of your chest. One view alone might miss something hidden behind the heart or spine.',
          callWho: 'either',
        },
        {
          question: 'Is there a separate charge for reading the X-ray?',
          answer: 'Often yes. The technical fee covers taking the X-ray, while a professional fee covers the radiologist reading it.',
          callWho: 'billing',
        },
      ],
    },
  ],

  visitWalkthrough: [
    {
      order: 1,
      description: 'You arrived at the emergency room and were checked in.',
      relatedCodes: [],
    },
    {
      order: 2,
      description: 'A doctor evaluated your condition, taking your medical history and examining you.',
      relatedCodes: ['99284'],
    },
    {
      order: 3,
      description: 'Blood was drawn for testing to check for infections or other issues.',
      relatedCodes: ['85025'],
    },
    {
      order: 4,
      description: 'You had chest X-rays taken to examine your lungs and heart.',
      relatedCodes: ['71046'],
    },
    {
      order: 5,
      description: 'You received IV fluids while being monitored.',
      relatedCodes: [],
    },
    {
      order: 6,
      description: 'The doctor reviewed your test results and discussed next steps with you.',
      relatedCodes: ['99284'],
    },
  ],

  codeQuestions: [
    {
      cptCode: '99284',
      question: 'Why am I being charged for both a facility fee and a doctor fee?',
      answer: 'The hospital charges for the room, equipment, and staff (facility fee), while the doctor bills separately for their professional services. This is standard practice.',
      suggestCall: 'billing',
    },
    {
      cptCode: '85025',
      question: 'Is this the same as a "routine blood test"?',
      answer: 'A CBC is one of the most common blood tests, but "routine" can mean different things. In an ER setting, it\'s used diagnostically rather than for screening.',
      suggestCall: 'either',
    },
    {
      cptCode: '71046',
      question: 'Why is imaging so expensive?',
      answer: 'Imaging costs include the equipment, specialized staff, and radiologist interpretation. Emergency settings often have higher costs than outpatient centers.',
      suggestCall: 'billing',
    },
  ],

  billingEducation: {
    billedVsAllowed: 'The "billed amount" ($3,285) is what the hospital charges. The "allowed amount" is the maximum your insurance will pay for these services - often 40-60% less than the billed amount.',
    deductibleExplanation: 'Your deductible is the amount you pay out-of-pocket before insurance starts covering costs. If you haven\'t met your deductible yet, you may owe more.',
    copayCoinsurance: 'A copay is a fixed amount per visit (like $150 for ER visits). Coinsurance is a percentage of the allowed amount you pay (like 20%) after meeting your deductible.',
  },

  stateHelp: {
    state: 'California',
    medicaidInfo: {
      description: 'Medi-Cal provides free or low-cost health coverage for Californians with limited income. Emergency room visits are covered.',
      eligibilityLink: 'https://www.dhcs.ca.gov/services/medi-cal',
    },
    chipInfo: {
      description: 'Covered California offers health insurance options including subsidized plans based on income.',
      eligibilityLink: 'https://www.coveredca.com/',
    },
    debtProtections: [
      'California law limits interest on medical debt to 10% per year.',
      'Medical debt under $500 cannot be reported to credit bureaus until 12 months after the first billing.',
      'Nonprofit hospitals must offer charity care to patients earning up to 400% of the federal poverty level.',
    ],
    reliefPrograms: [
      {
        name: 'Hospital Charity Care',
        description: 'California nonprofit hospitals are required to have financial assistance policies and cannot deny emergency care.',
        link: 'https://www.dhcs.ca.gov/services/Pages/Hospital-Fair-Pricing-Policies.aspx',
      },
      {
        name: 'California Medical Debt Relief',
        description: 'State program helping eligible residents eliminate medical debt through negotiation with providers.',
      },
    ],
  },

  providerAssistance: {
    providerName: 'Memorial Regional Medical Center',
    providerType: 'hospital',
    charityCareSummary: 'As a nonprofit hospital, Memorial Regional offers financial assistance to patients who qualify based on income. This can reduce or eliminate your bill.',
    financialAssistanceLink: 'https://www.memorialregional.example.com/financial-assistance',
    eligibilityNotes: 'Patients earning up to 400% of the federal poverty level may qualify for reduced or free care. You\'ll need to provide income documentation.',
  },

  debtAndCreditInfo: [
    'Medical debt under $500 typically cannot appear on your credit report.',
    'You have at least 12 months before most medical debt can be reported to credit bureaus.',
    'Paid medical debt must be removed from credit reports within 45 days.',
    'You can dispute inaccurate medical debt on your credit report at no cost.',
    'Collection agencies cannot charge interest beyond what\'s in your original agreement.',
  ],

  billingIssues: [
    {
      type: 'duplicate',
      title: 'IV Administration appears similar to another charge',
      description: 'The IV administration charge ($285) may overlap with other services. This is worth verifying with an itemized bill.',
      suggestedQuestion: 'Can you explain what the IV administration charge covers and confirm it\'s not duplicated elsewhere on my bill?',
      severity: 'info',
      relatedCodes: [],
    },
    {
      type: 'upcoding',
      title: 'ER visit coded at Level 4',
      description: 'Level 4 visits are for moderately complex cases. If your visit felt routine or quick, you may want to ask about the coding.',
      suggestedQuestion: 'Can you explain why my visit was coded as Level 4? What criteria determined this level?',
      severity: 'warning',
      relatedCodes: ['99284'],
    },
  ],

  financialOpportunities: [
    {
      title: 'Hospital Financial Assistance',
      description: 'Memorial Regional offers charity care that could reduce or eliminate your bill based on income.',
      eligibilityHint: 'If your household income is below $60,000/year (for a family of 4), you may qualify.',
      effortLevel: 'short_form',
      link: 'https://www.memorialregional.example.com/financial-assistance',
    },
    {
      title: 'Payment Plan',
      description: 'Interest-free payment plans are available for balances over $500.',
      eligibilityHint: 'Available to all patients. Call billing to set up.',
      effortLevel: 'quick_call',
    },
    {
      title: 'Prompt Pay Discount',
      description: 'Some hospitals offer 10-30% discount for paying the full balance upfront.',
      eligibilityHint: 'Ask the billing department if this is available.',
      effortLevel: 'quick_call',
    },
  ],

  billingTemplates: [
    {
      target: 'billing',
      purpose: 'Request an itemized bill',
      template: 'Hi, I\'m calling about my account. Can you please send me a fully itemized bill showing each charge with the CPT codes? I\'d like to review the details before making payment.',
      whenToUse: 'Before paying any bill, especially if it only shows summary amounts.',
    },
    {
      target: 'billing',
      purpose: 'Ask about a potential duplicate charge',
      template: 'I noticed the IV administration charge on my bill. Can you help me understand what this covers and confirm it\'s not duplicated with any other charges?',
      whenToUse: 'When you see charges that seem similar or overlapping.',
    },
    {
      target: 'billing',
      purpose: 'Ask about financial assistance',
      template: 'I\'m having difficulty paying this bill. Can you tell me about any financial assistance programs or charity care that might be available? What documentation would I need to apply?',
      whenToUse: 'When the bill amount is more than you can afford.',
    },
  ],

  insuranceTemplates: [
    {
      target: 'insurance',
      purpose: 'Verify what you actually owe',
      template: 'I received a bill from Memorial Regional Medical Center for my October 15th ER visit. Can you confirm the allowed amount, what you paid, and what my actual patient responsibility is?',
      whenToUse: 'To confirm the bill amount matches what insurance says you owe.',
    },
    {
      target: 'insurance',
      purpose: 'Ask about deductible status',
      template: 'Can you tell me how much of my deductible I\'ve met this year? I want to understand how that affected the payment for my recent ER visit.',
      whenToUse: 'When trying to understand why you owe a large amount.',
    },
    {
      target: 'insurance',
      purpose: 'Question a denied claim',
      template: 'I received a denial for my ER visit claim. Can you explain why it was denied and what my options are for appealing this decision?',
      whenToUse: 'If insurance denied coverage for any services.',
    },
  ],

  // New 4-section fields
  potentialErrors: [],
  needsAttention: [
    {
      type: 'upcoding',
      title: 'ER visit coded at Level 4',
      description: 'Level 4 visits are for moderately complex cases. If your visit felt routine or quick, you may want to ask about the coding.',
      suggestedQuestion: 'Can you explain why my visit was coded as Level 4? What criteria determined this level?',
      severity: 'warning',
      relatedCodes: ['99284'],
    },
  ],
  providerContactInfo: {
    providerName: 'Memorial Regional Medical Center',
    billingPhone: '(555) 123-4567',
    billingEmail: 'billing@memorialregional.example.com',
    mailingAddress: '1234 Healthcare Blvd, Los Angeles, CA 90001',
    insurerName: 'Blue Cross Blue Shield',
    memberServicesPhone: '(800) 555-1234',
  },
  actionSteps: [
    {
      order: 1,
      action: 'Wait for your EOB from insurance',
      details: 'Your Explanation of Benefits will show what insurance paid and what you actually owe.',
    },
    {
      order: 2,
      action: 'Request an itemized bill',
      details: 'Call the billing number on your statement to get a detailed breakdown of all charges.',
    },
    {
      order: 3,
      action: 'Ask about financial assistance',
      details: 'Contact the hospital financial assistance office to learn about charity care or payment plans.',
    },
  ],
  whenToSeekHelp: [
    'A patient advocate at the hospital can help navigate billing disputes.',
    'Your state attorney general\'s office handles healthcare billing complaints.',
    'Nonprofit credit counseling agencies can help with medical debt.',
  ],
};
