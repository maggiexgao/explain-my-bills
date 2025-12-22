import { AlertTriangle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="shrink-0 glass-card border-t border-border/30 border-x-0 border-b-0">
      <div className="container px-4 py-1.5 md:px-6">
        <div className="flex items-center justify-center gap-2 text-center">
          <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
          <p className="text-[10px] text-muted-foreground">
            <strong className="text-foreground/80">Important:</strong> Educational only—not medical, legal, or financial advice. 
            <a href="#" className="underline hover:text-foreground ml-1">Learn more</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
