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
      <div className="flex rounded-full bg-white/40 backdrop-blur-md p-1.5 border border-white/60 relative">
        {/* Sliding pill background */}
        <div 
          className="absolute top-1.5 bottom-1.5 rounded-full bg-white shadow-soft transition-all duration-500 ease-out"
          style={{
            width: 'calc(50% - 6px)',
            left: mode === 'bill' ? '6px' : 'calc(50%)',
            boxShadow: '0 2px 8px hsl(200 30% 50% / 0.15), 0 0 0 1px hsl(0 0% 100% / 0.8)',
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
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 text-sm font-medium relative z-10',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/80'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          );
        })}
      </div>
      
      {/* Subtitle for active mode */}
      <p className="text-center text-xs text-muted-foreground/70 mt-2 animate-fade-in">
        {modes.find(m => m.value === mode)?.subtitle}
      </p>
    </div>
  );
}
