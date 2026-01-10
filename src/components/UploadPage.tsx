import { FileUploader } from '@/components/FileUploader';
import { EOBUploader } from '@/components/EOBUploader';
import { ModeToggle } from '@/components/ModeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowRight, MapPin, Lock, FileSearch, Shield, Globe, BookOpen, HelpCircle, Building2, Stethoscope, Sparkles, Loader2, Bug, ChevronDown } from 'lucide-react';
import { UploadedFile, US_STATES, Language, LANGUAGES, AnalysisMode, CareSetting } from '@/types';
import { useTranslation } from '@/i18n/LanguageContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LocationSource, PreScanLocationResult } from '@/hooks/usePreScanLocation';
import { useState } from 'react';

interface UploadPageProps {
  uploadedFile: UploadedFile | null;
  eobFile: UploadedFile | null;
  selectedState: string;
  selectedLanguage: Language;
  zipCode: string;
  careSetting: CareSetting;
  analysisMode: AnalysisMode;
  zipSource: LocationSource;
  stateSource: LocationSource;
  isScanning?: boolean;
  preScanResult?: PreScanLocationResult | null;
  onFileSelect: (file: UploadedFile) => void;
  onRemoveFile: () => void;
  onEOBSelect: (file: UploadedFile) => void;
  onRemoveEOB: () => void;
  onStateChange: (state: string) => void;
  onLanguageChange: (language: Language) => void;
  onZipCodeChange: (zipCode: string) => void;
  onCareSettingChange: (setting: CareSetting) => void;
  onModeChange: (mode: AnalysisMode) => void;
  onAnalyze: () => void;
}

