import { FileText, Stethoscope } from 'lucide-react';
import { AnalysisMode } from '@/types';
import { cn } from '@/lib/utils';

interface ModeToggleProps {
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
}

const modes = [
  {
    value: 'bill' as const,
    label: 'Bill Analysis',
    subtitle: 'Understand your medical bills and what you can do about them.',
    icon: FileText,
  },
  {
    value: 'medical_document' as const,
    label: 'Medical Document',
    subtitle: 'Understand your visit notes, test results, and medical paperwork.',
    icon: Stethoscope,
  },
];

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="w-full">
      <div className="flex rounded-xl bg-background/40 backdrop-blur-sm p-1 border border-border/50">
        {modes.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.value;
          
          return (
            <button
              key={m.value}
              onClick={() => onModeChange(m.value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 text-sm font-medium',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          );
        })}
      </div>
      
      {/* Subtitle for active mode */}
      <p className="text-center text-sm text-muted-foreground mt-3 animate-fade-in">
        {modes.find(m => m.value === mode)?.subtitle}
      </p>
    </div>
  );
}
