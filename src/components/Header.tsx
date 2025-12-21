import { Shield, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Language, LANGUAGES } from '@/types';

interface HeaderProps {
  selectedLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  showLanguageSelector?: boolean;
}

export function Header({ selectedLanguage, onLanguageChange, showLanguageSelector = true }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-semibold text-foreground">
              Rosetta
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block">
              Medical bills, decoded
            </span>
          </div>
        </div>

        {showLanguageSelector && (
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedLanguage} onValueChange={(v) => onLanguageChange(v as Language)}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <span className="flex items-center gap-2">
                      <span>{lang.nativeLabel}</span>
                      {lang.value !== 'en' && (
                        <span className="text-muted-foreground text-xs">({lang.label})</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </header>
  );
}
