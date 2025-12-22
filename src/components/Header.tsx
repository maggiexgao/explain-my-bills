import pondFrog from '@/assets/pond-frog.png';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full glass-card border-b-0">
      <div className="container flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden bg-[hsl(190_30%_75%)] shadow-md">
            <img 
              src={pondFrog} 
              alt="pond frog logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-lg text-foreground/95 tracking-wide lowercase font-medium">
              pond
            </span>
            <span className="text-[10px] text-muted-foreground hidden sm:block leading-none">
              making healthcare clear.
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
