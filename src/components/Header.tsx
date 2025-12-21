import { JewelLogo } from './JewelLogo';
import { useTranslation } from '@/i18n/LanguageContext';

export function Header() {
  const { t } = useTranslation();
  
  return (
    <header className="sticky top-0 z-50 w-full glass-card border-b-0">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl accent-gradient shadow-glow p-2">
            <JewelLogo className="h-full w-full text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-logo text-xl text-foreground/95 tracking-widest uppercase">
              ROSETTA
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block">
              {t('app.subtitle')}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}