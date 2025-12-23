import { AlertTriangle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="shrink-0 glass-card border-t border-border/30 border-x-0 border-b-0">
      <div className="container px-3 md:px-4 py-2 md:py-1.5">
        <div className="flex items-center justify-center gap-2 text-center">
          <AlertTriangle className="h-3.5 md:h-3 w-3.5 md:w-3 text-amber-600 shrink-0" />
          <p className="text-[11px] md:text-xs text-gray-700 leading-tight">
            <strong className="text-gray-900">Important:</strong> Educational only—not medical, legal, or financial advice.
            <a href="#" className="underline hover:text-gray-900 ml-1 hidden sm:inline">Learn more</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
