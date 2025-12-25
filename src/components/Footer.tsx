import { AlertTriangle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="shrink-0 glass-card border-t border-border/20 border-x-0 border-b-0">
      <div className="container px-3 md:px-4 py-2 md:py-1.5">
        <div className="flex items-center justify-center gap-2 text-center">
          <AlertTriangle className="h-3 md:h-2.5 w-3 md:w-2.5 text-muted-foreground/50 shrink-0" />
          <p className="text-[10px] md:text-[11px] text-muted-foreground/60 leading-tight lowercase">
            <span className="text-muted-foreground/70">important:</span> educational only—not medical, legal, or financial advice.
            <a href="#" className="underline hover:text-muted-foreground ml-1 hidden sm:inline">learn more</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
