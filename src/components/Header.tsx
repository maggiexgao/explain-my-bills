import { Shield } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full glass-card border-b-0">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl accent-gradient shadow-glow">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold text-foreground/95 tracking-tight">
              Rosetta
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block">
              Medical bills, decoded
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}