import { FrogLogo } from './FrogLogo';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full glass-card border-b-0">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-400 to-teal-500 shadow-lg p-1">
            <FrogLogo className="h-full w-full" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-xl text-foreground/95 tracking-wide lowercase font-medium">
              pond
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block">
              making healthcare clear.
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}