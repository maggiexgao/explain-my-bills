import rosettaLogo from '@/assets/rosetta-logo.png';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full glass-card border-b-0">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl accent-gradient shadow-glow p-1.5">
            <img 
              src={rosettaLogo} 
              alt="Rosetta Logo" 
              className="h-full w-full object-contain brightness-0 invert"
            />
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