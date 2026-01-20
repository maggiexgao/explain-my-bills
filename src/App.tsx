import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { Language } from "@/types";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminDataImport from "./pages/AdminDataImport";
import DownloadData from "./pages/DownloadData";

const queryClient = new QueryClient();

const App = () => {
  const [language, setLanguage] = useState<Language>('en');

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider language={language} setLanguage={setLanguage}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/admin/data-import" element={<AdminDataImport />} />
              <Route path="/download-data" element={<DownloadData />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;
