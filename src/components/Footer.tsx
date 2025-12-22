import { AlertTriangle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/30">
      <div className="container px-4 py-6 md:px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-start gap-3 max-w-2xl p-4 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Important:</strong> This tool provides educational information only. 
              It is not medical, legal, or financial advice. Always consult qualified professionals 
              for specific guidance about your situation.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} pond. Your privacy is protected. 
            Documents are processed securely and not stored.
          </p>
        </div>
      </div>
    </footer>
  );
}
