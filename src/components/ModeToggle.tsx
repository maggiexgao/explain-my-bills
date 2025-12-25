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
    subtitle: 'Understand your medical bills.',
    icon: FileText,
  },
  {
    value: 'medical_document' as const,
    label: 'Medical Document',
    subtitle: 'Understand your visit notes and test results.',
    icon: Stethoscope,
  },
];

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="w-full">
      <div className="flex rounded-xl bg-background/40 backdrop-blur-sm p-1 border border-border/50 relative">
        {/* Sliding background indicator */}
        <div 
          className="absolute top-1 bottom-1 rounded-lg bg-primary shadow-glow transition-all duration-300 ease-out"
          style={{
            width: 'calc(50% - 4px)',
            left: mode === 'bill' ? '4px' : 'calc(50% + 0px)',
          }}
        />
        
        {modes.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.value;
          
          return (
            <button
              key={m.value}
              onClick={() => onModeChange(m.value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 text-sm font-medium relative z-10',
                isActive
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              style={{
                boxShadow: isActive ? 'inset 0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          );
        })}
      </div>
      
      {/* Subtitle for active mode */}
      <p className="text-center text-xs text-muted-foreground/80 mt-2 animate-fade-in lowercase">
        {modes.find(m => m.value === mode)?.subtitle}
      </p>
    </div>
  );
}