export function UploadPage({
  uploadedFile,
  eobFile,
  selectedState,
  selectedLanguage,
  zipCode,
  careSetting,
  analysisMode,
  zipSource,
  stateSource,
  isScanning,
  preScanResult,
  onFileSelect,
  onRemoveFile,
  onEOBSelect,
  onRemoveEOB,
  onStateChange,
  onLanguageChange,
  onZipCodeChange,
  onCareSettingChange,
  onModeChange,
  onAnalyze,
}: UploadPageProps) {
  const { t } = useTranslation();
  const [showDebug, setShowDebug] = useState(false);
  const canAnalyze = uploadedFile && selectedState;
  const isMedicalDoc = analysisMode === 'medical_document';
  
  // Show detected badges based on source
  const showZipDetectedBadge = zipSource === 'detected' && zipCode;
  const showStateDetectedBadge = stateSource === 'detected' && selectedState;

  // Mode-specific content
  const content = {
    bill: {
      subtitle: 'Understand your medical bills and what you may owe.',
      features: [
        { icon: FileSearch, label: 'Line-by-line', color: 'text-coral' },
        { icon: Shield, label: 'State protections', color: 'text-purple' },
        { icon: Lock, label: 'Private', color: 'text-teal' },
      ],
      buttonText: t('upload.analyze'),
    },
    medical_document: {
      subtitle: 'Understand your visit notes, test results, and paperwork.',
      features: [
        { icon: BookOpen, label: 'Plain language', color: 'text-coral' },
        { icon: HelpCircle, label: 'Terms defined', color: 'text-purple' },
        { icon: Lock, label: 'Secure', color: 'text-sky' },
      ],
      buttonText: 'Analyze Document',
    },
  };

  const currentContent = content[analysisMode];

  return (
    <div className="h-full flex flex-col items-center justify-start md:justify-center px-3 md:px-4 py-4 md:py-0 overflow-y-auto">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Enhanced glassmorphism card - sitting on water effect */}
        <div className="glass-card-enhanced p-3 md:p-4 space-y-2.5 md:space-y-2.5 animate-slide-up">
          {/* Mode Toggle - Full width on mobile */}
          <ModeToggle mode={analysisMode} onModeChange={onModeChange} />

          {/* Mode subtitle - visible on mobile */}
          <p className="text-xs text-muted-foreground text-center md:hidden leading-tight">
            {currentContent.subtitle}
          </p>

          {/* File uploaders */}
          <div className="space-y-1.5">
            <FileUploader
              uploadedFile={uploadedFile}
              onFileSelect={onFileSelect}
              onRemoveFile={onRemoveFile}
              mode={analysisMode}
            />
            
            {/* Compact supported docs for Medical Document mode */}
            {isMedicalDoc && !uploadedFile && (
              <p className="text-[9px] md:text-[9px] text-muted-foreground/70 text-center leading-tight">
                Lab results, imaging reports, visit summaries, prescriptions
              </p>
            )}

            {/* EOB uploader only for bill mode */}
            {!isMedicalDoc && (
              <EOBUploader
                uploadedFile={eobFile}
                onFileSelect={onEOBSelect}
                onRemoveFile={onRemoveEOB}
              />
            )}
          </div>

          {/* State, ZIP, and Care Setting selectors */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5 animate-slide-up" style={{ animationDelay: '0.15s' }}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground lowercase">
                  <MapPin className="h-2.5 w-2.5 text-purple" />
                  {t('upload.state.label')}
                </label>
                {showStateDetectedBadge && (
                  <Badge variant="outline" className="h-4 px-1 text-[8px] bg-success/10 text-success border-success/30 gap-0.5">
                    <Sparkles className="h-2 w-2" />
                    detected
                  </Badge>
                )}
              </div>
              <Select value={selectedState} onValueChange={onStateChange}>
                <SelectTrigger className="w-full h-10 md:h-8 text-sm md:text-xs bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                  <SelectValue placeholder={t('upload.state.placeholder')} />
                </SelectTrigger>
                <SelectContent className="max-h-[180px] bg-popover/95 backdrop-blur-md z-50">
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value} className="text-sm md:text-xs">
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ZIP Code - only for bill mode */}
            {!isMedicalDoc && (
              <div className="space-y-0.5 animate-slide-up" style={{ animationDelay: '0.17s' }}>
                <div className="flex items-center justify-between">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground lowercase cursor-help">
                          <MapPin className="h-2.5 w-2.5 text-sky" />
                          ZIP code
                          <HelpCircle className="h-2.5 w-2.5 opacity-50" />
                        </label>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px]">
                        <p className="text-xs">For accurate Medicare rate comparison based on your location</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {isScanning ? (
                    <Badge variant="outline" className="h-4 px-1 text-[8px] bg-muted/50 text-muted-foreground border-border/50 gap-0.5">
                      <Loader2 className="h-2 w-2 animate-spin" />
                      scanning
                    </Badge>
                  ) : showZipDetectedBadge ? (
                    <Badge variant="outline" className="h-4 px-1 text-[8px] bg-success/10 text-success border-success/30 gap-0.5">
                      <Sparkles className="h-2 w-2" />
                      {preScanResult?.stateSource === 'zip_lookup' ? 'detected (from ZIP)' : 'detected'}
                    </Badge>
                  ) : null}
                </div>
                <Input
                  type="text"
                  value={zipCode}
                  onChange={(e) => onZipCodeChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="e.g., 90210"
                  className="w-full h-10 md:h-8 text-sm md:text-xs bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors"
                  maxLength={5}
                />
              </div>
            )}

            {/* Language selector - show for medical doc mode, or in second row for bill */}
            {isMedicalDoc && (
              <div className="space-y-0.5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground lowercase">
                  <Globe className="h-2.5 w-2.5 text-coral" />
                  {t('upload.language.label')}
                </label>
                <Select value={selectedLanguage} onValueChange={(v) => onLanguageChange(v as Language)}>
                  <SelectTrigger className="w-full h-10 md:h-8 text-sm md:text-xs bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                    <SelectValue placeholder={t('upload.language.label')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover/95 backdrop-blur-md z-50">
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value} className="text-sm md:text-xs">
                        <span className="flex items-center gap-1">
                          <span>{lang.nativeLabel}</span>
                          {lang.value !== 'en' && (
                            <span className="text-muted-foreground text-[9px]">({lang.label})</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Care Setting & Language for bill mode */}
          {!isMedicalDoc && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground lowercase cursor-help">
                        <Building2 className="h-2.5 w-2.5 text-teal" />
                        care setting
                        <HelpCircle className="h-2.5 w-2.5 opacity-50" />
                      </label>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px]">
                      <p className="text-xs">Medicare rates differ based on setting. Choose "Facility" for hospital/ER visits.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={careSetting === 'office' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onCareSettingChange('office')}
                    className="flex-1 h-10 md:h-8 text-xs gap-1"
                  >
                    <Stethoscope className="h-3 w-3" />
                    Office
                  </Button>
                  <Button
                    type="button"
                    variant={careSetting === 'facility' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onCareSettingChange('facility')}
                    className="flex-1 h-10 md:h-8 text-xs gap-1"
                  >
                    <Building2 className="h-3 w-3" />
                    Facility
                  </Button>
                </div>
              </div>

              <div className="space-y-0.5 animate-slide-up" style={{ animationDelay: '0.22s' }}>
                <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground lowercase">
                  <Globe className="h-2.5 w-2.5 text-coral" />
                  {t('upload.language.label')}
                </label>
                <Select value={selectedLanguage} onValueChange={(v) => onLanguageChange(v as Language)}>
                  <SelectTrigger className="w-full h-10 md:h-8 text-sm md:text-xs bg-background/60 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-colors">
                    <SelectValue placeholder={t('upload.language.label')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover/95 backdrop-blur-md z-50">
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value} className="text-sm md:text-xs">
                        <span className="flex items-center gap-1">
                          <span>{lang.nativeLabel}</span>
                          {lang.value !== 'en' && (
                            <span className="text-muted-foreground text-[9px]">({lang.label})</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Analyze button - larger touch target on mobile */}
          <Button
            size="lg"
            className={`w-full h-11 md:h-9 text-base md:text-sm font-semibold rounded-xl transition-all duration-300 relative overflow-hidden group ${
              canAnalyze 
                ? 'accent-gradient text-primary-foreground shadow-glow hover:shadow-glow-active' 
                : 'bg-muted/60 text-muted-foreground cursor-not-allowed'
            }`}
            disabled={!canAnalyze}
            onClick={onAnalyze}
          >
            {canAnalyze && (
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 rounded-full bg-white/25 group-hover:w-full group-hover:h-full group-hover:scale-150 transition-all duration-500" />
              </span>
            )}
            <span className="relative z-10 flex items-center gap-2">
              {currentContent.buttonText}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Button>

          {/* Pre-scan Debug Panel - Only show in bill mode when there's a scan result */}
          {!isMedicalDoc && preScanResult && (
            <Collapsible open={showDebug} onOpenChange={setShowDebug} className="mt-2">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full h-6 text-[10px] text-muted-foreground/60 hover:text-muted-foreground gap-1"
                >
                  <Bug className="h-2.5 w-2.5" />
                  Pre-scan Debug
                  <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showDebug ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1">
                <div className="p-2 rounded-lg bg-background/40 backdrop-blur-sm border border-border/30 text-[9px] font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Scan ran:</span>
                    <span className={preScanResult.ran ? 'text-success' : 'text-destructive'}>
                      {preScanResult.ran ? '✓ yes' : '✗ no'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ZIP detected:</span>
                    <span className={preScanResult.zip5 ? 'text-success' : 'text-muted-foreground'}>
                      {preScanResult.zip5 || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">State detected:</span>
                    <span className={preScanResult.stateAbbr ? 'text-success' : 'text-muted-foreground'}>
                      {preScanResult.stateAbbr || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">State source:</span>
                    <span>{preScanResult.stateSource || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confidence:</span>
                    <Badge 
                      variant="outline" 
                      className={`h-3.5 px-1 text-[8px] ${
                        preScanResult.confidence === 'high' ? 'bg-success/10 text-success border-success/30' :
                        preScanResult.confidence === 'medium' ? 'bg-warning/10 text-warning border-warning/30' :
                        'bg-muted/50 text-muted-foreground border-muted/50'
                      }`}
                    >
                      {preScanResult.confidence}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ZIP source:</span>
                    <span>{zipSource}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">State source (UI):</span>
                    <span>{stateSource}</span>
                  </div>
                  {preScanResult.evidence && (
                    <div className="pt-1 border-t border-border/20">
                      <span className="text-muted-foreground block">Evidence:</span>
                      <span className="text-[8px] break-all opacity-80">{preScanResult.evidence}</span>
                    </div>
                  )}
                  {preScanResult.extractedText && (
                    <div className="pt-1 border-t border-border/20">
                      <span className="text-muted-foreground block">Extracted text:</span>
                      <span className="text-[8px] break-all opacity-60 max-h-16 overflow-y-auto block">{preScanResult.extractedText}</span>
                    </div>
                  )}
                  {preScanResult.error && (
                    <div className="pt-1 border-t border-destructive/20 text-destructive">
                      <span className="block">Error: {preScanResult.error}</span>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {/* Condensed steps + features */}
        <div className="mt-2.5 animate-slide-up" style={{ animationDelay: '0.25s' }}>
          {/* Step indicators - wrap on very small screens */}
          <div className="flex items-center justify-center gap-1 md:gap-1.5 text-[11px] md:text-xs text-muted-foreground mb-1.5 flex-wrap lowercase">
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-coral/20 text-coral font-bold text-[9px]">1</span>
              upload
            </span>
            <span className="text-muted-foreground/50">→</span>
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-purple/20 text-purple font-bold text-[9px]">2</span>
              pond decodes
            </span>
            <span className="text-muted-foreground/50">→</span>
            <span className="flex items-center gap-0.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky/20 text-sky font-bold text-[9px]">3</span>
              next step
            </span>
          </div>

          {/* Feature pills - wrap properly */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-1 text-[11px] md:text-[10px] lowercase">
            {currentContent.features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="flex items-center gap-0.5 px-2 md:px-1.5 py-1 md:py-0.5 rounded-full bg-background/50 backdrop-blur-sm border border-background/60">
                  <Icon className={`h-3 md:h-2.5 w-3 md:w-2.5 ${feature.color}`} />
                  <span className="text-muted-foreground">{feature.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
