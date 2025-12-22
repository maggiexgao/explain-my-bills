import pondFrog from '@/assets/pond-frog.png';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full glass-card border-b-0">
      <div className="container flex h-12 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden bg-white/80 shadow-sm ring-2 ring-white/50">
            <img 
              src={pondFrog} 
              alt="pond frog logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-base text-foreground tracking-wide lowercase font-medium">
              pond
            </span>
            <span className="text-[9px] text-muted-foreground hidden sm:block">
              making healthcare clear.
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
