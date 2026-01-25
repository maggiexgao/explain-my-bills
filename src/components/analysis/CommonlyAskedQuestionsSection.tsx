/**
 * CommonlyAskedQuestionsSection - Generates contextual FAQs based on services on the bill
 * Questions are dynamically generated based on the types of charges detected
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, MessageCircleQuestion, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BenchmarkLineResult } from '@/lib/medicareBenchmarkService';
import { CollapsibleGroup } from './CollapsibleGroup';

interface CommonlyAskedQuestionsSectionProps {
  lineItems: BenchmarkLineResult[];
}

interface FAQ {
  question: string;
  answer: string;
  relevance: 'high' | 'medium';
}

// Question templates based on service patterns
const questionTemplates: Array<{
  pattern: RegExp;
  questions: FAQ[];
}> = [
  {
    pattern: /lab|blood|culture|panel|urinalysis|cbc|cmp|lipid/i,
    questions: [
      {
        question: "Is it normal to be charged separately for each lab test?",
        answer: "Yes, but the markup is often extreme. Hospitals may charge $50-200 per test when the actual cost is $5-15. For future lab work, consider using Quest Diagnostics or LabCorp directly — they often charge 80-90% less than hospital labs for the same tests.",
        relevance: 'high',
      },
      {
        question: "Why are my lab charges so much higher than the benchmark reference?",
        answer: "Hospital labs typically price tests at 5-20× the benchmark rate. This is one of the most inflated categories in medical billing. If you're uninsured or underinsured, always ask for 'self-pay' or 'cash' pricing, which is usually 50-80% lower.",
        relevance: 'medium',
      },
    ],
  },
  {
    pattern: /emerg|er visit|ed visit|emergency room|emergency dept/i,
    questions: [
      {
        question: "Why is my ER visit so expensive if I only waited 2 hours?",
        answer: "ER charges include a 'facility fee' that covers 24/7 staffing, equipment availability, and overhead — regardless of how long you wait or how quickly you're treated. The actual physician fee is separate. For non-emergencies, urgent care centers are typically 70-80% cheaper.",
        relevance: 'high',
      },
      {
        question: "What does the ER 'level' (like Level 4 or Level 5) mean for my bill?",
        answer: "ER visits are coded by severity from Level 1 (minor) to Level 5 (life-threatening). Higher levels cost more. Level 4-5 charges are sometimes applied incorrectly for conditions that didn't require that level of care. If your visit seemed routine, it's worth asking why it was coded at a high level.",
        relevance: 'medium',
      },
    ],
  },
  {
    pattern: /iv\s|iv infusion|infusion|saline|lactated|fluids|hydration/i,
    questions: [
      {
        question: "Can I negotiate the IV therapy charges?",
        answer: "Yes, IV fluid charges are among the most inflated items on medical bills. A bag of saline costs the hospital $1-5 but may be billed at $100-500. Ask the billing department if they can reduce or remove these charges, especially if you were only mildly dehydrated.",
        relevance: 'high',
      },
      {
        question: "Was the IV really necessary for my condition?",
        answer: "IVs are sometimes used when oral fluids would suffice, partly because they're profitable. If you were alert and able to drink, you can ask your doctor why IV was chosen over oral hydration. This won't change your current bill, but helps you advocate next time.",
        relevance: 'medium',
      },
    ],
  },
  {
    pattern: /inject|drug|medication|pharm|j\d{4}/i,
    questions: [
      {
        question: "Why are hospital medication prices so high?",
        answer: "Hospitals use their own internal pricing (called 'chargemaster' rates) that often exceed retail pharmacy prices by 5-10×. A Tylenol might be billed at $15-30. For future visits, you can sometimes ask to take your own over-the-counter medications, though policies vary.",
        relevance: 'high',
      },
    ],
  },
  {
    pattern: /x-?ray|imaging|ct|mri|radiol|ultrasound|scan/i,
    questions: [
      {
        question: "Could I have gotten imaging done cheaper elsewhere?",
        answer: "Almost certainly yes, for non-emergency situations. Outpatient imaging centers typically charge 50-80% less than hospitals for the same scans. For future MRIs, CTs, or ultrasounds, ask your doctor if it can be done at an outpatient facility.",
        relevance: 'high',
      },
    ],
  },
  {
    pattern: /supply|supplies|dressing|bandage|gauze|kit/i,
    questions: [
      {
        question: "What are all these supply charges for?",
        answer: "Hospitals itemize supplies at marked-up prices. A box of tissues might appear as 'mucous recovery system' for $10. Basic bandages, gloves, and gowns can add hundreds to your bill. These are often the easiest charges to get reduced — ask billing to review and reduce supply charges.",
        relevance: 'high',
      },
    ],
  },
  {
    pattern: /eval|exam|visit|99\d{3}|physician/i,
    questions: [
      {
        question: "Why am I being billed by both the hospital AND the doctor?",
        answer: "This is called 'facility billing.' The hospital charges for the room, equipment, and support staff (facility fee), while the doctor charges separately for their time and expertise (professional fee). Both are legitimate charges, but you can negotiate each separately.",
        relevance: 'high',
      },
    ],
  },
];

// General questions that apply to most bills
const generalQuestions: FAQ[] = [
  {
    question: "What should I do first with this bill?",
    answer: "1) Request an itemized bill if you don't have one. 2) Check for obvious errors like duplicate charges or services you didn't receive. 3) Compare charges to Medicare rates (like we've done here). 4) If the bill seems high, call billing and ask about payment plans, financial assistance, or discounts for paying in full.",
    relevance: 'high',
  },
  {
    question: "Can I negotiate a medical bill even with insurance?",
    answer: "Yes. Your 'patient responsibility' portion is often negotiable, especially if it's high. Hospitals would rather get partial payment than send bills to collections. Ask about: charity care programs, prompt-pay discounts (10-20% off for paying immediately), or payment plans with no interest.",
    relevance: 'high',
  },
  {
    question: "How long do I have before this goes to collections?",
    answer: "Most providers wait 90-180 days before sending bills to collections. You have time to negotiate. While negotiating, make small good-faith payments ($25-50/month) to show you're working on it. Get any payment agreements in writing before paying large sums.",
    relevance: 'medium',
  },
];

function generateQuestions(lineItems: BenchmarkLineResult[]): FAQ[] {
  const questions: FAQ[] = [];
  const addedQuestions = new Set<string>();
  
  // Check each template pattern against line items
  for (const template of questionTemplates) {
    for (const item of lineItems) {
      const desc = item.description?.toLowerCase() || '';
      const code = item.hcpcs?.toUpperCase() || '';
      const combined = `${desc} ${code}`;
      
      if (template.pattern.test(combined)) {
        for (const q of template.questions) {
          if (!addedQuestions.has(q.question)) {
            questions.push(q);
            addedQuestions.add(q.question);
          }
        }
        break; // Only add questions once per pattern
      }
    }
  }
  
  // Add general questions that haven't been added
  for (const q of generalQuestions) {
    if (!addedQuestions.has(q.question)) {
      questions.push(q);
      addedQuestions.add(q.question);
    }
  }
  
  // Sort by relevance (high first), limit to 6 questions
  questions.sort((a, b) => {
    if (a.relevance === b.relevance) return 0;
    return a.relevance === 'high' ? -1 : 1;
  });
  
  return questions.slice(0, 6);
}

function QuestionCard({ faq }: { faq: FAQ }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="border-b border-border/20 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-3 flex items-start gap-3 text-left hover:bg-muted/10 transition-colors"
      >
        <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span className="text-sm font-medium text-foreground flex-1">
          {faq.question}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      
      {expanded && (
        <div className="pb-3 pl-7 pr-3 animate-fade-in">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {faq.answer}
          </p>
        </div>
      )}
    </div>
  );
}

export function CommonlyAskedQuestionsSection({ lineItems }: CommonlyAskedQuestionsSectionProps) {
  const questions = generateQuestions(lineItems);
  
  if (questions.length === 0) {
    return null;
  }
  
  return (
    <CollapsibleGroup
      title="Commonly Asked Questions"
      subtitle="Based on the services on your bill"
      icon={<MessageCircleQuestion className="h-4 w-4" />}
      iconClassName="bg-primary/20 text-primary"
      badge={
        <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">
          {questions.length} questions
        </Badge>
      }
      defaultOpen={false}
      infoTooltip="Frequently asked questions about the types of services on your bill"
    >
      <div className="divide-y divide-border/20">
        {questions.map((faq, idx) => (
          <QuestionCard key={idx} faq={faq} />
        ))}
      </div>
    </CollapsibleGroup>
  );
}
