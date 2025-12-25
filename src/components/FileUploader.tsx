import { useCallback, useState } from 'react';
import { Upload, FileText, Image, X, AlertCircle, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UploadedFile, AnalysisMode } from '@/types';
import { useHeicConverter } from '@/hooks/useHeicConverter';
import { useTranslation } from '@/i18n/LanguageContext';

interface FileUploaderProps {
  onFileSelect: (file: UploadedFile) => void;
  uploadedFile: UploadedFile | null;
  onRemoveFile: () => void;
  mode?: AnalysisMode;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
  'image/bmp',
  'image/heic',
  'image/heif',
];
const ACCEPTED_TYPES = ['application/pdf', ...ACCEPTED_IMAGE_TYPES];

export function FileUploader({ onFileSelect, uploadedFile, onRemoveFile, mode = 'bill' }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRipple, setShowRipple] = useState(false);
  const { convertFile, isConverting } = useHeicConverter();
  const { t } = useTranslation();
  const isMedicalDoc = mode === 'medical_document';

  const validateFile = (file: File): string | null => {
    const fileName = file.name.toLowerCase();
    const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif');
    const isAcceptedByType = ACCEPTED_TYPES.includes(file.type);
    const isAcceptedByExtension = /\.(pdf|jpe?g|png|gif|webp|tiff?|bmp|heic|heif)$/i.test(fileName);
    
    if (!isAcceptedByType && !isAcceptedByExtension && !isHeic) {
      return 'Please upload a PDF or image file (JPG, PNG, GIF, WEBP, TIFF, BMP, or HEIC).';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 20MB.';
    }
    return null;
  };

  const processFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setShowRipple(true);
    
    const fileName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');
    const fileType = isPdf ? 'pdf' : 'image';
    
    const conversionResult = await convertFile(file);
    
    // Keep ripple visible briefly
    setTimeout(() => setShowRipple(false), 800);
    
    onFileSelect({
      id: crypto.randomUUID(),
      file,
      preview: conversionResult.originalUrl,
      previewUrl: conversionResult.previewUrl,
      originalUrl: conversionResult.originalUrl,
      type: fileType,
      isConverted: conversionResult.isConverted,
      conversionError: conversionResult.conversionError,
    });
  }, [onFileSelect, convertFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  if (isConverting) {
    return (
      <div className="animate-scale-in">
        <div className="relative rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-md p-8">
          <div className="flex items-center justify-center gap-4">
            <div className="liquid-loader rounded-full p-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <div>
              <p className="font-medium text-foreground">{t('heic.converting')}</p>
              <p className="text-sm text-muted-foreground">{t('analysis.loadingDesc')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (uploadedFile) {
    return (
      <div className="animate-scale-in">
        <div className="relative rounded-2xl border border-primary/20 glass-card-enhanced p-6">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemoveFile}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-success/20 border border-success/30">
              <Check className="h-7 w-7 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {uploadedFile.file.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB • {uploadedFile.type.toUpperCase()}
                {uploadedFile.isConverted && <span className="text-success ml-2">• Converted</span>}
              </p>
              {uploadedFile.conversionError && (
                <p className="text-xs text-warning mt-1">{uploadedFile.conversionError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden",
          "glass-card-enhanced hover:scale-[1.01] hover:bg-white/90",
          isDragging && "scale-[1.02] bg-white/95 border-primary/30 shadow-glow-active",
          !isDragging && "border-white/60 hover:border-white/80",
          error && "border-destructive/30"
        )}
        style={{
          transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'
        }}
      >
        {/* Ripple effect on file drop */}
        {showRipple && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="ripple-effect" />
            <div className="ripple-effect" style={{ animationDelay: '0.2s' }} />
            <div className="ripple-effect" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
        
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.tiff,.tif,.bmp,.heic,.heif"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        />
        
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl mb-4 transition-all duration-300",
            "bg-muted/30 border border-border/30",
            isDragging && "bg-primary/10 border-primary/30 animate-icon-wiggle"
          )}>
            <Upload className={cn(
              "h-8 w-8 transition-all duration-300",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {isDragging 
              ? (isMedicalDoc ? 'drop your document here' : t('upload.bill.dragDrop'))
              : (isMedicalDoc ? 'upload your medical document' : t('upload.bill.title'))}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {isMedicalDoc 
              ? 'we accept images, pdfs, and heic files'
              : t('upload.bill.subtitle')}
          </p>
          <p className="text-xs text-muted-foreground/70">
            {t('upload.bill.formats')}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive animate-fade-in">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}